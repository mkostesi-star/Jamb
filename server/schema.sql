-- Yamb Café: accounts, records, Daily Yamb high scores and visitor numbers.
-- Paste the whole file into the Supabase SQL editor and press Run. It is safe to run again whenever the file changes.
--
-- How it is locked: the four tables cannot be read or written from outside at all. The game only calls the
-- functions at the bottom, and each function works for the signed-in player alone. A Daily Yamb score is never
-- taken from the game: the player's moves are played again here, with that day's dice, and the score is counted here.

create schema if not exists yamb;

-- ---------------------------------------------------------------- tables
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '' check (char_length(name) <= 16),
  avatar      text check (avatar is null or avatar ~ '^[a-z0-9_-]{1,24}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- what a device had in its records before its first sign-in, kept as it was
create table if not exists public.carried (
  user_id     uuid not null references auth.users (id) on delete cascade,
  device      text not null check (char_length(device) between 1 and 64),
  stats       jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, device)
);

-- one finished game, as the device reported it (personal records, not public)
create table if not exists public.results (
  user_id     uuid not null references auth.users (id) on delete cascade,
  game_id     text not null check (char_length(game_id) between 4 and 40),
  mode        text not null check (mode in ('cpu','pp','online','duel','table','daily')),
  rules       text not null check (char_length(rules) <= 400),
  score       integer not null check (score between 0 and 20000),
  won         boolean not null default false,
  mine        boolean not null default true,
  players     smallint not null default 1 check (players between 1 and 6),
  name        text check (name is null or char_length(name) <= 16),
  finished_at timestamptz not null,
  day         date,
  created_at  timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Daily Yamb: one checked score a day for each player
create table if not exists public.daily_scores (
  day         date not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  score       integer not null,
  moves       jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (day, user_id)
);
create index if not exists daily_scores_board on public.daily_scores (day, score desc, created_at);
create index if not exists daily_scores_user on public.daily_scores (user_id, day);

alter table public.profiles     enable row level security;
alter table public.carried      enable row level security;
alter table public.results      enable row level security;
alter table public.daily_scores enable row level security;
revoke all on public.profiles, public.carried, public.results, public.daily_scores from anon, authenticated;

-- ---------------------------------------------------------------- the day's dice, exactly as the game makes them
-- engine.js hashStr: 32-bit FNV-1a
create or replace function yamb.fnv(s text) returns bigint
language plpgsql immutable set search_path = '' as $$
declare h bigint := 2166136261;
begin
  for i in 1 .. char_length(s) loop
    h := ((h # ascii(substr(s, i, 1))::bigint) * 16777619) & 4294967295;
  end loop;
  return h;
end $$;

-- engine.js mulberry: one step of the stream; returns the new state and a die 1..6
create or replace function yamb.next_die(inout a bigint, out die integer)
language plpgsql immutable set search_path = '' as $$
declare t bigint; x bigint; y bigint;
begin
  a := (a + 1831565813) & 4294967295;
  x := a # (a >> 15);  y := a | 1;
  t := ((x::numeric * y::numeric) % 4294967296::numeric)::bigint;
  x := t # (t >> 7);   y := t | 61;
  t := ((t + ((x::numeric * y::numeric) % 4294967296::numeric)::bigint) & 4294967295) # t;
  t := t # (t >> 14);
  die := 1 + ((t * 6) >> 32)::integer;
end $$;

-- engine.js scoreC for five dice and the Daily's rules. ri: 0..5 = ones..sixes, 6 max, 7 min, 8 straight,
-- 9 three of a kind, 10 full house, 11 four of a kind, 12 yamb
create or replace function yamb.score5(ri integer, d integer[], roll integer) returns integer
language plpgsql immutable set search_path = '' as $$
declare c integer[] := array[0,0,0,0,0,0]; best integer := 0;
begin
  for i in 1 .. 5 loop c[d[i]] := c[d[i]] + 1; end loop;
  if ri < 6 then return c[ri + 1] * (ri + 1); end if;
  if ri = 6 or ri = 7 then return d[1] + d[2] + d[3] + d[4] + d[5]; end if;
  if ri = 8 then
    if (c[1] > 0 and c[2] > 0 and c[3] > 0 and c[4] > 0 and c[5] > 0)
       or (c[2] > 0 and c[3] > 0 and c[4] > 0 and c[5] > 0 and c[6] > 0) then
      return (array[66, 56, 46])[least(greatest(roll, 1), 3)];
    end if;
    return 0;
  end if;
  if ri = 9 then
    for f in reverse 6 .. 1 loop if c[f] >= 3 then return 3 * f + 10; end if; end loop;
    return 0;
  end if;
  if ri = 10 then
    for a in reverse 6 .. 1 loop
      if c[a] >= 5 then best := greatest(best, 5 * a + 30); end if;
      if c[a] >= 3 then
        for b in reverse 6 .. 1 loop
          if b <> a and c[b] >= 2 then best := greatest(best, 3 * a + 2 * b + 30); exit; end if;
        end loop;
      end if;
    end loop;
    return best;
  end if;
  if ri = 11 then
    for f in reverse 6 .. 1 loop if c[f] >= 4 then return 4 * f + 40; end if; end loop;
    return 0;
  end if;
  for f in reverse 6 .. 1 loop if c[f] >= 5 then return 5 * f + 50; end if; end loop;
  return 0;
end $$;

-- Plays a Daily Yamb again from the player's moves and returns the score.
-- moves: 13 turns, each [row, kept before 2nd roll, kept before 3rd roll]; "kept" has bit i set when die i stayed.
create or replace function yamb.daily_replay(p_day date, p_moves jsonb) returns integer
language plpgsql immutable set search_path = '' as $$
declare
  seed  text := 'daily:' || to_char(p_day, 'YYYY-MM-DD');
  sheet integer[] := array_fill(null::integer, array[13]);
  mv jsonb; n integer; ri integer; mask integer; roll integer;
  a bigint; die integer; d integer[];
  up integer := 0; low integer := 0;
begin
  if p_moves is null or jsonb_typeof(p_moves) <> 'array' or jsonb_array_length(p_moves) <> 13 then
    raise exception 'YC_MOVES';
  end if;
  for tn in 0 .. 12 loop
    mv := p_moves -> tn;
    if jsonb_typeof(mv) <> 'array' then raise exception 'YC_MOVES'; end if;
    n := jsonb_array_length(mv);
    if n < 1 or n > 3 then raise exception 'YC_MOVES'; end if;
    for k in 0 .. n - 1 loop
      if jsonb_typeof(mv -> k) <> 'number' or (mv ->> k) !~ '^[0-9]{1,2}$' then raise exception 'YC_MOVES'; end if;
    end loop;
    ri := (mv ->> 0)::integer;
    if ri > 12 or sheet[ri + 1] is not null then raise exception 'YC_MOVES'; end if;
    a := yamb.fnv(seed || ':' || tn);
    d := array[0,0,0,0,0];
    for i in 1 .. 5 loop
      select x.a, x.die into a, die from yamb.next_die(a) x;
      d[i] := die;
    end loop;
    roll := 1;
    for k in 1 .. n - 1 loop
      mask := (mv ->> k)::integer;
      if mask > 31 then raise exception 'YC_MOVES'; end if;
      for i in 1 .. 5 loop
        if (mask >> (i - 1)) & 1 = 0 then
          select x.a, x.die into a, die from yamb.next_die(a) x;
          d[i] := die;
        end if;
      end loop;
      roll := roll + 1;
    end loop;
    sheet[ri + 1] := yamb.score5(ri, d, roll);
  end loop;
  for i in 1 .. 6  loop up  := up  + sheet[i]; end loop;
  for i in 9 .. 13 loop low := low + sheet[i]; end loop;
  return up + (case when up >= 60 then 30 else 0 end) + (sheet[7] - sheet[8]) * sheet[1] + low;
end $$;

-- ---------------------------------------------------------------- what the game calls
create or replace function yamb.clean_name(p text) returns text
language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'), '[\u0001-\u001F\u007F<>]', '', 'g')), 16)
$$;

-- today's table: the best 50, how many played, and the caller's own place
create or replace function public.daily_board(p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  return jsonb_build_object(
    'day', p_day,
    'count', (select count(*) from public.daily_scores s where s.day = p_day),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('rank', r.rnk, 'name', r.name, 'avatar', r.avatar, 'score', r.score,
                                          'me', coalesce(r.user_id = me, false), 'plus', coalesce(r.wall, false) and yamb.has_plus(r.user_id),
                                          'pin', coalesce(r.wall, false) and coalesce((yamb.plus_of(r.user_id) ->> 'pin')::boolean, false))
                       order by r.score desc, r.created_at)
      from (select s.user_id, s.score, s.created_at, coalesce(p.name, '') as name, p.avatar, p.wall,
                   rank() over (order by s.score desc) as rnk
            from public.daily_scores s left join public.profiles p on p.id = s.user_id
            where s.day = p_day
            order by s.score desc, s.created_at
            limit 50) r), '[]'::jsonb),
    'me', (select jsonb_build_object('score', s.score,
                    'rank', (select count(*) + 1 from public.daily_scores o where o.day = p_day and o.score > s.score))
           from public.daily_scores s where s.day = p_day and s.user_id = me));
end $$;

-- the week's table (Monday to Sunday of the given day): each player's Daily scores added up
create or replace function public.week_board(p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); mon date := date_trunc('week', p_day::timestamp)::date;
begin
  return jsonb_build_object(
    'from', mon, 'to', mon + 6,
    'count', (select count(distinct s.user_id) from public.daily_scores s where s.day between mon and mon + 6),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('rank', r.rnk, 'name', r.name, 'avatar', r.avatar, 'score', r.total,
                                          'days', r.days, 'me', coalesce(r.user_id = me, false), 'plus', coalesce(r.wall, false) and yamb.has_plus(r.user_id),
                                          'pin', coalesce(r.wall, false) and coalesce((yamb.plus_of(r.user_id) ->> 'pin')::boolean, false))
                       order by r.total desc, r.last_at)
      from (select w.user_id, w.total, w.days, w.last_at, coalesce(p.name, '') as name, p.avatar, p.wall,
                   rank() over (order by w.total desc) as rnk
            from (select s.user_id, sum(s.score)::integer as total, count(*)::integer as days, max(s.created_at) as last_at
                  from public.daily_scores s where s.day between mon and mon + 6 group by s.user_id) w
            left join public.profiles p on p.id = w.user_id
            order by w.total desc, w.last_at
            limit 50) r), '[]'::jsonb),
    'me', (select jsonb_build_object('score', w.total, 'days', w.days,
                    'rank', (select count(*) + 1 from (select sum(o.score) as t from public.daily_scores o
                                                       where o.day between mon and mon + 6 group by o.user_id) z
                             where z.t > w.total))
           from (select sum(s.score)::integer as total, count(*)::integer as days from public.daily_scores s
                 where s.day between mon and mon + 6 and s.user_id = me) w
           where w.days > 0));
