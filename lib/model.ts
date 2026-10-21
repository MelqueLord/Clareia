export type Space = 'pf' | 'mei';
export type Kind = 'expense' | 'income' | 'transfer' | 'refund' | 'card_payment' | 'reserve' | 'release';
export type Account = { id:string; name:string; bank:string; space:Space; balance:number; openingDate:string };
export type Card = { id:string; name:string; space:Space; accountId:string; limit:number; closingDay:number; dueDay:number };
export type Transaction = { id:string; description:string; amount:number; type:Kind; category:string; date:string; dueDate:string; paid:boolean; estimated:boolean; accountId:string; toAccountId:string; cardId:string; space:Space; installments:number; recurring:boolean; source:'manual'|'voice'; createdAt:string };
export type Budget = { id:string; space:Space; category:string; limit:number };
export type Preferences = { floor:number|null; complete:boolean; checkedOn:string; essentials?:{category:string;monthly:number}[]; essentialsReviewed?:boolean };
export type FinanceData = { configured:boolean; accounts:Account[]; cards:Card[]; transactions:Transaction[]; budgets:Budget[]; preferences:Record<Space,Preferences>; dismissed:string[] };
export const categories = ['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Compras','Assinaturas','Serviços','Fornecedores','Impostos','Outros'];
export const id = () => crypto.randomUUID();
export function emptyData(): FinanceData { return {configured:false,accounts:[],cards:[],transactions:[],budgets:[],preferences:{pf:{floor:null,complete:false,checkedOn:''},mei:{floor:null,complete:false,checkedOn:''}},dismissed:[]}; }
export const money = (cents:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function cents(input:string):number { const s=input.replace(/[^0-9,.-]/g,''); const normalized=s.includes(',')?s.replace(/\./g,'').replace(',','.'):s; return Math.round(Number(normalized)*100); }
export function today():string { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export const dateLabel=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
export const monthLabel=(s:string)=>new Date(s.slice(0,7)+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
export function addMonths(date:string, n:number):string { const [y,m,d]=date.split('-').map(Number); const base=new Date(Date.UTC(y,m-1+n,1)); const last=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0)).getUTCDate(); return `${base.getUTCFullYear()}-${String(base.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`; }
export function withDay(month:string,day:number):string { return month.slice(0,7)+'-'+String(Math.min(day,new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate())).padStart(2,'0'); }
export function firstCardDue(date:string,card:Card):string { const purchaseDay=Number(date.slice(8)); const monthOffset=(purchaseDay>=card.closingDay?1:0)+(card.dueDay<=card.closingDay?1:0); return withDay(addMonths(date,monthOffset),card.dueDay); }
