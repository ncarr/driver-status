importScripts('https://unpkg.com/localforage')

self.addEventListener('notificationclose', (event) => event.waitUntil(async () => {
  let notifsopen = await localforage.getItem('notifsopen')
  await localforage.setItem('notifsopen', --notifsopen)
  if (notifsopen === 0) {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
    if (windows.length === 0) {
      await unsubscribe(event.notification.data.id)
    }
  }
}))

self.addEventListener('notificationclick', (event) => event.waitUntil(async () => {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  let focussed = false
  for (const window of windows) {
    if (window.url === '/') {
      window.focus()
      focussed = true
      break
    }
  }
  if (!focussed) {
    clients.openWindow('/')
  }
}))

// todo: trip list lifecycle, online status lifecycle
self.addEventListener('pushsubscriptionchange', (event) => event.waitUntil(async () => {
  const subscriptiondata = await localforage.getItem(event.oldSubscription.endpoint)
  await localforage.removeItem(event.oldSubscription.endpoint)
    await fetch('/unsubscribe', { method: 'POST', body: JSON.stringify({ id: subscriptiondata.id }) })
  if (newSubscription) {
    const data = await fetch('/subscribe', { method: 'POST', body: JSON.stringify({ subscription: newSubscription, code: subscriptiondata.code }) }).then(res => res.json())
    await localforage.setItem(subscription.endpoint, { ...subscriptiondata, ...data })
  } else {
    const subscription = await self.registration.pushManager.subscribe()
    const data = await fetch('/subscribe', { method: 'POST', body: JSON.stringify({ subscription, code: subscriptiondata.code }) }).then(res => res.json())
    await localforage.setItem(subscription.endpoint, { ...subscriptiondata, ...data })
  }
}))

self.addEventListener('push', (event) => event.waitUntil(async () => {
  const data = event.data.json()
  const windows = await clients.matchAll({ type: 'window' })
  for (const window of windows) {
    window.postMessage(data)
  }
  let renotify = false
  if (data.first) {
    await localforage.setItem(data.id, data.status === 'Online')
  } else if (!await localforage.getItem(data.id) && data.status === 'Online') {
    renotify = true
  }
  self.registration.showNotification(`${data.name}'s Trip`, {
    body: data.status,
    tag: data.driver,
    data: {
      id: data.id
    },
    timestamp: data.timestamp,
    silent: data.first,
    renotify
  })
  if (data.status === 'Offline') {
    await unsubscribe(data.id)
  }
}))

async function unsubscribe(id) {
  let trips = await localforage.getItem('trips')
  trips = trips.filter((trip) => trip.id !== id)
  await localforage.setItem('numTrips', trips)
  await localforage.removeItem(id)
  if (trips.length === 0) {
    const subscription = await self.registration.pushManager.getSubscription()
    await subscription.unsubscribe()
  }
  await fetch('/unsubscribe', { method: 'POST', body: JSON.stringify({ id }) })
}