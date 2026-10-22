import { sessionCookie,spaceCookie } from '../../../../lib/session';
export async function GET(req:Request){
 const space=new URL(req.url).searchParams.get('space');
 if(space!=='pf'&&space!=='mei')return Response.json({error:'Escolha Pessoa física ou MEI antes de entrar.'},{status:400,headers:{'Cache-Control':'no-store'}});
 const headers=new Headers({Location:'/', 'Cache-Control':'no-store'});
 headers.append('Set-Cookie',sessionCookie(req,'',0));
 headers.append('Set-Cookie',spaceCookie(req,space));
 return new Response(null,{status:303,headers});
}
