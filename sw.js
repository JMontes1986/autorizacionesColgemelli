self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nueva notificación';
  const options = { body: data.body || '' };
  event.waitUntil(self.registration.showNotification(title, options));
});