end $$;

-- everything the game needs to show the signed-in player's own records
create or replace function public.my_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  return jsonb_build_object(
    'id', me,
    'profile', (select jsonb_build_object('name', p.name, 'avatar', p.avatar, 'since', p.created_at, 'wall', p.wall)
                from public.profiles p where p.id = me),
    'carried', coalesce((select jsonb_agg(c.stats order by c.created_at) from public.carried c where c.user_id = me), '[]'::jsonb),
    'totals', (select jsonb_build_object('games', count(*),
                        'wins', count(*) filter (where r.won and r.mine and r.players > 1),
                        'best', coalesce(max(r.score) filter (where r.mine), 0))
               from public.results r where r.user_id = me),
    'records', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select r.mode, r.rules, count(*) as games, count(*) filter (where r.won) as wins, sum(r.score) as sum,
               max(r.score) as best,
               (array_agg(r.name order by r.score desc, r.finished_at))[1] as best_name,
               (array_agg(r.day  order by r.score desc, r.finished_at))[1] as best_day
        from public.results r where r.user_id = me group by r.mode, r.rules) x), '[]'::jsonb),
    'dailies', coalesce((
      select jsonb_agg(jsonb_build_object('day', s.day, 'score', s.score, 'moves', s.moves) order by s.day)
      from public.daily_scores s where s.user_id = me and s.day > (now() at time zone 'utc')::date - 70), '[]'::jsonb),
    'daily_days', (select count(*) from public.daily_scores s where s.user_id = me),
    'daily_best', (select max(s.score) from public.daily_scores s where s.user_id = me),
    'plus', yamb.plus_of(me),
    'host', exists (select 1 from yamb.badges b where b.user_id = me and b.badge = 'host'));
