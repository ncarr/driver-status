import express from 'express'

const data = {
  data: {
    supply: {
      firstName: 'Test',
      uuid: '-1',
    },
    jobs: [
      {
        tokenState: 'ACTIVE',
        status: 'Online',
      },
    ],
  },
}

const app = express()
app.use(express.json())

app.post('/status', (_, res) => {
  res.send(data)
  // tslint:disable-next-line: no-console
  console.log('Pulled status')
})

app.listen(4000)
