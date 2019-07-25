import { resolve } from 'path'
import express, { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express'
import { InstanceType } from 'typegoose'
import { SubscriberModel, Subscriber } from './Subscriber'
import { TripModel } from './Trip'
import { polling, notifications, refresh, vapidDetails, POLL_MS } from './util'

polling.process('*', resolve('./processPolling'))
notifications.process(resolve('./processNotifications'))

const app = express()
app.use(express.json())

type PromiseRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>
const wrap = (fn: PromiseRequestHandler): RequestHandler =>
  (req, res, next) => fn(req, res, next).then((value) => res.json(value)).catch(next)

// base64-url decode the public key
const PUBLIC_KEY = Buffer.from((vapidDetails.publicKey + '='.repeat((4 - vapidDetails.publicKey.length % 4) % 4))
  .replace(/-/g, '+')
  .replace(/_/g, '/'), 'base64')

app.get('/publickey', (_, res) => res.send(PUBLIC_KEY))

app.post('/subscribe', wrap(async ({ body: { code, subscription } }: { body: Subscriber }, res) => {
  if (!code) {
    throw new Error('No share code provided')
  }
  if (!subscription) {
    throw new Error('No push subscription provided')
  }
  if (!subscription.endpoint || !subscription.keys || !subscription.keys.auth || !subscription.keys.p256dh) {
    throw new Error('Invalid PushSubscription')
  }
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

app.use(((error, req, res, next) => {
  res.status(400).json({ error })
  // tslint:disable-next-line: no-console
  console.error('Error rendering page: ', error)
}) as ErrorRequestHandler)

app.listen(process.env.PORT || 80)
