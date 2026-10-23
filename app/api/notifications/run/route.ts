export const dynamic='force-dynamic';
// Compatibility response for the old cloud task. Scheduled work now runs as a
// Cloudflare Cron Trigger, so public HTTP requests never process user alerts.
export async function POST(){return Response.json({ok:true,scheduled:true},{headers:{'Cache-Control':'no-store'}});}
