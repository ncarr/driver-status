import localforage from 'localforage'
import { precacheAndRoute } from 'workbox-precaching/precacheAndRoute'
declare var self: ServiceWorkerGlobalScope & { __WB_MANIFEST: any }

interface Trip {
  id: string
  name: string
  driver: string
  wentOnline: boolean
  notify: boolean
}

// Immediately invoked async function expression as the promise for extendableEvent.waitUntil
self.addEventListener('notificationclose', (event) => event.waitUntil((async () => {
  const trip: Trip = await localforage.getItem(event.notification.data.code)
  trip.notify = false
  await localforage.setItem(event.notification.data.code, trip)
  const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .filter(({ url }) => url.includes(event.notification.data.code))
  windows.forEach((window) => window.postMessage({ unsubscribe: event.notification.data.code }))
  if (windows.length === 0) {
    await unsubscribe(event.notification.data.code)
  }
})()))

self.addEventListener('notificationclick', (event) => event.waitUntil((async () => {
  const window = (await self.clients.matchAll({ type: 'window' }))
    .filter(({ url }) => url.endsWith(event.notification.data.code))
    .shift()
  if (window instanceof WindowClient) {
    await window.focus()
  } else {
    await self.clients.openWindow(`/status/${event.notification.data.code}`)
  }
  if (event.notification.data.close) {
    event.notification.close()
  } else {
    await self.registration.showNotification(event.notification.title, {
      body: event.notification.body,
      tag: event.notification.tag,
      data: event.notification.data,
      timestamp: event.notification.timestamp,
      renotify: event.notification.renotify,
    })
  }
})()))

self.addEventListener('pushsubscriptionchange', (event) => event.waitUntil((async () => {
  const subscription = event.newSubscription || await self.registration.pushManager.subscribe(
    event.oldSubscription ? event.oldSubscription.options :
    {
      applicationServerKey: await fetch('/api/publickey').then((res) => res.arrayBuffer()),
      userVisibleOnly: true,
    },
  )
  const codes = await localforage.keys()
  await Promise.all(codes.map(async (code) => {
    const trip: Trip = await localforage.getItem(code)
    await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: trip.id }),
    })
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription,
          code,
        }),
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
        throw err
      }
    }
  }))
  if (await localforage.length() === 0) {
    await subscription.unsubscribe()
  }
})()))

self.addEventListener('push', (event) => event.waitUntil((async () => {
  const data = event.data!.json()
  const windows = await self.clients.matchAll({ type: 'window' })
  windows
    .filter(({ url }) => url.includes(data.code))
    .forEach((window) => window.postMessage(data))
  let renotify = false
  const trip = await localforage.getItem<Trip>(data.code)
  if (!trip.wentOnline && data.status === 'Online') {
    renotify = true
    trip.wentOnline = true
    await localforage.setItem(data.code, trip)
  }
  // Filler notification in error states to conform to userVisibleOnly
  if (windows.length === 0 && !trip.notify && (await self.registration.getNotifications()).length === 0) {
    await self.registration.showNotification(`${trip.name}'s Trip`, {
      body: 'Unsubscribing from notifications',
      tag: trip.driver,
      data: {
        code: data.code,
        close: true,
      },
      silent: true,
    })
    const subscription = await self.registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
    }
    const keys = await localforage.keys()
    const ids = await Promise.all(keys.map((key) => localforage.getItem<Trip>(key).then(({ id }) => id)))
    await localforage.clear()
    await Promise.all(ids.map((id) => fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })))
  }
  if (trip.notify) {
    await self.registration.showNotification(`${trip.name}'s Trip`, {
      body: data.status,
      tag: trip.driver,
      data: {
        code: data.code,
      },
      timestamp: data.timestamp,
      renotify,
    })
  }
  if (data.status === 'Offline') {
    await unsubscribe(data.code)
  }
})()))


self.addEventListener('message', async (event) => {
  const trip = await localforage.getItem<Trip>(event.data)
  if (trip) {
    const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .filter(({ url }) => url.includes(event.data))
    if (!trip.notify && windows.length === 0) {
      await unsubscribe(event.data)
    }
  }
})

async function unsubscribe(code: string) {
  const { id } = await localforage.getItem(code)
  await localforage.removeItem(code)
  if (await localforage.length() === 0) {
    const subscription = await self.registration.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
    }
  }
  await fetch('/api/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })
}

precacheAndRoute(self.__WB_MANIFEST, {})
