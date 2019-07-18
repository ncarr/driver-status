import Queue from 'bull'
import axios from 'axios'
import { InstanceType } from 'typegoose'
import { DeleteWriteOpResultObject } from 'mongodb'
import { SubscriberModel, Subscriber } from './Subscriber'
import { TripModel, Trip } from './Trip'

export const POLL_MS = 30000
export const URL = process.env.API_URL || 'https://trip.uber.com/api/syrupFetch'

export interface NotificationData {
  subscriber: InstanceType<Subscriber>
  status: string
}

export const polling = new Queue<undefined>('polling')
export const notifications = new Queue<NotificationData>('notifications')

export async function refresh(code: string, upsert: boolean) {
  // Call the API as usual
  const { status, name, driver } = await api(code)
  // Check if a trip exists and update it if it does
  let result: DeleteWriteOpResultObject['result'] = {}
  let trip: InstanceType<Trip> | null = null
  if (status === 'Offline') {
    result = await TripModel.deleteOne({ code }).exec()
  } else {
    trip = await TripModel.findOneAndUpdate({ code }, { status }, { upsert }).exec()
  }
  // If a trip exists, notify subscribers if it changed
  if ((status === 'Offline' && result.n) || (trip && status !== trip.status)) {
    const subscribers = await SubscriberModel.find({ code }).exec()
    await Promise.all(subscribers.map((subscriber) => notifications.add({ subscriber, status })))
  }
  // If a trip exists and went offline, delete its subscribers and scheduled task
  if (status === 'Offline' && result.n) {
    await SubscriberModel.deleteMany({ code }).exec()
    await polling.removeRepeatable(code, { every: POLL_MS })
  }
  return { status, name, driver }
}

export async function api(code: string) {
  const { data: { data } } = await axios.post(URL, { shareToken: code }, { headers: { 'x-csrf-token': 'x' } })
  if (data.error === 'Unable to fetch the share link.') {
    return { status: 'Offline' }
  } else if (data.error) {
    throw new Error(data.error)
  }
  const status = data.jobs['1'].status
  const name = data.supply.firstName
  const driver = data.supply.uuid
  if (data.jobs['1'].tokenState === 'INACTIVE') {
    return { status: 'Offline', name, driver }
  }
  return { status, name, driver }
}
