// A stand-in for the game's Supabase project, for tests: the sign-in endpoints the Supabase library talks to, and
// /rest/v1/rpc/<function> answered by server/schema.sql itself, running on a local Postgres (see pgdb.js).
// "Google" here signs in whoever the test names with POST /__test/next {email,name} before the Sign in button is pressed.
const http=require('http'),crypto=require('crypto');
const {open}=require('./pgdb.js');
const b64u=b=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64u=s=>Buffer.from(String(s).replace(/-/g,'+').replace(/_/g,'/'),'base64').toString('utf8');
async function start(port){
  const S=await open();
  const codes=new Map(),refresh=new Map(),calls=[];
  let next={email:'tester@example.com',name:'Test Player'},down=false,ttl=3600;
  const token=u=>b64u(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+b64u(JSON.stringify({sub:u.id,aud:'authenticated',role:'authenticated',email:u.email,exp:Math.floor(Date.now()/1000)+ttl,iat:Math.floor(Date.now()/1000)}))+'.'+b64u('test-signature');
  const userJson=u=>({id:u.id,aud:'authenticated',role:'authenticated',email:u.email,email_confirmed_at:u.created,phone:'',confirmed_at:u.created,last_sign_in_at:new Date().toISOString(),
    app_metadata:{provider:'google',providers:['google']},
    user_metadata:{avatar_url:'',email:u.email,email_verified:true,full_name:u.name,iss:'https://accounts.google.com',name:u.name,phone_verified:false,picture:'',provider_id:'1',sub:'1'},
    identities:[],created_at:u.created,updated_at:u.created,is_anonymous:false});
  function sessionJson(u){
    const rt=b64u(crypto.randomBytes(9));refresh.set(rt,u.id);
    return{access_token:token(u),token_type:'bearer',expires_in:ttl,expires_at:Math.floor(Date.now()/1000)+ttl,refresh_token:rt,user:userJson(u)};
  }
  async function userByEmail(email,name){
    const r=await S.admin('select id, email, raw_user_meta_data as m, created_at from auth.users where email = $1',[email]);
    if(r.rows[0])return{id:r.rows[0].id,email,name:r.rows[0].m.full_name||name,created:new Date(r.rows[0].created_at).toISOString()};
    const id=await S.addUser(email,name);return{id,email,name,created:new Date().toISOString()};
  }
  async function userById(id){
    const r=await S.admin('select id, email, raw_user_meta_data as m, created_at from auth.users where id = $1',[id]);
    return r.rows[0]?{id,email:r.rows[0].email,name:r.rows[0].m.full_name,created:new Date(r.rows[0].created_at).toISOString()}:null;
  }
  function bearer(req){
    const a=req.headers.authorization||'',m=a.match(/^Bearer\s+(.+)$/i);if(!m)return null;
    const parts=m[1].split('.');if(parts.length!==3)return null;       // the publishable key, sent when nobody is signed in
    try{const p=JSON.parse(unb64u(parts[1]));return p.exp*1000>Date.now()?p.sub:'expired';}catch(e){return null;}
  }
  const CORS={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','access-control-max-age':'600'};
  const send=(res,code,obj,extra)=>{const body=obj==null?'':JSON.stringify(obj);res.writeHead(code,Object.assign({'content-type':'application/json'},CORS,extra||{}));res.end(body);};
  const readBody=req=>new Promise(r=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{try{r(b?JSON.parse(b):{});}catch(e){r({});}});});
  const server=http.createServer(async(req,res)=>{
    try{
      const u=new URL(req.url,'http://x'),p=u.pathname;
      if(req.method==='OPTIONS'){res.writeHead(204,CORS);res.end();return;}
      if(p==='/__test/next'){next=await readBody(req);send(res,200,{ok:true});return;}
      if(p==='/__test/down'){down=(await readBody(req)).down;send(res,200,{ok:true});return;}
      if(p==='/__test/ttl'){ttl=(await readBody(req)).ttl;send(res,200,{ok:true});return;}
      if(p==='/__test/calls'){send(res,200,calls);return;}
      if(p==='/__test/sql'){const b=await readBody(req);const r=await S.admin(b.sql,b.params||[]);send(res,200,r.rows);return;}
      if(down){res.destroy();return;}
      if(!req.headers.apikey&&!p.startsWith('/auth/v1/authorize')){send(res,401,{message:'No API key found in request'});return;}
      // ---- sign-in
      if(p==='/auth/v1/authorize'){
        if(u.searchParams.get('provider')!=='google'||!u.searchParams.get('code_challenge')||u.searchParams.get('code_challenge_method')!=='s256'){send(res,400,{message:'bad authorize request'});return;}
        const back=new URL(u.searchParams.get('redirect_to'));
        if(next&&next.deny){back.searchParams.set('error','access_denied');back.searchParams.set('error_description','The user denied access');}
        else{
          const usr=await userByEmail(next.email,next.name),code=b64u(crypto.randomBytes(12));
          codes.set(code,{uid:usr.id,challenge:u.searchParams.get('code_challenge')});back.searchParams.set('code',code);
        }
        res.writeHead(302,Object.assign({location:back.toString()},CORS));res.end();return;
      }
      if(p==='/auth/v1/token'&&req.method==='POST'){
        const b=await readBody(req),grant=u.searchParams.get('grant_type');
        if(grant==='pkce'){
          const c=codes.get(b.auth_code);codes.delete(b.auth_code);
          const ch=b.code_verifier?b64u(crypto.createHash('sha256').update(b.code_verifier).digest()):'';
          if(!c||ch!==c.challenge){send(res,400,{code:'flow_state_not_found',message:'invalid flow state, no valid flow state found',error_code:'flow_state_not_found',msg:'invalid flow state'});return;}
          send(res,200,sessionJson(await userById(c.uid)));return;
        }
        if(grant==='refresh_token'){
          const id=refresh.get(b.refresh_token);refresh.delete(b.refresh_token);const usr=id&&await userById(id);
          if(!usr){send(res,400,{code:'refresh_token_not_found',error_code:'refresh_token_not_found',message:'Invalid Refresh Token: Refresh Token Not Found',msg:'Invalid Refresh Token'});return;}
          calls.push('refresh');send(res,200,sessionJson(usr));return;
        }
        send(res,400,{message:'unsupported grant'});return;
      }
      if(p==='/auth/v1/user'){const id=bearer(req),usr=id&&id!=='expired'&&await userById(id);if(!usr){send(res,401,{message:'invalid JWT'});return;}send(res,200,userJson(usr));return;}
      if(p==='/auth/v1/logout'){res.writeHead(204,CORS);res.end();return;}
      // ---- database functions, the way PostgREST calls them: arguments by name, cast to the function's own types
      const m=p.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if(m&&req.method==='POST'){
        const args=await readBody(req),uid=bearer(req);
        if(uid==='expired'){send(res,401,{code:'PGRST303',message:'JWT expired'});return;}
        const f=await S.admin(`select p.proargnames as names, (select array_agg(format_type(x, null) order by o) from unnest(p.proargtypes) with ordinality t(x, o)) as types
                               from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`,[m[1]]);
        if(!f.rows[0]){send(res,404,{code:'PGRST202',message:`Could not find the function public.${m[1]} in the schema cache`});return;}
        const names=f.rows[0].names||[],types=f.rows[0].types||[],vals=[];
        const list=names.map((n,i)=>{const v=args[n];vals.push(v==null?null:(typeof v==='object'?JSON.stringify(v):String(v)));return `"${n}" => $${i+1}::${types[i]}`;});
        calls.push(m[1]);
        try{const r=await S.as(uid,`select public.${m[1]}(${list.join(', ')}) as r`,vals);send(res,200,r.rows[0].r);}
        catch(e){const denied=/permission denied/.test(e.message);send(res,denied?(uid?403:401):400,{code:denied?'42501':(e.code||'P0001'),message:e.message,details:null,hint:null});}
        return;
      }
      send(res,404,{message:'not found: '+p});
    }catch(e){try{send(res,500,{message:String(e&&e.message||e)});}catch(_){}}
  });
  await new Promise(r=>server.listen(port,'127.0.0.1',r));
  return{S,url:'http://127.0.0.1:'+port,close(){server.close();},calls};
}
module.exports={start};
if(require.main===module)start(+process.env.CLOUD_PORT||9021).then(s=>console.log('stand-in Supabase on '+s.url));
