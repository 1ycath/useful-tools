import { Router } from 'express'
import { fileTypeFromBuffer } from 'file-type'
import multer from 'multer'
import { randomUUID } from 'node:crypto'
import { recognizeImage } from './ocrService.js'

const MAX_IMAGE_SIZE = 4 * 1024 * 1024
const supportedImageTypes = new Set([
  'image/png',
  'image/jpeg',
  'image/bmp',
  'image/gif',
  'image/tiff',
  'image/webp',
])

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
})

const createRequestError = (message, code, status = 400) => {
  const error = new Error(message)
  error.code = code
  error.status = status
  return error
}

const route = (handler) => async (request, response, next) => {
  try {
    await handler(request, response)
  } catch (error) {
    next(error)
  }
}

router.post('/recognize', upload.single('image'), route(async (request, response) => {
  const operationId = randomUUID()
  request.ocrOperationId = operationId
  response.setHeader('x-ocr-operation-id', operationId)

  if (!request.file?.buffer?.length) {
    throw createRequestError('请选择非空图片', 'OCR_EMPTY_FILE')
  }

  const detectedType = await fileTypeFromBuffer(request.file.buffer)
  if (!detectedType || !supportedImageTypes.has(detectedType.mime)) {
    throw createRequestError('仅支持 PNG、JPG、BMP、GIF、TIFF 和 WebP 图片', 'OCR_UNSUPPORTED_FILE')
  }

  response.json(await recognizeImage(request.file.buffer, {
    operationId,
    vercelId: request.headers['x-vercel-id'],
    host: request.headers.host,
    mimeType: detectedType.mime,
    bytes: request.file.buffer.length,
  }))
}))

export default router
