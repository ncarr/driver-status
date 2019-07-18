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
    .filter(({ url }) => url === `${process.env.BASE_URL}/status/${event.notification.data.code}`)
  if (windows.length === 0) {
    await unsubscribe(event.notification.data.code)
  }
})()))

self.addEventListener('notificationclick', (event) => event.waitUntil((async () => {
  const window = (await self.clients.matchAll({ type: 'window' }))
    .filter(({ url }) => url === `${process.env.BASE_URL}/status/${event.notification.data.code}`)
    .shift()
  if (window instanceof WindowClient) {
    window.focus()
  } else {
    self.clients.openWindow(`${process.env.BASE_URL}/status/${event.notification.data.code}`)
  }
})()))

self.addEventListener('pushsubscriptionchange', (event) => event.waitUntil((async () => {
  const subscription = event.newSubscription || await self.registration.pushManager.subscribe()
  const codes = await localforage.keys()
  await Promise.all(codes.map(async (code) => {
    const trip: Trip = await localforage.getItem(code)
    await fetch('/unsubscribe', { method: 'POST', body: JSON.stringify({ id: trip.id }) })
    try {
      const res = await fetch('/subscribe', {
        method: 'POST',
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
    .filter(({ url }) => url === `${process.env.BASE_URL}/status/${data.code}`)
    .forEach((window) => window.postMessage(data))
  let renotify = false
  const trip = await localforage.getItem<Trip>(data.code)
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
  const trip: Trip = await localforage.getItem(event.data.code)
  const windows = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
    .filter(({ url }) => url === `${process.env.BASE_URL}/status/${event.data.code}`)
  // debug: should windows.length be 0 or 1?
  // tslint:disable-next-line: no-console
  console.log(windows.length)
  if (!trip.notify && windows.length <= 1) {
    await unsubscribe(event.data)
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
  await fetch('/unsubscribe', { method: 'POST', body: JSON.stringify({ id }) })
}

precacheAndRoute(self.__WB_MANIFEST, {})
