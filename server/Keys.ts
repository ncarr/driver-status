import { prop } from 'typegoose'

export default class Keys {
  @prop({ required: true })
  public p256dh!: string

  @prop({ required: true })
  public auth!: string
}