end $$;

-- sends up a device's old records (once) and its finished games, and returns the player's records
create or replace function public.sync_up(p_device text, p_carried jsonb, p_results jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); r jsonb; have bigint;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  insert into public.profiles (id) values (me) on conflict do nothing;
  if p_device is not null and char_length(p_device) between 1 and 64
     and p_carried is not null and jsonb_typeof(p_carried) = 'object' and length(p_carried::text) < 60000 then
    insert into public.carried (user_id, device, stats) values (me, p_device, p_carried) on conflict do nothing;
  end if;
  if p_results is not null and jsonb_typeof(p_results) = 'array' then
    select count(*) into have from public.results x where x.user_id = me;
    if have < 50000 then
      for r in select e.value from jsonb_array_elements(p_results) e limit 300 loop
        begin
          insert into public.results (user_id, game_id, mode, rules, score, won, mine, players, name, finished_at, day)
          values (me, r ->> 'id', r ->> 'mode', coalesce(r ->> 'rules', ''), (r ->> 'score')::integer,
                  coalesce((r ->> 'won')::boolean, false), coalesce((r ->> 'mine')::boolean, true),
                  coalesce((r ->> 'players')::smallint, 1), nullif(yamb.clean_name(r ->> 'name'), ''),
                  to_timestamp((r ->> 'at')::double precision / 1000), (r ->> 'day')::date)
          on conflict do nothing;
        exception when others then null;   -- one bad row is left out; the rest still go in
        end;
      end loop;
    end if;
    perform yamb.check_host(i.invited_by) from yamb.invites i where i.user_id = me;
  end if;
  return public.my_state();
end $$;

create or replace function public.save_profile(p_name text, p_avatar text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); nm text := yamb.clean_name(p_name);
        av text := case when p_avatar ~ '^[a-z0-9_-]{1,24}$' then p_avatar else null end;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  if av ~ '^p[0-9]+$' and not yamb.has_plus(me) then av := null; end if;
  insert into public.profiles (id, name, avatar) values (me, nm, av)
  on conflict (id) do update set name = excluded.name, avatar = excluded.avatar, updated_at = now();
  return (select jsonb_build_object('name', p.name, 'avatar', p.avatar, 'since', p.created_at, 'wall', p.wall) from public.profiles p where p.id = me);
end $$;

-- a Daily Yamb result: checked by playing the moves again; the first result of the day stands
create or replace function public.submit_daily(p_day date, p_moves jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); today date := (now() at time zone 'utc')::date; sc integer; had boolean;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  if p_day is null or p_day < today - 1 or p_day > today + 1 then raise exception 'YC_DAY'; end if;
  select true into had from public.daily_scores s where s.day = p_day and s.user_id = me;
  if had is null then
    if length(p_moves::text) > 800 then raise exception 'YC_MOVES'; end if;
    sc := yamb.daily_replay(p_day, p_moves);
    insert into public.profiles (id) values (me) on conflict do nothing;
    insert into public.daily_scores (day, user_id, score, moves) values (p_day, me, sc, p_moves) on conflict do nothing;
  end if;
  return public.daily_board(p_day) || jsonb_build_object('had', coalesce(had, false));
end $$;

-- removes the player's records and, where the database allows it, the sign-in itself
create or replace function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); gone boolean := true;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  delete from public.daily_scores where user_id = me;
  delete from public.results where user_id = me;
  delete from public.carried where user_id = me;
  perform public.leave_friend_table(s.table_id, current_date) from yamb.friend_seats s where s.user_id = me;
  delete from yamb.invites where user_id = me or invited_by = me;
  delete from yamb.badges where user_id = me;
  delete from public.profiles where id = me;
  begin
    delete from auth.users where id = me;
  exception when others then gone := false;
  end;
  return jsonb_build_object('data', true, 'login', gone);
end $$;

revoke all on function public.daily_board(date), public.week_board(date), public.my_state(),
  public.sync_up(text, jsonb, jsonb), public.save_profile(text, text), public.submit_daily(date, jsonb),
  public.delete_my_account() from public, anon, authenticated;
grant execute on function public.daily_board(date), public.week_board(date) to anon, authenticated;
grant execute on function public.my_state(), public.sync_up(text, jsonb, jsonb), public.save_profile(text, text),
  public.submit_daily(date, jsonb), public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- visitor numbers: no cookies, nothing kept on the device
