import OcrSdk, { RecognizeAllTextRequest } from '@alicloud/ocr-api20210707'
import { $OpenApiUtil } from '@alicloud/openapi-core'
import { Readable } from 'node:stream'
import { getOcrConfig } from './config.js'

class OcrServiceError extends Error {
  constructor(message, code, status = 502) {
    super(message)
    this.name = 'OcrServiceError'
    this.code = code
    this.status = status
  }
}

let cachedClient = null
let cachedClientKey = ''

const createClient = () => {
  const config = getOcrConfig()
  const clientKey = `${config.accessKeyId}:${config.accessKeySecret}:${config.endpoint}`

  if (cachedClient && cachedClientKey === clientKey) return cachedClient

  const openApiConfig = new $OpenApiUtil.Config({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: config.endpoint,
    connectTimeout: 10000,
    readTimeout: 60000,
  })

  cachedClient = new OcrSdk.default(openApiConfig)
  cachedClientKey = clientKey
  return cachedClient
}

const parseRecognitionData = (rawData) => {
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
    return String(data?.content ?? '').replace(/\r\n?/g, '\n').trim()
  } catch {
    throw new OcrServiceError('OCR 返回了无法解析的结果', 'OCR_INVALID_RESPONSE')
  }
}

const toServiceError = (error) => {
  if (error instanceof OcrServiceError || error?.code === 'OCR_NOT_CONFIGURED') return error

  const upstreamCode = String(error?.code || error?.data?.Code || '')
  const upstreamMessage = String(error?.message || error?.data?.Message || '')
  const isRateLimited = /throttl|limit|quota|qps/i.test(`${upstreamCode} ${upstreamMessage}`)

  if (isRateLimited) {
    return new OcrServiceError('阿里云 OCR 请求过于频繁，请稍后重试', 'OCR_RATE_LIMITED', 429)
  }

  return new OcrServiceError('阿里云 OCR 识别失败，请稍后重试', upstreamCode || 'OCR_UPSTREAM_ERROR')
}

export async function recognizeImage(buffer) {
  try {
    const client = createClient()
    const request = new RecognizeAllTextRequest({
      body: Readable.from([buffer]),
      type: 'General',
    })
    const response = await client.recognizeAllText(request)
    const responseBody = response?.body

    if (responseBody?.code != null && String(responseBody.code) !== '200') {
      const code = String(responseBody?.code || 'OCR_UPSTREAM_ERROR')
      const message = responseBody?.message || '阿里云 OCR 识别失败'
      const isRateLimited = /throttl|limit|quota|qps/i.test(`${code} ${message}`)
      throw new OcrServiceError(
        isRateLimited ? '阿里云 OCR 请求过于频繁，请稍后重试' : message,
        isRateLimited ? 'OCR_RATE_LIMITED' : code,
        isRateLimited ? 429 : 502,
      )
    }

    return {
      text: parseRecognitionData(responseBody.data),
      requestId: responseBody.requestId || '',
    }
  } catch (error) {
    throw toServiceError(error)
  }
}
