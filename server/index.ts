import express, { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express'
import mongoose from 'mongoose'
import { InstanceType } from 'typegoose'
import { SubscriberModel, Subscriber } from './Subscriber'
import { TripModel } from './Trip'
import { polling, notifications, refresh, POLL_MS } from './util'

polling.process('*', './processPolling')
notifications.process('./processNotifications')

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost/driverstatus', { useNewUrlParser: true })

const app = express()
app.use(express.json())

type PromiseRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>
const wrap = (fn: PromiseRequestHandler): RequestHandler => (req, res, next) => fn(req, res, next).catch(next)

app.post('/subscribe', wrap(async ({ body: { code, subscription } }: { body: Subscriber }, res) => {
  const { status, name, driver } = await refresh(code, true)
  if (status === 'Offline') {
    res.status(410).json({ error: 'Offline' })
    return
  }
  const { _id: id } = await SubscriberModel.findOneAndUpdate(
    { code, 'subscription.endpoint': subscription.endpoint },
    { subscription },
    { upsert: true, new: true },
  ).exec() as InstanceType<Subscriber>
  await polling.add(code, undefined, undefined)
  res.json({ id, status, name, driver })
}))

app.post('/unsubscribe', wrap(async ({ body: { id } }: { body: { id: string } }, res, next) => {
  const subscriber = await SubscriberModel.findOneAndDelete({ _id: id }).exec()
  if (subscriber && await SubscriberModel.count({ code: subscriber.code }).exec() === 0) {
    await TripModel.deleteOne({ code: subscriber.code }).exec()
    await polling.removeRepeatable(subscriber.code, { every: POLL_MS })
  }
}))

app.get('/status', wrap(({ query: { code } }: { query: { code: string } }, res) => refresh(code, false)))

app.use(((err, _, res) => {
  res.status(400).json({ error: err })
  // tslint:disable-next-line: no-console
  console.error('Error rendering page: ')
}) as ErrorRequestHandler)

app.listen(process.env.PORT || 3000)
