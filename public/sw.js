const CACHE='clareia-shell-v3';
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/favicon.svg','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png'])));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||url.pathname.includes('chatgpt')||url.pathname==='/callback')return;
if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));return;}
if(url.pathname.startsWith('/assets/')&&/\.(?:js|css|png|svg|woff2)$/.test(url.pathname)){event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return res;})));}});

self.addEventListener('push',event=>event.waitUntil(self.registration.showNotification('Seu radar Clareia',{body:'Há uma atualização para você. Abra para conferir seus sinais e o resumo da semana.',icon:'/icon-192.png',badge:'/favicon.svg',tag:'clareia-radar',data:{url:'/?view=insights'}})));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(c=>new URL(c.url).origin===location.origin);if(client){await client.navigate('/?view=insights');return client.focus();}return self.clients.openWindow('/?view=insights');}));});
