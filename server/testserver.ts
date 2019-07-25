import express from 'express'

const data = {
  data: {
    supply: {
      firstName: 'Test',
      uuid: '-1',
    },
    jobs: {
      1: {
        tokenState: 'ACTIVE',
        status: 'En Route',
      },
    },
  },
}

const app = express()
app.use(express.json())

app.post('/status', (_, res) => {
  res.json(data)
  // tslint:disable-next-line: no-console
  console.log('Pulled status')
})

app.post('/changestatus', ({ body: { status } }, res) => {
  data.data.jobs['1'].status = status
  res.json({ status })
})

app.listen(4000)
