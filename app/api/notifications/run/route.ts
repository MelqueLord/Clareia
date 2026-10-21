import {runNotifications} from '../../../../lib/push';
export const dynamic='force-dynamic';
// Public, idempotent maintenance trigger. Accepts no user IDs, message or destination.
// Server-side consent, quiet hours, leases and per-device deduplication bound all effects.
export async function POST(){try{return Response.json(await runNotifications(),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Processamento temporariamente indisponível.'},{status:503});}}
