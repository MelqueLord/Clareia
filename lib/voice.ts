import type { FinanceData, Kind, Space } from './model';
import { cents } from './model';
const units:Record<string,number>={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,trezentos:300,quatrocentos:400,quinhentos:500,seiscentos:600,setecentos:700,oitocentos:800,novecentos:900};
const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function wordNumber(s:string){let n=0,found=false;for(const w of s.trim().split(/\s+/)){if(w==='e')continue;if(w==='mil'){n=(n||1)*1000;found=true;}else if(w in units){n+=units[w];found=true;}else {n=0;found=false;}}return found?n:null;}
export function parseVoice(text:string,data:FinanceData,currentSpace:Space,asOf:string){const s=normalize(text);let amount:number|null=null;const moneyMatch=s.match(/(?:r\$\s*)?(\d[\d.,]*)\s*(?:reais|real)/)||s.match(/(?:gastei|paguei|recebi|comprei por|valor de)\s+(?:r\$\s*)?(\d[\d.,]*)/);if(moneyMatch)amount=cents(moneyMatch[1]);else{const before=s.split(/reais|real/);if(before.length>1){const n=wordNumber(before[0]);if(n!==null)amount=n*100;const fraction=before[1].match(/^\s*e\s+(.+?)\s+centavos/);if(fraction){const n2=wordNumber(fraction[1]);if(n2!==null&&amount!==null)amount+=n2;}}}
 const space:Space=/mei|empresa|negocio/.test(s)?'mei':/pessoal|pessoa fisica/.test(s)?'pf':currentSpace;
 const type:Kind=/recebi|receita|entrou|ganhei/.test(s)?'income':/transferi|transferencia/.test(s)?'transfer':'expense';
 let date='';if(/hoje/.test(s))date=asOf;else if(/ontem/.test(s))date=new Date(Date.parse(asOf+'T12:00:00Z')-86400000).toISOString().slice(0,10);else{const match=s.match(/dia (\d{1,2})/);if(match)date=asOf.slice(0,8)+match[1].padStart(2,'0');}
 const category=/mercado|aliment|restaurante|delivery|ifood/.test(s)?'Alimentação':/uber|combustivel|gasolina|onibus/.test(s)?'Transporte':/aluguel|condominio|luz|energia|agua/.test(s)?'Moradia':/farmacia|medico|saude/.test(s)?'Saúde':/netflix|spotify|assinatura/.test(s)?'Assinaturas':'Outros';
 const accounts=data.accounts.filter(a=>a.space===space&&[a.name,a.bank].some(n=>n.length>2&&s.includes(normalize(n))));
 const cards=data.cards.filter(c=>c.space===space&&s.includes(normalize(c.name)));
 const card=cards.length===1?cards[0]:undefined;const account=card?data.accounts.find(a=>a.id===card.accountId):accounts.length===1?accounts[0]:undefined;
 return {amount,space,type,date,category,description:text.slice(0,180),accountId:account?.id||'',cardId:card?.id||'',installments:Number(s.match(/(?:em\s+)?(\d+)\s*(?:vezes|parcelas)/)?.[1]||1),needsReview:true};
}
