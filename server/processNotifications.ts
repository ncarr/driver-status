import webpush from 'web-push'
import { ProcessCallbackFunction } from 'bull'
import { NotificationData, polling, vapidDetails, POLL_MS } from './util'
import { SubscriberModel } from './Subscriber'
import { TripModel } from './Trip'

export default (async (job) => {
  try {
    // tslint:disable-next-line: no-console
    console.log('sending notif')
    await webpush.sendNotification(job.data.subscriber.subscription, JSON.stringify({
      timestamp: Date.now(),
      code: job.data.subscriber.code,
      status: job.data.status,
    }), { vapidDetails })
  } catch (err) {
    // tslint:disable-next-line: no-console
    console.log(err)
    await SubscriberModel.deleteOne({ _id: job.data.subscriber._id }).exec()
    if (await SubscriberModel.count({ code: job.data.subscriber.code }).exec() === 0) {
      await TripModel.deleteOne({ code: job.data.subscriber.code }).exec()
      await polling.removeRepeatable(job.data.subscriber.code, { every: POLL_MS })
    }
    throw err
  }
}) as ProcessCallbackFunction<NotificationData>
