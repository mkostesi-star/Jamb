-- Yamb Café: accounts, records and Daily Yamb high scores.
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
                                          'me', coalesce(r.user_id = me, false))
                       order by r.score desc, r.created_at)
      from (select s.user_id, s.score, s.created_at, coalesce(p.name, '') as name, p.avatar,
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
                                          'days', r.days, 'me', coalesce(r.user_id = me, false))
                       order by r.total desc, r.last_at)
      from (select w.user_id, w.total, w.days, w.last_at, coalesce(p.name, '') as name, p.avatar,
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
    'profile', (select jsonb_build_object('name', p.name, 'avatar', p.avatar, 'since', p.created_at)
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
    'daily_best', (select max(s.score) from public.daily_scores s where s.user_id = me));
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
  end if;
  return public.my_state();
end $$;

create or replace function public.save_profile(p_name text, p_avatar text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); nm text := yamb.clean_name(p_name);
        av text := case when p_avatar ~ '^[a-z0-9_-]{1,24}$' then p_avatar else null end;
begin
  if me is null then raise exception 'YC_SIGNIN'; end if;
  insert into public.profiles (id, name, avatar) values (me, nm, av)
  on conflict (id) do update set name = excluded.name, avatar = excluded.avatar, updated_at = now();
  return (select jsonb_build_object('name', p.name, 'avatar', p.avatar, 'since', p.created_at) from public.profiles p where p.id = me);
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

notify pgrst, 'reload schema';
select 'Yamb Café database is ready' as result;