-- Each day (UTC) has its own random key. A visitor's internet address and browser, mixed with that key, give a
-- one-way code that only tells whether this visitor was already counted today. When the next day begins, the codes
-- and the old key are deleted and only the day's totals stay. These tables live in the yamb schema, which the API
-- does not show at all; the game reaches them only through count_visit and count_event below.
create table if not exists yamb.day_key (day date primary key, k text not null);
create table if not exists yamb.seen (day date not null, what text not null, h text not null, primary key (day, what, h));
create table if not exists yamb.visits (
  day     date not null,
  page    text not null,
  src     text not null,
  lang    text not null,
  app     boolean not null,
  views   integer not null default 0,
  people  integer not null default 0,
  primary key (day, page, src, lang, app)
);
create table if not exists yamb.events (
  day     date not null,
  ev      text not null,
  mode    text not null,
  n       integer not null default 0,
  people  integer not null default 0,
  primary key (day, ev, mode)
);
-- other counts, each a plain number for the day: visitors by country, device and hour; and what is chosen in games
create table if not exists yamb.stats (
  day  date not null,
  k    text not null,
  v    text not null,
  n    integer not null default 0,
  sum  bigint not null default 0,
  primary key (day, k, v)
);
revoke all on yamb.stats from public, anon, authenticated;
create or replace function yamb.bump(p_k text, p_v text, p_sum integer) returns void
language sql security definer set search_path = '' as $$
  insert into yamb.stats as s (day, k, v, n, sum) values ((now() at time zone 'utc')::date, p_k, p_v, 1, coalesce(p_sum, 0))
    on conflict (day, k, v) do update set n = s.n + 1, sum = s.sum + excluded.sum;
$$;

-- who may open the Numbers page (yambcafe.com/numbers/). Add yourself once in the SQL editor, after signing in to the
-- game at least once, with the Google address you sign in with:
--   insert into yamb.admins (user_id) select id from auth.users where email = 'your.address@gmail.com';
create table if not exists yamb.admins (user_id uuid primary key references auth.users (id) on delete cascade);
revoke all on yamb.day_key, yamb.seen, yamb.visits, yamb.events, yamb.admins from public, anon, authenticated;

-- today's one-way code for this visitor; also clears out the days before
create or replace function yamb.visitor() returns text
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'utc')::date; k text; hd jsonb; ip text; ua text;
begin
  select x.k into k from yamb.day_key x where x.day = d;
  if k is null then
    delete from yamb.seen where day < d;
    delete from yamb.day_key where day < d;
    insert into yamb.day_key (day, k)
      values (d, encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'))
      on conflict (day) do nothing;
    select x.k into k from yamb.day_key x where x.day = d;
  end if;
  begin hd := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then hd := null; end;
  hd := coalesce(hd, '{}'::jsonb);
  ip := coalesce(nullif(hd ->> 'cf-connecting-ip', ''), nullif(btrim(split_part(coalesce(hd ->> 'x-forwarded-for', ''), ',', 1)), ''),
                 nullif(hd ->> 'x-real-ip', ''), '');
  ua := left(coalesce(hd ->> 'user-agent', ''), 400);
  return encode(sha256(convert_to(k || '|' || ip || '|' || ua, 'UTF8')), 'hex');
end $$;

-- one page opened: which page, where the visitor came from, the game's language, and whether it runs installed
drop function if exists public.count_visit(text, text, text, boolean);
create or replace function public.count_visit(p_page text, p_src text, p_lang text, p_app boolean, p_dev text default null, p_hour integer default null) returns void
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'utc')::date; h text := yamb.visitor(); fresh integer := 0;
        pg text := lower(coalesce(p_page, '')); sr text := lower(coalesce(p_src, '')); lg text := lower(coalesce(p_lang, ''));
        hd jsonb; cc text;
begin
  if pg !~ '^[a-z0-9/_-]{1,40}$' then pg := 'other'; end if;
  if sr !~ '^[a-z0-9.:_-]{1,60}$' then sr := 'other'; end if;
  if lg !~ '^[a-z]{2}$' then lg := 'xx'; end if;
  -- a flood of made-up sources cannot grow the table without end
  if (select count(*) from yamb.visits v where v.day = d) > 800
     and not exists (select 1 from yamb.visits v where v.day = d and v.page = pg and v.src = sr and v.lang = lg and v.app = coalesce(p_app, false)) then
    pg := 'other'; sr := 'other';
  end if;
  insert into yamb.seen (day, what, h) values (d, 'visit', h) on conflict do nothing;
  get diagnostics fresh = row_count;
  insert into yamb.visits as v (day, page, src, lang, app, views, people) values (d, pg, sr, lg, coalesce(p_app, false), 1, fresh)
    on conflict (day, page, src, lang, app) do update set views = v.views + 1, people = v.people + excluded.people;
  -- once a day for each visitor: the country (only its two letters, as the network in front of the database names it),
  -- the kind of device and the visitor's hour of day
  if fresh = 1 then
    begin hd := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then hd := null; end;
    cc := lower(coalesce(hd ->> 'cf-ipcountry', ''));
    perform yamb.bump('country', case when cc ~ '^[a-z]{2}$' then cc else 'xx' end, 0);
    perform yamb.bump('device', case when p_dev in ('phone', 'tablet', 'desktop') then p_dev else 'other' end, 0);
    if p_hour between 0 and 23 then perform yamb.bump('hour', lpad(p_hour::text, 2, '0'), 0); end if;
  end if;
end $$;

