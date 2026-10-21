import {sessionCookie} from '../../../../lib/session';
export async function GET(req:Request){return new Response(null,{status:302,headers:{Location:'/signin-with-chatgpt?return_to=/','Set-Cookie':sessionCookie(req,'',0),'Cache-Control':'no-store'}});}
