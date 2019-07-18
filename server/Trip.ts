import { prop, Typegoose } from 'typegoose'

export class Trip extends Typegoose {
  @prop({ required: true })
  public code!: string

  @prop()
  public status?: string
}

export const TripModel = new Trip().getModelForClass(Trip)