-- what was chosen or used in a game, sent as a short list of [what, which, number]:
-- opp (a computer opponent), rules (a preset or custom), players (1 to 6), len (minutes a game took, by mode),
-- hint, emo (how many in a finished game), share (what was shared)
create or replace function public.count_stats(p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare it jsonb; k text; v text; x integer; i integer := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then return; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    i := i + 1; exit when i > 12;
    if jsonb_typeof(it) <> 'array' then continue; end if;
    k := it ->> 0; v := lower(coalesce(it ->> 1, ''));
    begin x := least(greatest(coalesce((it ->> 2)::numeric, 0), 0), 600)::integer; exception when others then x := 0; end;
    if k is null or k not in ('opp', 'rules', 'players', 'len', 'hint', 'emo', 'share') or v !~ '^[a-z0-9_-]{1,16}$' then continue; end if;
    perform yamb.bump(k, v, x);
  end loop;
end $$;

-- one thing done in the game: a game started or finished (with its mode), installed, Plus looked at or bought
create or replace function public.count_event(p_ev text, p_mode text) returns void
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'utc')::date; h text; fresh integer := 0; m text := lower(coalesce(p_mode, ''));
begin
  if p_ev is null or p_ev not in ('start', 'finish', 'install', 'signin', 'plus_view', 'plus_buy', 'tip_buy') then return; end if;
  if m not in ('cpu', 'pp', 'online', 'duel', 'table', 'daily', 'dailyp', '-') then m := '-'; end if;
  h := yamb.visitor();
  insert into yamb.seen (day, what, h) values (d, p_ev || ':' || m, h) on conflict do nothing;
  get diagnostics fresh = row_count;
  insert into yamb.events as e (day, ev, mode, n, people) values (d, p_ev, m, 1, fresh)
    on conflict (day, ev, mode) do update set n = e.n + 1, people = e.people + excluded.people;
  -- games also count once more under 'all', so a player who starts two kinds of game is still one player that day
  if p_ev in ('start', 'finish') then
    insert into yamb.seen (day, what, h) values (d, p_ev || ':all', h) on conflict do nothing;
    get diagnostics fresh = row_count;
    insert into yamb.events as e (day, ev, mode, n, people) values (d, p_ev, 'all', 1, fresh)
      on conflict (day, ev, mode) do update set n = e.n + 1, people = e.people + excluded.people;
  end if;
end $$;

-- the Numbers page: totals only, never a single visitor; only for an account listed in yamb.admins
create or replace function public.numbers(p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); a date := least(p_from, p_to); b date := greatest(p_from, p_to);
begin
  if me is null or not exists (select 1 from yamb.admins x where x.user_id = me) then raise exception 'YC_ADMIN'; end if;
  if b - a > 400 then a := b - 400; end if;
  return jsonb_build_object(
    'from', a, 'to', b,
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', v.day, 'views', v.views, 'people', v.people, 'app', v.app_people) order by v.day)
                      from (select day, sum(views)::int as views, sum(people)::int as people,
                                   (sum(people) filter (where app))::int as app_people
                            from yamb.visits where day between a and b group by day) v), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('src', s.src, 'people', s.people, 'views', s.views) order by s.people desc)
                         from (select src, sum(people)::int as people, sum(views)::int as views from yamb.visits
                               where day between a and b group by src order by sum(people) desc limit 30) s), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('page', s.page, 'people', s.people, 'views', s.views) order by s.people desc)
                       from (select page, sum(people)::int as people, sum(views)::int as views from yamb.visits
                             where day between a and b group by page order by sum(people) desc limit 30) s), '[]'::jsonb),
    'langs', coalesce((select jsonb_object_agg(s.lang, s.people)
                       from (select lang, sum(people)::int as people from yamb.visits where day between a and b group by lang) s), '{}'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('day', e.day, 'ev', e.ev, 'mode', e.mode, 'n', e.n, 'people', e.people) order by e.day, e.ev, e.mode)
                        from yamb.events e where e.day between a and b), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(jsonb_build_object('k', x.k, 'v', x.v, 'n', x.n, 'sum', x.sum) order by x.k, x.n desc)
                       from (select k, v, sum(n)::int as n, sum(sum)::bigint as sum from yamb.stats where day between a and b group by k, v) x), '[]'::jsonb),
    'accounts', jsonb_build_object('all', (select count(*) from public.profiles),
                                   'new', (select count(*) from public.profiles p where p.created_at::date between a and b)),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', s.day, 'players', s.n) order by s.day)
                       from (select day, count(*)::int as n from public.daily_scores where day between a and b group by day) s), '[]'::jsonb),
    -- signed-in players who finished a game in a week, and how many of them finished one the week after
    'weeks', coalesce((select jsonb_agg(jsonb_build_object('week', w.wk, 'players', w.players, 'back', w.back) order by w.wk)
                       from (select x.wk, count(*)::int as players, count(y.user_id)::int as back
                             from (select distinct r.user_id, date_trunc('week', r.finished_at)::date as wk from public.results r
                                   where r.finished_at >= a - 7 and r.finished_at < b + 8) x
                             left join (select distinct r.user_id, date_trunc('week', r.finished_at)::date as wk from public.results r
                                        where r.finished_at >= a and r.finished_at < b + 15) y
                               on y.user_id = x.user_id and y.wk = x.wk + 7
                             where x.wk between date_trunc('week', a::timestamp)::date and b
                             group by x.wk) w), '[]'::jsonb));
end $$;

revoke all on function yamb.visitor() from public, anon, authenticated;
revoke all on function yamb.bump(text, text, integer) from public, anon, authenticated;
revoke all on function public.count_visit(text, text, text, boolean, text, integer), public.count_event(text, text), public.count_stats(jsonb),
  public.numbers(date, date) from public, anon, authenticated;
grant execute on function public.count_visit(text, text, text, boolean, text, integer), public.count_event(text, text), public.count_stats(jsonb)
  to anon, authenticated;
grant execute on function public.numbers(date, date) to authenticated;

