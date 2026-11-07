// Shows the notifications that supabase/functions/send-push sends, and opens the watch each one
// is about. Served as is from the site's base path, so its scope is the whole web app.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { title: 'Flights', body: event.data ? event.data.text() : '' };
  }
  const scope = self.registration.scope;
  event.waitUntil(
    self.registration.showNotification(message.title || 'Flights', {
      body: message.body || '',
      icon: new URL('icon-192.png', scope).href,
      badge: new URL('badge-96.png', scope).href,
      // A newer notification about the same watch replaces the older one.
      tag: message.tag,
      renotify: Boolean(message.tag),
      lang: 'zh-Hant-TW',
      data: { url: new URL(message.path || '', scope).href },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
