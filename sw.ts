importScripts('https://unpkg.com/localforage')

// Immediately invoked function expression as the promise for extendableEvent.waitUntil
self.addEventListener('notificationclose', (event) => event.waitUntil((async () => {
  let trip = await localforage.getItem(event.notification.data.code)
  trip.notify = false
  await localforage.setItem(event.notification.data.code, trip)
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  // todo: set up vue-router and have code-based urls
  if (windows.length === 0) {
    await unsubscribe(event.notification.data.code)
  }
})()))

self.addEventListener('notificationclick', (event) => event.waitUntil((async () => {
  const windows = await clients.matchAll({ type: 'window' })
  // todo: set up vue-router and have code-based urls
  const window = windows.filter((window) => window.url === '/').shift()
  if (window) {
    window.focus()
  } else {
    // todo: set up vue-router and have code-based urls
    clients.openWindow('/')
  }
})()))

self.addEventListener('pushsubscriptionchange', (event) => event.waitUntil((async () => {
  const subscription = event.newSubscription || await self.registration.pushManager.subscribe()
  let codes = await localforage.keys()
  await Promise.all(codes.map((code) => {
    let trip = localforage.getItem(code)
    await fetch('/unsubscribe', { method: 'POST', body: JSON.stringify({ id: trip.id }) })
    try {
      const res = await fetch('/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          subscription,
          code
        })
      })
      if (res.status === 410) {
        throw new Error('Offline')
      }
      const { id } = await res.json()
      trip.id = id
      await localforage.setItem(code, trip)
    } catch (err) {
      await localforage.removeItem(code)
      if (err.message !== 'Offline') {
        console.error(err)
      }
    }
  }))
  if (await localforage.length() === 0) {
    await subscription.unsubscribe()
  }
})()))

self.addEventListener('push', (event) => event.waitUntil((async () => {
  const data = event.data.json()
  const windows = await clients.matchAll({ type: 'window' })
  // todo: set up vue-router and have code-based urls
  windows.filter((window) => window.url === '/').forEach((window) => window.postMessage(data))
  let renotify = false
  let trip = await localforage.getItem(data.code)
  if (!trip.wentOnline && data.status === 'Online') {
    renotify = true
    trip.wentOnline = true
    await localforage.setItem(data.code, trip)
  }
  if (trip.notify) {
    self.registration.showNotification(`${trip.name}'s Trip`, {
      body: data.status,
      tag: trip.driver,
      data: {
        code: data.code
      },
      timestamp: data.timestamp,
      renotify
    })
  }
  if (data.status === 'Offline') {
    await unsubscribe(data.code)
  }
})()))


self.addEventListener('message', (event) => event.waitUntil((async () => {
  let trip = await localforage.getItem(event.notification.data.code)
  // todo: set up vue-router and have code-based urls
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (!trip.notify && windows.length <= 1) {
    await unsubscribe(event.data)
  }
})()))

async function unsubscribe(code) {
  let { id } = await localforage.getItem(code)
  await localforage.removeItem(code)
  if (await localforage.length() === 0) {
    const subscription = await self.registration.pushManager.getSubscription()
    await subscription.unsubscribe()
  }
  await fetch('/unsubscribe', { method: 'POST', body: JSON.stringify({ id }) })
}
