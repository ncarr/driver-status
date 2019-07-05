import { prop, Typegoose } from 'typegoose'

export class Trip extends Typegoose {
  @prop({ required: true })
  public code!: string

  @prop()
  public cancelToken?: NodeJS.Timeout

  @prop()
  public status?: string

  @prop()
  public lastUpdated?: Date

  @prop()
  public name?: string

  @prop()
  public driver?: string
}

export const TripModel = new Trip().getModelForClass(Trip)
