import { prop } from 'typegoose'
import Keys from './Keys'

export default class PushSubscription {
  @prop({ required: true })
  public endpoint!: string

  @prop({ required: true })
  public keys!: Keys
}
