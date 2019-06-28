async function unsubscribe({ notification }) {
  return fetch('/unsubscribe', notification.data.id)
}

self.onnotificationclick = unsubscribe
// don't use fetch, additional data is required
self.pushsubscriptionchange = function ({ oldSubscription, newSubscription }) {
  event.waitUntil(async () => {
    await fetch('/unsubscribe', oldSubscription)
    if (newSubscription) {
      await fetch('/subscribe', newSubscription)
    } else {
      const subscription = await self.registration.pushManager.subscribe()
      await fetch('/subscribe', subscription)
    }
  })

}

self.addEventListener('push', event => {
  const data = event.data.json()
  self.registration.showNotification(`${data.name}'s Trip`, {
    body: data.status,
    tag: data.driver,
    data: {
      id: data.id
    },
    timestamp: data.timestamp
  })
  if (data.status === 'Offline') {
    const subscription = await self.registration.pushManager.getSubscription()
    await subscription.unsubscribe()
  }
})
