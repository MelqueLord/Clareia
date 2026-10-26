import { env } from 'cloudflare:workers';
import { sessionCookie, tokenHash } from '../../../lib/session';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});
function allowed(req:Request){return !req.headers.get('origin')||req.headers.get('origin')===new URL(req.url).origin;}
export async function POST(req:Request){
 if(!allowed(req))return reply({error:'Origem inválida.'},403);
 return reply({error:'A demonstração compartilhada foi encerrada. Crie seu próprio acesso grátis para testar.'},410);
}
export async function DELETE(req:Request){
 if(!allowed(req))return reply({error:'Origem inválida.'},403);
 const token=req.headers.get('cookie')?.match(/(?:^|;\s*)clareia_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 if(token&&env.DB)await env.DB.prepare('DELETE FROM test_sessions WHERE token_hash=?').bind(await tokenHash(token)).run();
 return reply({ok:true},200,sessionCookie(req,'',0));
}
