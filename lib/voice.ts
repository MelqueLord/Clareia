import type { FinanceData, Kind, Space } from './model';
import { cents } from './model';
const units:Record<string,number>={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,catorze:14,quatorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,trezentos:300,quatrocentos:400,quinhentos:500,seiscentos:600,setecentos:700,oitocentos:800,novecentos:900};
const normalize=(s:string)=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function wordNumber(s:string){let n=0,found=false;for(const w of s.trim().split(/\s+/)){if(w==='e')continue;if(w==='mil'){n=(n||1)*1000;found=true;}else if(w in units){n+=units[w];found=true;}else {n=0;found=false;}}return found?n:null;}
export function parseVoice(text:string,data:FinanceData,currentSpace:Space,asOf:string){const s=normalize(text);let amount:number|null=null;const moneyMatch=s.match(/(?:r\$\s*)?(\d[\d.,]*)\s*(?:reais|real)/)||s.match(/(?:gastei|paguei|recebi|comprei por|valor de|separei|reservei|liberei|transferi)\s+(?:r\$\s*)?(\d[\d.,]*)/);if(moneyMatch)amount=cents(moneyMatch[1]);else{const before=s.split(/reais|real/);if(before.length>1){const n=wordNumber(before[0]);if(n!==null)amount=n*100;const fraction=before[1].match(/^\s*e\s+(.+?)\s+centavos/);if(fraction){const n2=wordNumber(fraction[1]);if(n2!==null&&amount!==null)amount+=n2;}}}
 const space:Space=currentSpace;
 const type:Kind=/separei|reservei/.test(s)?'reserve':/liberei/.test(s)?'release':/recebi|receita|entrou|ganhei/.test(s)?'income':/transferi|transferencia/.test(s)?'transfer':'expense';
 let date='';if(/hoje/.test(s))date=asOf;else if(/ontem/.test(s))date=new Date(Date.parse(asOf+'T12:00:00Z')-86400000).toISOString().slice(0,10);else{const match=s.match(/dia (\d{1,2})/);if(match)date=asOf.slice(0,8)+match[1].padStart(2,'0');}
 const category=space==='mei'?(/das|tributo|imposto/.test(s)?'DAS e tributos':/material|insumo|fornecedor/.test(s)?'Materiais e insumos':/ferrament|equipamento/.test(s)?'Ferramentas e equipamentos':/servico|cliente|recebi/.test(s)&&type==='income'?'Serviços prestados':/venda|produto/.test(s)&&type==='income'?'Venda de produtos':/marketing|anuncio/.test(s)?'Marketing':/aluguel|estrutura/.test(s)?'Aluguel e estrutura':/entrega|combustivel|gasolina|onibus|uber/.test(s)?'Transporte e entregas':/contabilidade|contador/.test(s)?'Contabilidade':/taxa|tarifa/.test(s)?'Taxas bancárias':'Outros'):(/salario/.test(s)&&type==='income'?'Salário':/beneficio/.test(s)&&type==='income'?'Benefícios':/renda extra|freelance/.test(s)&&type==='income'?'Renda extra':/mercado|aliment|restaurante|delivery|ifood/.test(s)?'Alimentação':/uber|combustivel|gasolina|onibus/.test(s)?'Transporte':/aluguel|condominio|luz|energia|agua/.test(s)?'Moradia':/farmacia|medico|saude/.test(s)?'Saúde':/netflix|spotify|assinatura/.test(s)?'Assinaturas':'Outros');
 const accounts=data.accounts.filter(a=>a.space===space&&[a.name,a.bank].some(n=>n.length>2&&s.includes(normalize(n))));
 const cards=/cartao/.test(s)?data.cards.filter(c=>c.space===space&&s.includes(normalize(c.name))):[];
 const card=cards.length===1?cards[0]:undefined;const account=card?data.accounts.find(a=>a.id===card.accountId):accounts.length===1?accounts[0]:undefined;
 const goal=(data.savingsGoals||[]).find(g=>g.space===space&&s.includes(normalize(g.name)));
 return {amount,space,type,date,category,description:text.slice(0,180),accountId:account?.id||'',cardId:card?.id||'',installments:Number(s.match(/(?:em\s+)?(\d+)\s*(?:vezes|parcelas)/)?.[1]||1),needsReview:true,goalId:['reserve','release'].includes(type)?goal?.id:undefined};
}

export function parseVoiceBatch(text:string,data:FinanceData,space:Space,asOf:string){
 const chunks=text.split(/(?:[,;]\s*|\s+e\s+)(?=(?:eu\s+)?(?:recebi|paguei|gastei|comprei|transferi|separei|reservei|liberei)\b)/i).map(s=>s.trim()).filter(Boolean);
 if(chunks.length>10)throw new Error('Use até dez movimentos por frase. Divida a gravação para revisar todos.');
 return chunks.map(chunk=>parseVoice(chunk,data,space,asOf));
}
