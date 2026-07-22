import express from 'express'
import storageRouter from './storageRouter.js'

const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use('/api/storage', storageRouter)

app.use((error, _request, response, _next) => {
  void _next
  const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
  const message = error.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 100 MB' : (error.message || '请求失败')
  console.error('[storage-api]', error.name, message)
  response.status(status).json({ error: message })
})

export default app
