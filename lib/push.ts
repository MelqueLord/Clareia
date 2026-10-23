import {env} from 'cloudflare:workers';
import {analyze} from './engine';
import {today} from './model';
import type {FinanceData} from './model';
import {tokenHash} from './session';
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export function validPushEndpoint(endpoint:string){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&(/(^|\.)push\.services\.mozilla\.com$/.test(u.hostname)||u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='web.push.apple.com'||/\.notify\.windows\.com$/.test(u.hostname));}catch{return false;}}
export async function sendPush(endpoint:string){
 if(!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_JWK||!validPushEndpoint(endpoint))throw new Error('Push indisponível.');
 const enc=(v:unknown)=>encode(new TextEncoder().encode(JSON.stringify(v))),unsigned=enc({typ:'JWT',alg:'ES256'})+'.'+enc({aud:new URL(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:'https://clareia-financas-mei-pf.igrejamirc01.chatgpt.site'});
 const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE_JWK),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(unsigned));
 return await fetch(endpoint,{method:'POST',headers:{Authorization:`vapid t=${unsigned}.${encode(new Uint8Array(signature))}, k=${env.VAPID_PUBLIC_KEY}`,TTL:'86400',Urgency:'normal'},redirect:'error',signal:AbortSignal.timeout(8000)});
}
export function notificationDecision(data:FinanceData,frequency:string,lastDigest:string,lastSent:string,lastWeek:string,asOf:string){
 const weekday=new Date(asOf+'T12:00:00Z').getUTCDay(),monday=new Date(Date.parse(asOf+'T12:00:00Z')-((weekday+6)%7)*86400000).toISOString().slice(0,10);
 const active=(['pf','mei'] as const).flatMap(s=>analyze(data,s,asOf).filter(a=>a.level!=='info').map(a=>`${s}:${a.id}:${a.level}:${a.detail}`)).sort();
 const digest=JSON.stringify(active),weekly=weekday===1&&lastWeek!==monday;
 return {send:lastSent!==asOf&&(weekly||frequency==='daily'&&active.length>0&&digest!==lastDigest),digest,weekly,week:monday};
}
export async function runNotifications(){
 if(!env.DB||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_JWK)return {ready:false,sent:0};
 const now=new Date(),asOf=today(),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'America/Bahia',hour:'2-digit',hour12:false}).format(now));
 if(hour<9||hour>=20)return {ready:true,sent:0,quietHours:true};
 const stamp=now.toISOString();const lock=await env.DB.prepare('INSERT INTO job_locks(id,until_at) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET until_at=excluded.until_at WHERE job_locks.until_at<? RETURNING id').bind('notifications',new Date(Date.now()+60000).toISOString(),stamp).first();if(!lock)return {ready:true,sent:0,busy:true};
 const rows=await env.DB.prepare("SELECT s.*,d.payload FROM push_subscriptions s JOIN finance_documents d ON d.user_id=s.user_id JOIN account_access a ON a.user_id=substr(s.user_id,10,instr(substr(s.user_id,10),':')-1) WHERE s.last_sent<>? AND s.attempt_at<? AND ((a.status='trialing' AND a.trial_ends_at>?) OR (a.status='active' AND (a.billing_period_ends_at IS NULL OR a.billing_period_ends_at>?))) ORDER BY s.attempt_at LIMIT 100").bind(asOf,new Date(Date.now()-3600000).toISOString(),Date.now(),Date.now()).all<{id:string;user_id:string;endpoint:string;frequency:string;last_digest:string;last_sent:string;last_week:string;payload:string}>();
 let sent=0,failed=0;
 for(const row of rows.results){const claim=await env.DB.prepare('UPDATE push_subscriptions SET attempt_at=? WHERE id=? AND attempt_at<?').bind(stamp,row.id,new Date(Date.now()-3600000).toISOString()).run();if(!claim.meta.changes)continue;const d=notificationDecision(JSON.parse(row.payload),row.frequency,row.last_digest,row.last_sent,row.last_week,asOf);if(!d.send)continue;try{const res=await sendPush(row.endpoint);if(res.ok){await env.DB.prepare('UPDATE push_subscriptions SET last_digest=?,last_sent=?,last_week=? WHERE id=?').bind(d.digest,asOf,d.weekly?d.week:row.last_week,row.id).run();sent++;}else if([404,410].includes(res.status)){await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(row.id).run();}else failed++;}catch{failed++;}}
 return {ready:true,processed:rows.results.length,sent,failed};
}
export {tokenHash};
