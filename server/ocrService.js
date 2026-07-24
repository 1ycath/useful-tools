import OcrSdk, { RecognizeAllTextRequest } from '@alicloud/ocr-api20210707'
import { $OpenApiUtil } from '@alicloud/openapi-core'
import { createHash, randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { getOcrConfig } from './config.js'
import {
  OcrServiceError,
  classifyOcrError,
  createUpstreamResponseError,
  getOcrErrorLogFields,
} from './ocrErrors.js'

let cachedClient = null
let cachedClientKey = ''
let activeOcrRequests = 0
const pendingOcrRequests = []

const toSafeContextValue = (value, maxLength = 200) => String(value ?? '').slice(0, maxLength)

const createLogContext = (context = {}) => ({
  operationId: toSafeContextValue(context.operationId || randomUUID(), 80),
  vercelId: toSafeContextValue(context.vercelId, 200),
  host: toSafeContextValue(context.host, 200),
  mimeType: toSafeContextValue(context.mimeType, 100),
  bytes: Number.isFinite(context.bytes) ? context.bytes : undefined,
  region: process.env.VERCEL_REGION || 'local',
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
})

const logOcrEvent = (level, context, event, fields = {}) => {
  const logMethod = console[level] || console.log
  logMethod('[ocr-api]', JSON.stringify({
    event,
    ...context,
    ...fields,
  }))
}

const getClientKey = (config) => createHash('sha256')
  .update([
    config.accessKeyId,
    config.accessKeySecret,
    config.endpoint,
    config.connectTimeout,
    config.readTimeout,
  ].join('\0'))
  .digest('hex')

const createClient = (config) => {
  const clientKey = getClientKey(config)
  if (cachedClient && cachedClientKey === clientKey) return cachedClient

  const openApiConfig = new $OpenApiUtil.Config({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: config.endpoint,
    connectTimeout: config.connectTimeout,
    readTimeout: config.readTimeout,
  })

  cachedClient = new OcrSdk.default(openApiConfig)
  cachedClientKey = clientKey
  return cachedClient
}

const acquireOcrPermit = (maxConcurrency) => {
  const queuedAt = Date.now()
  if (activeOcrRequests < maxConcurrency) {
    activeOcrRequests += 1
    return Promise.resolve(0)
  }

  return new Promise((resolve) => {
    pendingOcrRequests.push(() => resolve(Date.now() - queuedAt))
  })
}

const releaseOcrPermit = () => {
  const nextRequest = pendingOcrRequests.shift()
  if (nextRequest) {
    nextRequest()
    return
  }
  activeOcrRequests = Math.max(0, activeOcrRequests - 1)
}

const withOcrPermit = async (maxConcurrency, task) => {
  const queueMs = await acquireOcrPermit(maxConcurrency)
  try {
    return await task(queueMs)
  } finally {
    releaseOcrPermit()
  }
}

const sleep = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds)
})

const getRetryDelay = (attempt, config) => {
  const exponentialDelay = config.retryBaseDelay * (2 ** Math.max(0, attempt - 1))
  const jitter = Math.floor(Math.random() * config.retryBaseDelay)
  return Math.min(config.retryMaxDelay, exponentialDelay + jitter)
}

const parseRecognitionData = (rawData) => {
  if (rawData === null || rawData === undefined) {
    throw new OcrServiceError('OCR 返回了无法解析的结果', 'OCR_INVALID_RESPONSE')
  }

  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
    return String(data?.content ?? '').replace(/\r\n?/g, '\n').trim()
  } catch (error) {
    throw new OcrServiceError(
      'OCR 返回了无法解析的结果',
      'OCR_INVALID_RESPONSE',
      502,
      { cause: error },
    )
  }
}

const callOcr = async (client, buffer) => {
  // Streams are single-use. Always create a fresh request and stream for every attempt.
  const request = new RecognizeAllTextRequest({
    body: Readable.from([buffer]),
    type: 'General',
  })
  const response = await client.recognizeAllText(request)
  const responseBody = response?.body

  if (!responseBody) {
    throw new OcrServiceError('OCR 返回了空响应', 'OCR_INVALID_RESPONSE')
  }

  if (responseBody.code != null && String(responseBody.code) !== '200') {
    throw createUpstreamResponseError(responseBody, response?.statusCode)
  }

  return {
    text: parseRecognitionData(responseBody.data),
    requestId: responseBody.requestId || '',
  }
}

const executeWithRetry = async (client, buffer, config, logContext) => {
  for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
    const attemptStartedAt = Date.now()
    logOcrEvent('info', logContext, 'sdk_call_started', {
      attempt,
      maxAttempts: config.maxAttempts,
    })

    try {
      const result = await callOcr(client, buffer)
      logOcrEvent('info', logContext, 'sdk_call_succeeded', {
        attempt,
        elapsedMs: Date.now() - attemptStartedAt,
        upstreamRequestId: result.requestId,
        textLength: result.text.length,
      })
      return result
    } catch (rawError) {
      const error = classifyOcrError(rawError)
      const canRetry = error.retryable && attempt < config.maxAttempts
      const elapsedMs = Date.now() - attemptStartedAt

      if (!canRetry) {
        logOcrEvent('error', logContext, 'sdk_call_failed', {
          attempt,
          maxAttempts: config.maxAttempts,
          elapsedMs,
          ...getOcrErrorLogFields(error),
        })
        throw error
      }

      const retryDelayMs = getRetryDelay(attempt, config)
      logOcrEvent('warn', logContext, 'sdk_call_retry_scheduled', {
        attempt,
        maxAttempts: config.maxAttempts,
        elapsedMs,
        retryDelayMs,
        ...getOcrErrorLogFields(error),
      })
      await sleep(retryDelayMs)
    }
  }

  throw new OcrServiceError('阿里云 OCR 识别失败，请稍后重试', 'OCR_UPSTREAM_ERROR')
}

export async function recognizeImage(buffer, context = {}) {
  const startedAt = Date.now()
  const logContext = createLogContext({
    ...context,
    bytes: context.bytes ?? buffer?.length,
  })
  let config

  try {
    config = getOcrConfig()
  } catch (rawError) {
    const error = classifyOcrError(rawError)
    logOcrEvent('error', logContext, 'configuration_failed', {
      elapsedMs: Date.now() - startedAt,
      ...getOcrErrorLogFields(error),
    })
    throw error
  }

  logOcrEvent('info', logContext, 'request_received', {
    maxAttempts: config.maxAttempts,
    maxConcurrency: config.maxConcurrency,
  })

  return withOcrPermit(config.maxConcurrency, async (queueMs) => {
    if (queueMs > 0) {
      logOcrEvent('info', logContext, 'request_dequeued', {
        queueMs,
        activeRequests: activeOcrRequests,
      })
    }

    try {
      const client = createClient(config)
      const result = await executeWithRetry(client, buffer, config, logContext)
      logOcrEvent('info', logContext, 'request_succeeded', {
        elapsedMs: Date.now() - startedAt,
        queueMs,
        upstreamRequestId: result.requestId,
      })
      return result
    } catch (rawError) {
      const error = classifyOcrError(rawError)
      logOcrEvent('error', logContext, 'request_failed', {
        elapsedMs: Date.now() - startedAt,
        queueMs,
        ...getOcrErrorLogFields(error),
      })
      throw error
    }
  })
}
