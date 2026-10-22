export type Space = 'pf' | 'mei';
export type Kind = 'expense' | 'income' | 'transfer' | 'refund' | 'card_payment' | 'reserve' | 'release';
export type Account = { id:string; name:string; bank:string; space:Space; balance:number; openingDate:string };
export type Card = { id:string; name:string; space:Space; accountId:string; limit:number; closingDay:number; dueDay:number };
export type Transaction = { id:string; description:string; amount:number; type:Kind; category:string; date:string; dueDate:string; paid:boolean; estimated:boolean; accountId:string; toAccountId:string; cardId:string; space:Space; installments:number; recurring:boolean; source:'manual'|'voice'; createdAt:string; goalId?:string; investmentAmount?:number; investmentType?:string; sourceIncomeId?:string };
export type Budget = { id:string; space:Space; category:string; limit:number };
export type SavingsGoal = { id:string; space:Space; name:string; target:number; targetDate:string };
export type InvestmentPlan = { id:string; space:Space; incomeCategory:string; mode:'fixed'|'percent'; value:number; investmentType:string };
export type Preferences = { floor:number|null; complete:boolean; checkedOn:string; essentials?:{category:string;monthly:number}[]; essentialsReviewed?:boolean };
export type PersonalProfile = { incomeSource:string; monthlyIncomeTarget:number|null; dependents:number };
export type BusinessProfile = { tradeName:string; cnpj:string; activity:string; city:string; monthlyRevenueTarget:number|null; monthlyDas:number|null; dasDueDay:number|null; proLabore:number|null };
export type FinanceData = { configured:boolean; accounts:Account[]; cards:Card[]; transactions:Transaction[]; budgets:Budget[]; savingsGoals?:SavingsGoal[]; investmentPlans?:InvestmentPlan[]; preferences:Record<Space,Preferences>; profiles:{pf:PersonalProfile;mei:BusinessProfile}; dismissed:string[] };
export const personalIncomeCategories = ['Salário','Benefícios','Renda extra','Rendimentos','Outros'];
export const personalExpenseCategories = ['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Compras','Assinaturas','Serviços','Impostos','Outros'];
export const businessIncomeCategories = ['Serviços prestados','Venda de produtos','Reembolso recebido','Outros'];
export const businessExpenseCategories = ['Materiais e insumos','Fornecedores','Ferramentas e equipamentos','Aluguel e estrutura','Internet e telefone','Marketing','Transporte e entregas','Taxas bancárias','DAS e tributos','Contabilidade','Pró-labore','Outros'];
export const categories = [...new Set([...personalIncomeCategories,...personalExpenseCategories,...businessIncomeCategories,...businessExpenseCategories])];
export function categoriesFor(space:Space,kind:'income'|'expense'|'all'='all'):string[]{const list=space==='mei'?[...businessIncomeCategories,...businessExpenseCategories]:[...personalIncomeCategories,...personalExpenseCategories];return kind==='all'?list:space==='mei'?(kind==='income'?businessIncomeCategories:businessExpenseCategories):(kind==='income'?personalIncomeCategories:personalExpenseCategories);}
export const id = () => crypto.randomUUID();
export function emptyData(): FinanceData { return {configured:false,accounts:[],cards:[],transactions:[],budgets:[],savingsGoals:[],investmentPlans:[],preferences:{pf:{floor:null,complete:false,checkedOn:''},mei:{floor:null,complete:false,checkedOn:''}},profiles:{pf:{incomeSource:'',monthlyIncomeTarget:null,dependents:0},mei:{tradeName:'',cnpj:'',activity:'',city:'',monthlyRevenueTarget:null,monthlyDas:null,dasDueDay:null,proLabore:null}},dismissed:[]}; }
export const money = (cents:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
export function cents(input:string):number { const s=input.replace(/[^0-9,.-]/g,''); const normalized=s.includes(',')?s.replace(/\./g,'').replace(',','.'):s; return Math.round(Number(normalized)*100); }
export function today():string { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export const dateLabel=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
export const monthLabel=(s:string)=>new Date(s.slice(0,7)+'-15T12:00:00').toLocaleDateString('pt-BR',{month:'short',year:'numeric'});
export function addMonths(date:string, n:number):string { const [y,m,d]=date.split('-').map(Number); const base=new Date(Date.UTC(y,m-1+n,1)); const last=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0)).getUTCDate(); return `${base.getUTCFullYear()}-${String(base.getUTCMonth()+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`; }
export function withDay(month:string,day:number):string { return month.slice(0,7)+'-'+String(Math.min(day,new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate())).padStart(2,'0'); }
export function firstCardDue(date:string,card:Card):string { const purchaseDay=Number(date.slice(8)); const monthOffset=(purchaseDay>=card.closingDay?1:0)+(card.dueDay<=card.closingDay?1:0); return withDay(addMonths(date,monthOffset),card.dueDay); }