-- ---------------------------------------------------------------- Yamb Café Plus
-- A one-time unlock, sold through Polar (the merchant of record). Polar tells the database about a payment or a refund
-- through the Edge Function polar-webhook, which alone may call yamb_order (with the project's secret key). The game
-- only ever asks whether the signed-in player has Plus. Testers are given Plus by a line in yamb.plus_gifts.
create table if not exists yamb.orders (
  id          text primary key check (char_length(id) between 4 and 80),   -- Polar's order id
  user_id     uuid not null references auth.users (id) on delete cascade,
  env         text not null check (env in ('sandbox', 'live')),
  status      text not null,
  net         integer not null default 0,      -- cents, before tax
  tax         integer not null default 0,
  total       integer not null default 0,
  refunded    integer not null default 0,      -- net cents refunded
  currency    text not null default 'eur',
  paid_at     timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists orders_user on yamb.orders (user_id);
-- the regulars' wall and the Plus mark on the high scores: shown only when the owner switches it on
alter table public.profiles add column if not exists wall boolean not null default false;
create table if not exists yamb.plus_gifts (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  why         text not null default '',
  created_at  timestamptz not null default now()
);
revoke all on yamb.orders, yamb.plus_gifts from public, anon, authenticated;
-- friends' tables, invites, badges and gift links (described further down, with their functions)
create table if not exists yamb.friend_tables (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 24),
  owner       uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create table if not exists yamb.friend_seats (
  table_id    uuid not null references yamb.friend_tables (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  ref         text not null unique check (ref ~ '^[A-HJ-NP-Z2-9]{6}$'),   -- this player's invite code for this table
  joined_at   timestamptz not null default now(),
  primary key (table_id, user_id)
);
create index if not exists friend_seats_user on yamb.friend_seats (user_id);
create table if not exists yamb.invites (
  user_id     uuid primary key references auth.users (id) on delete cascade,   -- the player who came
  invited_by  uuid not null references auth.users (id) on delete cascade,      -- whose code brought them
  at          timestamptz not null default now()
);
create index if not exists invites_by on yamb.invites (invited_by);
create table if not exists yamb.badges (
  user_id     uuid not null references auth.users (id) on delete cascade,
  badge       text not null check (badge in ('host')),
  at          timestamptz not null default now(),
  primary key (user_id, badge)
);
-- gift links (yambcafe.com/?dar=CODE) that put Plus on the account that opens them, e.g. for testers.
-- The codes are made in the SQL editor only and never written in this file, which is public.
create table if not exists yamb.gift_codes (
  code        text primary key check (code ~ '^[A-Z0-9-]{6,32}$'),
  why         text not null default 'tester',
  uses_left   integer not null default 30,
  until       date,
  created_at  timestamptz not null default now()
);
revoke all on yamb.friend_tables, yamb.friend_seats, yamb.invites, yamb.badges, yamb.gift_codes from public, anon, authenticated;

-- whether a player has Plus, since when, and the thank-you pin (paid more than the €4.99 minimum; a buyer in Europe
-- pays VAT inside the price, so the test is on the amount before tax: €5.20 is above any VAT share of €4.99 and below
-- any VAT share of €6.99)
create or replace function yamb.plus_of(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case
    when g.user_id is null and o.since is null then jsonb_build_object('plus', false)
    else jsonb_build_object('plus', true, 'since', least(g.created_at, o.since), 'pin', coalesce(o.pin, false), 'gift', g.user_id is not null)
  end
  from (select 1) one
  left join yamb.plus_gifts g on g.user_id = p_user
  left join lateral (select min(x.paid_at) as since, bool_or(x.net - x.refunded >= 520) as pin from yamb.orders x
                     where x.user_id = p_user and x.status in ('paid', 'partially_refunded') and x.net - x.refunded > 0) o on true
$$;

create or replace function yamb.has_plus(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from yamb.plus_gifts g where g.user_id = p_user)
      or exists (select 1 from yamb.orders x where x.user_id = p_user and x.status in ('paid', 'partially_refunded') and x.net - x.refunded > 0)
$$;

-- on or off: the player's portrait on the regulars' wall and the Plus mark beside their name on the high scores
create or replace function public.set_wall(p_on boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  if coalesce(p_on, false) and not yamb.has_plus(me) then raise exception 'YC_PLUS'; end if;
  insert into public.profiles (id, wall) values (me, coalesce(p_on, false))
  on conflict (id) do update set wall = excluded.wall, updated_at = now();
  return jsonb_build_object('wall', coalesce(p_on, false));
end $$;

-- the regulars' wall: Plus owners who chose to be on it, oldest first (names and portraits only)
create or replace function public.regulars_wall() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', w.name, 'avatar', w.avatar, 'since', w.since, 'me', w.id = auth.uid(),
                                               'pin', w.pin, 'host', w.host) order by w.since), '[]'::jsonb)
  from (select p.id, coalesce(nullif(p.name, ''), '') as name, p.avatar, (x.p ->> 'since')::timestamptz as since,
               coalesce((x.p ->> 'pin')::boolean, false) as pin,
               exists (select 1 from yamb.badges b where b.user_id = p.id and b.badge = 'host') as host
        from public.profiles p cross join lateral (select yamb.plus_of(p.id) as p) x
        where p.wall and yamb.has_plus(p.id)
        limit 300) w
$$;

create or replace function public.my_plus() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'YC_SIGNIN'; end if;
  return yamb.plus_of(auth.uid());
end $$;

-- a payment or refund reported by Polar (the order as Polar sends it). Only the secret key may call this.
create or replace function public.yamb_order(p_order jsonb, p_env text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare uid uuid; oid text := p_order ->> 'id'; st text := coalesce(p_order ->> 'status', '');
begin
  if oid is null or char_length(oid) not between 4 and 80 then raise exception 'YC_ORDER'; end if;
  begin
    uid := coalesce(nullif(p_order -> 'customer' ->> 'external_id', ''), nullif(p_order -> 'metadata' ->> 'user_id', ''))::uuid;
  exception when others then uid := null;
  end;
  if uid is null or not exists (select 1 from auth.users u where u.id = uid) then
    return jsonb_build_object('ok', false, 'why', 'no player');
  end if;
  insert into yamb.orders as o (id, user_id, env, status, net, tax, total, refunded, currency, paid_at, updated_at)
  values (oid, uid, case when p_env = 'live' then 'live' else 'sandbox' end, st,
          coalesce((p_order ->> 'net_amount')::integer, 0), coalesce((p_order ->> 'tax_amount')::integer, 0),
          coalesce((p_order ->> 'total_amount')::integer, 0), coalesce((p_order ->> 'refunded_amount')::integer, 0),
          lower(coalesce(p_order ->> 'currency', 'eur')), coalesce((p_order ->> 'created_at')::timestamptz, now()), now())
  on conflict (id) do update set status = excluded.status, refunded = greatest(o.refunded, excluded.refunded),
    net = excluded.net, tax = excluded.tax, total = excluded.total, updated_at = now();
  return jsonb_build_object('ok', true) || yamb.plus_of(uid);
end $$;

revoke all on function yamb.plus_of(uuid) from public, anon, authenticated;
revoke all on function yamb.has_plus(uuid) from public, anon, authenticated;
revoke all on function public.my_plus(), public.yamb_order(jsonb, text), public.set_wall(boolean), public.regulars_wall() from public, anon, authenticated;
grant execute on function public.my_plus(), public.set_wall(boolean) to authenticated;
grant execute on function public.regulars_wall() to anon, authenticated;
grant execute on function public.yamb_order(jsonb, text) to service_role;
-- ---------------------------------------------------------------- friends' tables (Stol prijatelja) and the Šef sale badge
-- A friends' table is a small private league for the Daily Yamb: the people at it see each other's Daily scores for the
-- day and the week, and nobody else does. Every member has an invite code of their own for the table. Whoever first
-- brings a player in through their code is remembered, once; three such friends who keep playing (at least three
-- finished games a week, three weeks in a row) earn the inviter the Šef sale badge. Plus is never given for inviting.
create or replace function yamb.clean_text(p text, n integer) returns text
language sql immutable set search_path = '' as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'), '[\u0001-\u001F\u007F<>]', '', 'g')), n)
$$;

-- six letters and digits that can't be mixed up (no I, O, 0 or 1), not used by any other seat
create or replace function yamb.new_ref() returns text
language plpgsql volatile set search_path = '' as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; r text;
begin
  loop
    r := '';
    for i in 1..6 loop r := r || substr(a, 1 + floor(random() * 32)::integer, 1); end loop;
    exit when not exists (select 1 from yamb.friend_seats s where s.ref = r);
  end loop;
  return r;
end $$;

-- the longest run of weeks in a row (Monday to Sunday, UTC) with at least three finished games, from the week they came
create or replace function yamb.kept_weeks(p_user uuid, p_since timestamptz) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(max(z.n), 0)::integer from (
    select count(*) as n from (
      select w.wk - (row_number() over (order by w.wk))::integer * 7 as grp
      from (select (date_trunc('week', r.finished_at at time zone 'utc'))::date as wk
            from public.results r
            where r.user_id = p_user and r.finished_at >= (date_trunc('week', p_since at time zone 'utc') at time zone 'utc')
            group by 1 having count(*) >= 3) w) g
    group by g.grp) z
$$;

create or replace function yamb.host_progress(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'badge', exists (select 1 from yamb.badges b where b.user_id = p_user and b.badge = 'host'),
    'friends', coalesce((select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.name, ''), ''), 'avatar', p.avatar,
                                  'weeks', least(yamb.kept_weeks(i.user_id, i.at), 3)) order by i.at)
                         from yamb.invites i left join public.profiles p on p.id = i.user_id
                         where i.invited_by = p_user), '[]'::jsonb))
