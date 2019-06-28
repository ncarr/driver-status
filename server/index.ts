import { default as webpush, PushSubscription } from 'web-push'
import express from 'express'
import axios from 'axios'
import Datastore from 'nedb'
import { promisify } from 'util'

// Maybe make this several interfaces
interface Notification {
  _id?: string
  subscription: PushSubscription,
  code: string,
  cancelToken?: NodeJS.Timeout,
  wentOnline?: boolean,
  lastStatus?: string,
}

interface Trip {
  _id?: string,
  code: string,
  cancelToken?: NodeJS.Timeout,
  status?: string,
}

// Set up web server
const app = express()
app.use(express.json())


// Set up api client
const api = axios.create({
  url: 'https://trip.uber.com/api/syrupFetch',
  method: 'post',
  headers: {
    'x-csrf-token': 'x',
  },
})

// Set up file-based database
const trips = new Datastore('trips.json')
const subscribersdb = new Datastore('subscribers.json')
// Promisify database methods
const findCb: (query: any, callback: (err: Error, document: Notification) => void) => void = trips.findOne
const find = promisify(findCb)
const insert: (document: Notification) => Promise<Notification> = promisify<Notification>(trips.insert)
const update = promisify<any, any, any>(trips.update)

// Rehydrate continuous polling
Promise.all(trips.getAllData().map(async (body: Trip) => {
  if (await check(body)) {
    await update({ _id: body._id }, { cancelToken: setInterval(check, 30000, body) }, undefined)
  }
}))

// Handle errors so you don't crash the web server
app.post('/subscribe', async ({ body }: { body: Notification }, res) => {
  const { code } = body
  // Check to make sure link is still active
  const { data } = await api({ data: { shareToken: code } })
  const trip = data.data.jobs['1']
  if (trip.tokenState === 'INACTIVE') {
    res.status(410).json({ error: 'Sharing session is already over' })
  } else {
    if (trip.status === 'Online') {
      body.wentOnline = true
    }
    const { _id } = await insert({ ...body, cancelToken: setInterval(check, 30000) })
    res.status(201).json({ id: _id })
    if (trip.status === 'Online') {
      await check(body)
    }
  }
})

app.post('/unsubscribe', async ({ body: { _id } }: { body: Notification }, res) => {
  const document = await find({ _id })
  if (document) {
    trips.remove({ _id })
    clearInterval(document.cancelToken)
  }
  res.status(200).json({})
})

// Error-proof in case notification delivery fails
async function check({ code, _id, status, subscribers }: Trip) {
  const { data } = await api({ data: { shareToken: code } })
  const name = data.data.supply.firstName
  const driver = data.data.supply.uuid
  const trip = data.data.jobs['1']
  const timestamp = Date.now()

  if (trip.tokenState === 'INACTIVE') {
    await Promise.all(subscribers.map(({subscription}) => {
      return webpush.sendNotification(subscription, JSON.stringify({
        name,
        driver,
        timestamp,
        id: _id,
        status: 'Offline',
      }))
    }))

    trips.remove({ _id })
    if (this instanceof NodeJS.Timeout) {
      clearInterval(this)
    }
    return false
  } else if (wentOnline && trip.status !== status) {
    await webpush.sendNotification(subscription, JSON.stringify({
      name,
      driver,
      timestamp,
      id: _id,
      status: trip.status,
    }))
    await update({ _id }, { lastStatus: trip.status }, undefined)
  } else if (trip.status === 'Online') {
    await webpush.sendNotification(subscription, JSON.stringify({
      name,
      driver,
      timestamp,
      id: _id,
      status: 'Online',
    }))
    await update({ _id }, { wentOnline: true, lastStatus: 'Online' }, undefined)
  }
  return true
}
