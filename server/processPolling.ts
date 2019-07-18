import { refresh } from './util'
import { ProcessCallbackFunction } from 'bull'

export default ((job) => refresh(job.name, false)) as ProcessCallbackFunction<undefined>
