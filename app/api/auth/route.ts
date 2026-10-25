import { env } from 'cloudflare:workers';
import { demoData } from '../../../lib/demo';
import { today } from '../../../lib/model';
import { sessionCookie,tokenHash } from '../../../lib/session';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
function allowed(req:Request){return !req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;}
async function demoRateLimitExceeded(req:Request){
 const ip=req.headers.get('cf-connecting-ip');
 if(!ip||!env.DB||!env.BETTER_AUTH_SECRET)return false;
 const hmacKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.BETTER_AUTH_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const digest=new Uint8Array(await crypto.subtle.sign('HMAC',hmacKey,new TextEncoder().encode(ip)));
 const key='demo-login:'+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 const now=Date.now(),windowMs=15*60*1000;
 const row=await env.DB.prepare(`INSERT INTO rate_limit(id,key,count,last_request) VALUES(?,?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN last_request<=? THEN 1 ELSE MIN(count+1,21) END,last_request=? RETURNING count`).bind(key,key,now,now-windowMs,now).first<{count:number}>();
 if(row?.count===1)await env.DB.prepare("DELETE FROM rate_limit WHERE key LIKE 'demo-login:%' AND last_request<?").bind(now-86400000).run();
 return (row?.count||0)>20;
}
export async function POST(req:Request){
 if(!allowed(req)||!req.headers.get('content-type')?.includes('application/json'))return reply({error:'Origem inválida.'},403);
 if(!env.DB)return reply({error:'Serviço temporariamente indisponível.'},503);
 try{
  if(await demoRateLimitExceeded(req))return reply({error:'Muitas tentativas de demonstração. Aguarde 15 minutos e tente novamente.'},429);
  const raw=await req.text();if(raw.length>1000)return reply({error:'Dados inválidos.'},400);
  const {username,password}=JSON.parse(raw);
  const space=username==='pf@teste.clareia.app'?'pf':username==='mei@teste.clareia.app'?'mei':null;
  // Public demonstration credentials, deliberately displayed on the login page.
  if(!space||password!=='Clareia2026!')return reply({error:'E-mail ou senha de teste incorretos.'},401);
  const userId='test_'+space,name=space==='pf'?'Marina Costa':'Rafael · Studio MEI';
  const data=demoData(today());data.accounts=data.accounts.filter(a=>a.space===space);data.cards=data.cards.filter(c=>c.space===space);data.transactions=data.transactions.filter(t=>t.space===space);data.budgets=data.budgets.filter(b=>b.space===space);
  data.preferences[space==='pf'?'mei':'pf']={floor:null,complete:false,checkedOn:''};
  const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),now=new Date().toISOString();
  await env.DB.batch([
   env.DB.prepare('INSERT INTO finance_documents(user_id,payload,revision,mutation_id,updated_at) VALUES(?,?,1,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,revision=finance_documents.revision+1,mutation_id=excluded.mutation_id,updated_at=excluded.updated_at').bind(userId,JSON.stringify(data),crypto.randomUUID(),now),
   env.DB.prepare('INSERT INTO test_sessions(token_hash,user_id,display_name,email,space,expires_at) VALUES(?,?,?,?,?,?)').bind(await tokenHash(token),userId,name,username,space,new Date(Date.now()+86400000).toISOString()),
   env.DB.prepare('DELETE FROM test_sessions WHERE expires_at<?').bind(now)
  ]);
  return reply({ok:true},200,sessionCookie(req,token));
 }catch{return reply({error:'Não foi possível entrar. Tente novamente.'},500);}
}
export async function DELETE(req:Request){
 if(!allowed(req))return reply({error:'Origem inválida.'},403);
 const token=req.headers.get('cookie')?.match(/(?:^|;\s*)clareia_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(token&&env.DB)await env.DB.prepare('DELETE FROM test_sessions WHERE token_hash=?').bind(await tokenHash(token)).run();
 return reply({ok:true},200,sessionCookie(req,'',0));
}
