import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../app/chatgpt-auth';
import type { Space } from './model';
export async function tokenHash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');}
export async function getFinanceUser(req:Request){
 const token=req.headers.get('cookie')?.match(/(?:^|;\s*)clareia_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(token&&env.DB){const test=await env.DB.prepare('SELECT user_id AS userId,display_name AS displayName,email,space AS defaultSpace FROM test_sessions WHERE token_hash=? AND expires_at>?').bind(await tokenHash(token),new Date().toISOString()).first<{userId:string;displayName:string;email:string;defaultSpace:Space}>();if(test)return {...test,isTest:true};}
 const user=await getChatGPTUser();if(!user)return null;
 const rawSpace=req.headers.get('cookie')?.match(/(?:^|;\s*)clareia_space=(pf|mei)(?:;|$)/)?.[1];
 const space:Space=rawSpace==='mei'?'mei':'pf';
 return {...user,userId:'personal:'+user.userId+':'+space,legacyUserId:'personal:'+user.userId,defaultSpace:space,isTest:false};
}
export function sessionCookie(req:Request,token:string,age=86400){return 'clareia_session='+token+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+(new URL(req.url).protocol==='https:'?'; Secure':'');}
export function spaceCookie(req:Request,space:Space,age=31536000){return 'clareia_space='+space+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+age+(new URL(req.url).protocol==='https:'?'; Secure':'');}
