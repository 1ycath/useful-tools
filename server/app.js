import express from 'express'
import ocrRouter from './ocrRouter.js'
import storageRouter from './storageRouter.js'

const app = express()

app.disable('x-powered-by')
app.use(express.json({ limit: '1mb' }))
app.use('/api/ocr', ocrRouter)
app.use('/api/storage', storageRouter)

app.use((error, _request, response, _next) => {
  void _next
  const isOcrRequest = _request.path.startsWith('/api/ocr')
  const isFileTooLarge = error.code === 'LIMIT_FILE_SIZE'
  const status = error.status || (isFileTooLarge ? 413 : 400)
  const message = isFileTooLarge
    ? (isOcrRequest ? '单张图片不能超过 4 MB' : '文件不能超过 100 MB')
    : (error.message || '请求失败')
  const code = isFileTooLarge ? 'OCR_FILE_TOO_LARGE' : error.code

  console.error(
    isOcrRequest ? '[ocr-api]' : '[storage-api]',
    error.name,
    code || status,
    message,
    ...(_request.ocrOperationId ? [`operationId=${_request.ocrOperationId}`] : []),
  )
  response.status(status).json({ error: message, ...(code ? { code } : {}) })
})

export default app
