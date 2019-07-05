import { prop, Typegoose } from 'typegoose'
import { PushSubscription } from 'web-push'

export class Subscriber extends Typegoose {
  @prop({ required: true })
  public subscription!: PushSubscription

  @prop({ required: true })
  public code!: string
}

export const SubscriberModel = new Subscriber().getModelForClass(Subscriber)