$$;

-- gives the badge once three friends have kept playing; once earned it stays
create or replace function yamb.check_host(p_user uuid) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  if p_user is null then return false; end if;
  if exists (select 1 from yamb.badges b where b.user_id = p_user and b.badge = 'host') then return true; end if;
  if (select count(*) from yamb.invites i where i.invited_by = p_user and yamb.kept_weeks(i.user_id, i.at) >= 3) >= 3 then
    insert into yamb.badges (user_id, badge) values (p_user, 'host') on conflict do nothing;
    return true;
  end if;
  return false;
end $$;

-- the player's tables (with how many played that day and their own place), and their way to Šef sale
create or replace function public.my_friend_tables(p_day date) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := auth.uid(); mine integer;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  perform yamb.check_host(me);
  select d.score into mine from public.daily_scores d where d.user_id = me and d.day = p_day;
  return jsonb_build_object(
    'tables', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'ref', s.ref, 'owner', coalesce(t.owner = me, false),
               'seats', (select count(*) from yamb.friend_seats x where x.table_id = t.id),
               'played', (select count(*) from yamb.friend_seats x join public.daily_scores d on d.user_id = x.user_id and d.day = p_day
                          where x.table_id = t.id),
               'mine', mine,
               'place', case when mine is null then null else 1 + (select count(*) from yamb.friend_seats x
                          join public.daily_scores d on d.user_id = x.user_id and d.day = p_day
                          where x.table_id = t.id and d.score > mine) end)
             order by s.joined_at)
      from yamb.friend_seats s join yamb.friend_tables t on t.id = s.table_id where s.user_id = me), '[]'::jsonb),
    'host', yamb.host_progress(me));
end $$;

create or replace function public.make_friend_table(p_name text, p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); nm text := yamb.clean_text(p_name, 24); tid uuid;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  if nm = '' then raise exception 'YC_NAME'; end if;
  if (select count(*) from yamb.friend_seats s where s.user_id = me) >= 5 then raise exception 'YC_TOOMANY'; end if;
  insert into public.profiles (id) values (me) on conflict do nothing;
  insert into yamb.friend_tables (name, owner) values (nm, me) returning id into tid;
  insert into yamb.friend_seats (table_id, user_id, ref) values (tid, me, yamb.new_ref());
  return public.my_friend_tables(p_day) || jsonb_build_object('made', tid);
end $$;

