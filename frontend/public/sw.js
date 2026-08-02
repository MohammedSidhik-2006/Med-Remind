// MedRemind Service Worker — handles background push notifications

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "MedRemind", body: event.data.text() };
  }

  const title   = data.title || "MedRemind";
  const options = {
    body:             data.body  || "",
    icon:             data.icon  || "/logo192.png",
    badge:            "/logo192.png",
    tag:              data.tag   || "medremind",
    requireInteraction: true,
    data:             { url: self.location.origin }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
