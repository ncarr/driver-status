import { setInterval, clearInterval } from 'timers'
import webpush, { PushSubscription } from 'web-push'
import express, { RequestHandler, Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import axios from 'axios'
import mongoose from 'mongoose'
import { InstanceType } from 'typegoose'
import { SubscriberModel, Subscriber } from './Subscriber'
import { TripModel, Trip } from './Trip'

const POLL_MS = 30000
const DEBOUNCE_MS = 5000

// Connect to database
mongoose.connect('mongodb://localhost/driverstatus')

// Set up web server
const app = express()
app.use(express.json())

type PromiseRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>
const wrap = (fn: PromiseRequestHandler): RequestHandler => (req, res, next) => fn(req, res, next).catch(next)

// Set up api client
const api = axios.create({
  url: 'https://trip.uber.com/api/syrupFetch',
  method: 'post',
  headers: {
    'x-csrf-token': 'x',
  },
})

// Rehydrate continuous polling
TripModel.find().exec().then((trips) => Promise.all(trips.map(async (trip) => {
  if ((await check(trip)).status !== 'Offline') {
    trip.cancelToken = setInterval(checkInterval, POLL_MS, trip)
    await trip.save()
  }
})))

// todo: dedup same endpoint same trip
app.post('/subscribe', wrap(async ({ body: { code, subscription } }: { body: Subscriber }, res) => {
  let trip = await TripModel.findOne({ code }).exec()
  let newTrip = false
  if (!trip) {
    trip = await TripModel.create({ code } as Trip)
    newTrip = true
  }
  // Check to make sure link is still active
  const result = await check(trip)
  if (result.status !== 'Offline') {
    const subscriber = await SubscriberModel.create({ code, subscription } as Subscriber)
    res.status(201).json({ id: subscriber._id })
    await notify(subscriber, result.name!, result.driver!, result.timestamp, result.status!, true)
    if (newTrip) {
      trip.cancelToken = setInterval(checkInterval, POLL_MS, trip)
      trip.driver = result.driver
      trip.name = result.name
      await trip.save()
    }
  } else {
    res.status(410).json({ error: 'Trip is over' })
  }
}))

app.post('/unsubscribe', ({ body: { id } }: { body: { id: string } }, res, next) =>
  unsubscribe(id)
    .then(() => res.status(200).json({ result: 'ok' }))
    .catch(next))

app.get('/status', wrap(async ({ params: { code } }: { params: { code: string }}, res) => {
  const trip = await TripModel.findOne({ code })
  if (trip) {
    const result = await check(trip)
    res.json({ status: result.status })
  } else {
    res.json({ status: 'Offline' })
  }
}))

app.use(((err, req, res, next) => {
  res.status(400).json({ error: err })
  // tslint:disable-next-line: no-console
  console.error('Error rendering page: ')
}) as ErrorRequestHandler)

async function check(this: NodeJS.Timeout | void, trip: InstanceType<Trip>) {
  const timestamp = new Date()
  if (trip.lastUpdated && Date.now() - trip.lastUpdated.getTime() < DEBOUNCE_MS) {
    return { timestamp, status: trip.status!, driver: trip.driver!, name: trip.name! }
  } else {
    const { data: { data } } = await api({ data: { shareToken: trip.code } })
    if (data.error && data.error !== 'Unable to fetch the share link.') {
      throw new Error(data.error)
    } else if (data.error || data.jobs['1'].tokenState === 'INACTIVE') {
      await notifyAll(trip.code, trip.name!, trip.driver!, timestamp, 'Offline')
      await trip.remove()
      if (this instanceof NodeJS.Timeout) {
        clearInterval(this)
      }
      await SubscriberModel.deleteMany({ code: trip.code }).exec()
      return { name: trip.name!, driver: trip.driver!, timestamp, status: 'Offline' }
    } else {
      const name: string = data.supply.firstName
      const driver: string = data.supply.uuid
      const status = data.jobs['1'].status

      if (status !== trip.status) {
        await notifyAll(trip.code, name, driver, timestamp, status)
        trip.status = status
      }
      trip.lastUpdated = timestamp
      trip.save()
      return { name, driver, timestamp, status }
    }
  }
}

async function checkInterval(this: NodeJS.Timeout, trip: InstanceType<Trip>) {
  return check.call(this, trip)
    .catch((error) => {
      // tslint:disable-next-line: no-console
      console.error(`Error polling: ${error}`)
    })
}

async function notify(
  { subscription, _id }: InstanceType<Subscriber>,
  name: string,
  driver: string,
  timestamp: Date,
  status: string,
  first: boolean = false) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify({
      name,
      driver,
      timestamp: timestamp.getTime(),
      _id,
      status,
      first,
    }))
  } catch (err) {
    // tslint:disable-next-line: no-console
    console.error(`Error sending notification: ${err}`)
    try {
      if (!await unsubscribe(_id)) {
        // tslint:disable-next-line: no-console
        console.error('Subscriber is not in the database')
      }
    } catch (e) {
      // tslint:disable-next-line: no-console
      console.error(`Error unsubscribing user: ${e}`)
    }
  }
}

const notifyAll = async (code: string, name: string, driver: string, timestamp: Date, status: string) =>
  SubscriberModel.find({ code }).exec()
    .then((subscribers) =>
      Promise.all(subscribers.map((subscriber) => notify(subscriber, name, driver, timestamp, status))))

async function unsubscribe(id: string): Promise<boolean> {
  const subscriber = await SubscriberModel.findByIdAndDelete(id).exec()
  if (subscriber) {
    if (await SubscriberModel.count({ code: subscriber.code }).exec() === 0) {
      const trip = await TripModel.findOneAndDelete({ code: subscriber.code }).exec()
      clearInterval(trip!.cancelToken!)
    }
  }
  return subscriber !== null
}
