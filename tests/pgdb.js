// A small Postgres inside Node (PGlite) dressed up like a Supabase project: the auth schema, the three roles and the
// default privileges Supabase gives them. server/schema.sql runs on it unchanged, so the real script is what gets tested.
const fs=require('fs'),path=require('path');
const STUB=`
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}', created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;
async function open(){
  const {PGlite}=await import('@electric-sql/pglite');
  const db=new PGlite();
  await db.exec(STUB);
  const schema=fs.readFileSync(path.join(__dirname,'..','server','schema.sql'),'utf8');
  await db.exec(schema);
  await db.exec(schema);            // the script must be safe to run twice
  let chain=Promise.resolve();
  // run one statement as a signed-in player (uid), or as a visitor (uid null), the way the Supabase API would
  function as(uid,sql,params){
    const run=async()=>{
      await db.query(`select set_config('request.jwt.claims', $1, false)`,[uid?JSON.stringify({sub:uid,role:'authenticated'}):'']);
      await db.exec(`set role ${uid?'authenticated':'anon'}`);
      try{return await db.query(sql,params||[]);}
      finally{await db.exec('reset role');await db.query(`select set_config('request.jwt.claims', '', false)`);}
    };
    const p=chain.then(run,run);chain=p.catch(()=>{});return p;
  }
  const admin=(sql,params)=>{const run=()=>db.query(sql,params||[]);const p=chain.then(run,run);chain=p.catch(()=>{});return p;};
  async function addUser(email,name){
    const id=require('crypto').randomUUID();
    await admin(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,[id,email,JSON.stringify({full_name:name,name})]);
    return id;
  }
  return{db,as,admin,addUser};
}
module.exports={open};
