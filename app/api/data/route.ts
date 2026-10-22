import { env } from 'cloudflare:workers';
import { getFinanceUser } from '../../../lib/session';
import { emptyData } from '../../../lib/model';
import type { FinanceData, Space } from '../../../lib/model';
import { saveSchema } from '../../../lib/validation';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
function allowed(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
function scopedData(data:FinanceData,space:Space,mirrorIncoming=false):FinanceData{
 const defaults=emptyData(),accounts=(data.accounts||[]).filter(a=>a.space===space),cards=(data.cards||[]).filter(c=>c.space===space);
 const transactions=(data.transactions||[]).filter(t=>t.space===space).map(t=>{
  if(t.type!=='transfer')return t;
  const destination=data.accounts?.find(a=>a.id===t.toAccountId);
  return destination&&destination.space!==space?{...t,toAccountId:'external:'+destination.space}:t;
 });
 if(mirrorIncoming)for(const t of data.transactions||[]){
  if(t.type!=='transfer'||t.space===space)continue;
  const destination=data.accounts?.find(a=>a.id===t.toAccountId);
  if(destination?.space===space)transactions.push({...t,id:'migrated-'+crypto.randomUUID(),description:'Transferência recebida · '+t.description,type:'income',category:'Transferências recebidas',accountId:destination.id,toAccountId:'',cardId:'',space,installments:1,recurring:false});
 }
 return {...defaults,...data,configured:accounts.length>0,accounts,cards,transactions,budgets:(data.budgets||[]).filter(b=>b.space===space),preferences:{...defaults.preferences,[space]:data.preferences?.[space]||defaults.preferences[space]},profiles:{...defaults.profiles,[space]:data.profiles?.[space]||defaults.profiles[space]},dismissed:data.dismissed||[]};
}
async function migrateLegacyUser(legacyUserId:string){
 if(!env.DB)return;
 const legacy=await env.DB.prepare('SELECT payload,revision,mutation_id,updated_at FROM finance_documents WHERE user_id=?').bind(legacyUserId).first<{payload:string;revision:number;mutation_id:string;updated_at:string}>();
 if(!legacy)return;
 const oldData=JSON.parse(legacy.payload) as FinanceData,now=legacy.updated_at;
 const pfId=legacyUserId+':pf',meiId=legacyUserId+':mei';
 const pfData=scopedData(oldData,'pf',true),meiData=scopedData(oldData,'mei',true);
 const statements=[
  env.DB.prepare('INSERT OR IGNORE INTO finance_documents(user_id,payload,revision,mutation_id,updated_at) VALUES(?,?,?,?,?)').bind(pfId,JSON.stringify(pfData),legacy.revision,crypto.randomUUID(),now),
  env.DB.prepare('INSERT OR IGNORE INTO finance_documents(user_id,payload,revision,mutation_id,updated_at) VALUES(?,?,?,?,?)').bind(meiId,JSON.stringify(meiData),legacy.revision,crypto.randomUUID(),now)
 ];
 const snapshots=await env.DB.prepare('SELECT payload,created_at FROM finance_snapshots WHERE user_id=? ORDER BY created_at').bind(legacyUserId).all<{payload:string;created_at:string}>();
 for(const snapshot of snapshots.results){
  const snapshotData=JSON.parse(snapshot.payload) as FinanceData;
  for(const [space,userId] of [['pf',pfId],['mei',meiId]] as const){
   const scoped=scopedData(snapshotData,space,true),snapshotId=userId+':'+snapshot.created_at.slice(0,10);
   statements.push(env.DB.prepare('INSERT OR IGNORE INTO finance_snapshots(id,user_id,payload,created_at) VALUES(?,?,?,?)').bind(snapshotId,userId,JSON.stringify(scoped),snapshot.created_at));
  }
 }
 statements.push(
  env.DB.prepare('DELETE FROM finance_documents WHERE user_id=? AND revision=? AND mutation_id=?').bind(legacyUserId,legacy.revision,legacy.mutation_id),
  env.DB.prepare('DELETE FROM finance_snapshots WHERE user_id=? AND NOT EXISTS (SELECT 1 FROM finance_documents WHERE user_id=?)').bind(legacyUserId,legacyUserId),
  env.DB.prepare('DELETE FROM finance_audit WHERE user_id=? AND NOT EXISTS (SELECT 1 FROM finance_documents WHERE user_id=?)').bind(legacyUserId,legacyUserId),
  env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id=? AND NOT EXISTS (SELECT 1 FROM finance_documents WHERE user_id=?)').bind(legacyUserId,legacyUserId)
 );
 await env.DB.batch(statements);
}
export async function GET(req:Request){
 const user=await getFinanceUser(req);if(!user)return reply({error:'Entre na sua conta para salvar e consultar suas finanças.'},401);if(!env.DB)return reply({error:'Banco de dados indisponível.'},503);
 if(user.mustChangePassword)return reply({error:'Altere sua senha para continuar.',mustChangePassword:true,user:{id:user.authUserId,name:user.displayName,email:user.email,defaultSpace:user.defaultSpace,isTest:false,mustChangePassword:true}},428);
 try{
  let row=await env.DB.prepare('SELECT payload,revision,updated_at FROM finance_documents WHERE user_id=?').bind(user.userId).first<{payload:string;revision:number;updated_at:string}>();
  if(!row&&'legacyUserId'in user){await migrateLegacyUser(user.legacyUserId);row=await env.DB.prepare('SELECT payload,revision,updated_at FROM finance_documents WHERE user_id=?').bind(user.userId).first<{payload:string;revision:number;updated_at:string}>();}
  const audit=await env.DB.prepare('SELECT action,created_at FROM finance_audit WHERE user_id=? ORDER BY created_at DESC LIMIT 20').bind(user.userId).all();
  const data=row?scopedData(JSON.parse(row.payload) as FinanceData,user.defaultSpace):emptyData();
  return reply({data,revision:row?.revision||0,updatedAt:row?.updated_at,user:{id:user.userId,name:user.displayName,email:user.email,defaultSpace:user.defaultSpace,isTest:user.isTest,mustChangePassword:user.mustChangePassword},audit:audit.results});
 }catch{return reply({error:'Não foi possível carregar seus dados. Tente novamente.'},503);}
}
export async function POST(req:Request){
 if(!allowed(req)||!req.headers.get('content-type')?.includes('application/json'))return reply({error:'Origem inválida.'},403);
 const user=await getFinanceUser(req);if(!user)return reply({error:'Sua sessão terminou. Entre novamente.'},401);if(user.mustChangePassword)return reply({error:'Altere sua senha antes de acessar seus dados.'},403);if(!env.DB)return reply({error:'Banco indisponível.'},503);
 try{
  const raw=await req.text();if(raw.length>2000000)return reply({error:'Limite de dados excedido.'},413);
  const parsed=saveSchema.safeParse(JSON.parse(raw));if(!parsed.success)return reply({error:parsed.error.issues[0]?.message||'Dados inválidos.'},400);
  const data=scopedData(parsed.data.data as FinanceData,user.defaultSpace),{revision,mutationId,action}=parsed.data,now=new Date().toISOString();
  const existing=await env.DB.prepare('SELECT revision,mutation_id FROM finance_documents WHERE user_id=?').bind(user.userId).first<{revision:number;mutation_id:string}>();
  if(existing?.mutation_id===mutationId)return reply({revision:existing.revision,updatedAt:now});
  if((existing?.revision||0)!==revision)return reply({error:'Seus dados mudaram em outro aparelho. Recarregue antes de salvar.'},409);
  const payload=JSON.stringify(data),next=revision+1;
  const results=await env.DB.batch([
   env.DB.prepare('INSERT INTO finance_documents(user_id,payload,revision,mutation_id,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,mutation_id=excluded.mutation_id,updated_at=excluded.updated_at WHERE finance_documents.revision=?').bind(user.userId,payload,next,mutationId,now,revision),
   env.DB.prepare('INSERT OR IGNORE INTO finance_snapshots(id,user_id,payload,created_at) SELECT ?,user_id,payload,updated_at FROM finance_documents WHERE user_id=? AND mutation_id=?').bind(user.userId+':'+now.slice(0,10),user.userId,mutationId),
   env.DB.prepare('INSERT OR IGNORE INTO finance_audit(id,user_id,action,created_at) SELECT ?,user_id,?,updated_at FROM finance_documents WHERE user_id=? AND mutation_id=?').bind(user.userId+':'+mutationId,action,user.userId,mutationId),
   env.DB.prepare('DELETE FROM finance_snapshots WHERE user_id=? AND created_at < ?').bind(user.userId,new Date(Date.now()-30*86400000).toISOString())
  ]);
  if(!results[0].meta.changes)return reply({error:'Conflito de edição. Recarregue a página.'},409);return reply({revision:next,updatedAt:now});
 }catch{return reply({error:'Não foi possível salvar. Seus dados não foram confirmados.'},500);}
}
export async function DELETE(req:Request){
 if(!allowed(req)||req.headers.get('x-confirm-delete')!=='EXCLUIR')return reply({error:'Confirmação necessária.'},400);
 const user=await getFinanceUser(req);if(!user)return reply({error:'Sessão necessária.'},401);if(user.mustChangePassword)return reply({error:'Altere sua senha antes de acessar seus dados.'},403);if(!env.DB)return reply({error:'Banco indisponível.'},503);
 await env.DB.batch(['finance_documents','finance_snapshots','finance_audit','push_subscriptions'].map(table=>env.DB!.prepare('DELETE FROM '+table+' WHERE user_id=?').bind(user.userId)));
 return reply({deleted:true});
}