-- what an invite link opens: the table's name, who invites, how many sit there (anyone may ask, with the code)
create or replace function public.peek_friend_table(p_ref text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', t.name, 'by', coalesce(nullif(p.name, ''), ''), 'avatar', p.avatar,
                            'seats', (select count(*) from yamb.friend_seats x where x.table_id = t.id))
  from yamb.friend_seats s join yamb.friend_tables t on t.id = s.table_id left join public.profiles p on p.id = s.user_id
  where s.ref = upper(btrim(coalesce(p_ref, '')))
$$;

create or replace function public.join_friend_table(p_ref text, p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); tid uuid; inviter uuid;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  select x.table_id, x.user_id into tid, inviter from yamb.friend_seats x where x.ref = upper(btrim(coalesce(p_ref, '')));
  if tid is null then raise exception 'YC_NOTABLE'; end if;
  if not exists (select 1 from yamb.friend_seats x where x.table_id = tid and x.user_id = me) then
    if (select count(*) from yamb.friend_seats x where x.user_id = me) >= 5 then raise exception 'YC_TOOMANY'; end if;
    if (select count(*) from yamb.friend_seats x where x.table_id = tid) >= 30 then raise exception 'YC_FULL'; end if;
    insert into public.profiles (id) values (me) on conflict do nothing;
    insert into yamb.friend_seats (table_id, user_id, ref) values (tid, me, yamb.new_ref());
    if inviter <> me then insert into yamb.invites (user_id, invited_by) values (me, inviter) on conflict do nothing; end if;
  end if;
  return public.my_friend_tables(p_day) || jsonb_build_object('joined', tid);
end $$;

-- one table's Daily for the day and the week, for the people at it only
create or replace function public.friend_table_board(p_table uuid, p_day date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); mon date := date_trunc('week', p_day::timestamp)::date;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  if not exists (select 1 from yamb.friend_seats s where s.table_id = p_table and s.user_id = me) then raise exception 'YC_NOTABLE'; end if;
  return (select jsonb_build_object('id', t.id, 'name', t.name, 'owner', coalesce(t.owner = me, false), 'day', p_day, 'from', mon, 'to', mon + 6,
    'ref', (select s.ref from yamb.friend_seats s where s.table_id = t.id and s.user_id = me),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.name, ''), ''), 'avatar', p.avatar, 'me', s.user_id = me,
               'today', d.score, 'week', w.total, 'days', coalesce(w.days, 0),
               'host', exists (select 1 from yamb.badges b where b.user_id = s.user_id and b.badge = 'host'),
               'plus', coalesce(p.wall, false) and yamb.has_plus(s.user_id),
               'pin', coalesce(p.wall, false) and coalesce((yamb.plus_of(s.user_id) ->> 'pin')::boolean, false))
             order by d.score desc nulls last, w.total desc nulls last, s.joined_at)
      from yamb.friend_seats s
      left join public.profiles p on p.id = s.user_id
      left join public.daily_scores d on d.user_id = s.user_id and d.day = p_day
      left join lateral (select sum(x.score)::integer as total, count(*)::integer as days from public.daily_scores x
                         where x.user_id = s.user_id and x.day between mon and mon + 6) w on true
      where s.table_id = t.id), '[]'::jsonb))
    from yamb.friend_tables t where t.id = p_table);
end $$;

-- getting up from a table: the oldest player left takes it over; an empty table is cleared away
create or replace function public.leave_friend_table(p_table uuid, p_day date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  delete from yamb.friend_seats s where s.table_id = p_table and s.user_id = me;
  update yamb.friend_tables t set owner = (select s.user_id from yamb.friend_seats s where s.table_id = t.id order by s.joined_at limit 1)
  where t.id = p_table and (t.owner = me or t.owner is null);
  delete from yamb.friend_tables t where t.id = p_table and not exists (select 1 from yamb.friend_seats s where s.table_id = t.id);
  return public.my_friend_tables(p_day);
end $$;

-- a gift link: Plus for the account that opens it, while the code has uses left and has not run out
create or replace function public.redeem_gift(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); c text := upper(btrim(coalesce(p_code, ''))); w text;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  if yamb.has_plus(me) then return yamb.plus_of(me) || jsonb_build_object('had', true); end if;
  update yamb.gift_codes g set uses_left = g.uses_left - 1
  where g.code = c and g.uses_left > 0 and (g.until is null or g.until >= (now() at time zone 'utc')::date)
  returning g.why into w;
  if w is null then raise exception 'YC_GIFT'; end if;
  insert into public.profiles (id) values (me) on conflict do nothing;
  insert into yamb.plus_gifts (user_id, why) values (me, left('gift ' || c || ': ' || w, 80)) on conflict do nothing;
  return yamb.plus_of(me);
end $$;

revoke all on function yamb.clean_text(text, integer), yamb.new_ref(), yamb.kept_weeks(uuid, timestamptz), yamb.host_progress(uuid),
  yamb.check_host(uuid) from public, anon, authenticated;
revoke all on function public.my_friend_tables(date), public.make_friend_table(text, date), public.peek_friend_table(text),
  public.join_friend_table(text, date), public.friend_table_board(uuid, date), public.leave_friend_table(uuid, date),
  public.redeem_gift(text) from public, anon, authenticated;
grant execute on function public.my_friend_tables(date), public.make_friend_table(text, date), public.join_friend_table(text, date),
  public.friend_table_board(uuid, date), public.leave_friend_table(uuid, date), public.redeem_gift(text) to authenticated;
grant execute on function public.peek_friend_table(text) to anon, authenticated;
-- a gift link for testers (pick your own code; the link is then yambcafe.com/?dar=THE-CODE):
--   insert into yamb.gift_codes (code, why, uses_left, until) values ('THE-CODE', 'tester', 25, '2027-01-10');
-- to give a tester Plus (their account id is on the Numbers page or in Authentication → Users):
--   insert into yamb.plus_gifts (user_id, why) values ('<account id>', 'tester') on conflict do nothing;

notify pgrst, 'reload schema';
select 'Yamb Café database is ready' as result;
