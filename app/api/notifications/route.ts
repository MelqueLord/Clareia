import {env} from 'cloudflare:workers';
import {getFinanceUser,tokenHash} from '../../../lib/session';
import {validPushEndpoint,sendPush} from '../../../lib/push';
import {getAccountAccess} from '../../../lib/trial';
const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(req:Request){const user=await getFinanceUser(req);if(!user||user.mustChangePassword)return reply({error:'Altere sua senha primeiro.'},401);return reply({ready:!!(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_JWK),publicKey:env.VAPID_PUBLIC_KEY||null,subscriptions:env.DB?(await env.DB.prepare('SELECT id,frequency FROM push_subscriptions WHERE user_id=?').bind(user.userId).all()).results:[]});}
export async function POST(req:Request){
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin||!req.headers.get('content-type')?.includes('application/json'))return reply({error:'Origem inválida.'},403);
 const user=await getFinanceUser(req);if(!user||user.mustChangePassword||!env.DB)return reply({error:'Sessão necessária.'},401);
 if(!user.isTest&&!(await getAccountAccess(user.authUserId!)).canUse)return reply({error:'Seu teste grátis terminou. Assine para reativar os recursos.',code:'TRIAL_EXPIRED'},402);
 try{const raw=await req.text();if(raw.length>5000)return reply({error:'Dados inválidos.'},400);const {endpoint,frequency,action}=JSON.parse(raw);if(typeof endpoint!=='string'||endpoint.length>3000||!validPushEndpoint(endpoint))return reply({error:'Serviço push não suportado.'},400);const id=await tokenHash(endpoint);
 if(action==='unsubscribe'){await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=? AND user_id=?').bind(id,user.userId).run();return reply({ok:true});}
 if(action==='test'){const row=await env.DB.prepare('SELECT attempt_at FROM push_subscriptions WHERE id=? AND user_id=?').bind(id,user.userId).first<{attempt_at:string}>();if(!row)return reply({error:'Ative primeiro as notificações.'},400);if(row.attempt_at>new Date(Date.now()-60000).toISOString())return reply({error:'Aguarde um minuto antes de testar novamente.'},429);await env.DB.prepare('UPDATE push_subscriptions SET attempt_at=? WHERE id=?').bind(new Date().toISOString(),id).run();const r=await sendPush(endpoint);return reply(r.ok?{ok:true}:{error:'O serviço push não aceitou o teste.'},r.ok?200:502);}
 if(!['daily','weekly'].includes(frequency))return reply({error:'Escolha a frequência.'},400);
 const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=? AND id<>?').bind(user.userId,id).first<{n:number}>();if((count?.n||0)>=10)return reply({error:'Limite de dez aparelhos por conta.'},400);
 await env.DB.prepare('INSERT INTO push_subscriptions(id,user_id,endpoint,frequency,last_digest,last_sent,last_week,attempt_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,frequency=excluded.frequency,last_digest=CASE WHEN push_subscriptions.user_id=excluded.user_id THEN push_subscriptions.last_digest ELSE excluded.last_digest END').bind(id,user.userId,endpoint,frequency,'','','','').run();return reply({ok:true});
 }catch{return reply({error:'Não foi possível atualizar as notificações.'},500);}
}
