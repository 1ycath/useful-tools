const NETWORK_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
])

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])
const RATE_LIMIT_PATTERN = /throttl|rate.?limit|quota|qps|too many|频繁|限流/i
const TIMEOUT_PATTERN = /timeout|timed out|etimedout|algorithm.?timeout|service.?timeout|超时/i
const UNAVAILABLE_PATTERN = /service.?unavailable|algorithm.?error|internal.?error|server.?error|temporar|服务异常|服务器错误/i
const AUTH_PATTERN = /invalidaccesskey|signaturedoesnotmatch|forbidden|nopermission|unauthori[sz]ed|ocrservicenotopen|ocrserviceexpired|鉴权|未授权|欠费/i
const INPUT_PATTERN = /invalid.?input|illegal.?image|unsupported|exceeded.?image|missing.?image|unmatched.?image|payload.?too.?large/i
const SDK_RETRYABLE_NAMES = new Set(['RetryError', 'UnretryableError'])

const firstValue = (...values) => values.find((value) => value !== undefined
  && value !== null
  && String(value).trim() !== '')

const toStatusCode = (value) => {
  const statusCode = Number(value)
  return Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599
    ? statusCode
    : undefined
}

const sanitizeLogValue = (value, maxLength = 500) => String(value ?? '')
  .replace(
    /(accesskeyid|accesskeysecret|signature|securitytoken|authorization)=([^&\s]+)/gi,
    '$1=[redacted]',
  )
  .replace(/LTAI[A-Za-z0-9]+/g, '[redacted-access-key-id]')
  .slice(0, maxLength)

const getErrorDetails = (error) => {
  const cause = error?.cause
  const data = error?.data
  const causeData = cause?.data
  const code = String(firstValue(
    error?.code,
    data?.Code,
    data?.code,
    cause?.code,
    causeData?.Code,
    causeData?.code,
  ) ?? '')
  const statusCode = toStatusCode(firstValue(
    error?.statusCode,
    error?.status,
    data?.statusCode,
    cause?.statusCode,
    cause?.status,
    causeData?.statusCode,
  ))
  const requestId = String(firstValue(
    error?.requestId,
    data?.RequestId,
    data?.requestId,
    cause?.requestId,
    causeData?.RequestId,
    causeData?.requestId,
  ) ?? '')
  const message = String(firstValue(
    error?.message,
    data?.Message,
    data?.message,
    cause?.message,
    causeData?.Message,
    causeData?.message,
  ) ?? '')

  return {
    name: String(error?.name || 'Error'),
    code,
    statusCode,
    requestId,
    message,
    causeName: String(cause?.name || ''),
    causeCode: String(cause?.code || ''),
    causeMessage: String(cause?.message || ''),
  }
}

export class OcrServiceError extends Error {
  constructor(message, code, status = 502, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'OcrServiceError'
    this.code = code
    this.status = status
    this.retryable = Boolean(options.retryable)
    this.upstreamCode = options.upstreamCode || ''
    this.upstreamRequestId = options.upstreamRequestId || ''
  }
}

export const createUpstreamResponseError = (responseBody, statusCode) => {
  const error = new Error(responseBody?.message || '阿里云 OCR 返回业务错误')
  error.name = 'OcrUpstreamResponseError'
  error.code = String(responseBody?.code || 'OCR_UPSTREAM_ERROR')
  error.statusCode = statusCode
  error.requestId = responseBody?.requestId || ''
  error.data = responseBody
  return error
}

export const classifyOcrError = (error) => {
  if (error instanceof OcrServiceError || error?.code === 'OCR_NOT_CONFIGURED'
    || error?.code === 'OCR_INVALID_CONFIGURATION') {
    return error
  }

  const details = getErrorDetails(error)
  const searchable = `${details.name} ${details.code} ${details.message} ${details.causeName} ${details.causeCode} ${details.causeMessage}`
  const networkCode = details.code || details.causeCode
  const isCodeLessSdkError = details.name === 'Error'
    && !details.code
    && !details.statusCode
    && !AUTH_PATTERN.test(searchable)
    && !INPUT_PATTERN.test(searchable)

  if (RATE_LIMIT_PATTERN.test(searchable) || details.statusCode === 429) {
    return new OcrServiceError(
      '阿里云 OCR 请求过于频繁，请稍后重试',
      'OCR_RATE_LIMITED',
      429,
      {
        cause: error,
        retryable: true,
        upstreamCode: details.code,
        upstreamRequestId: details.requestId,
      },
    )
  }

  if (TIMEOUT_PATTERN.test(searchable) || details.statusCode === 408
    || details.statusCode === 504) {
    return new OcrServiceError(
      '阿里云 OCR 响应超时，请稍后重试',
      'OCR_UPSTREAM_TIMEOUT',
      504,
      {
        cause: error,
        retryable: true,
        upstreamCode: details.code,
        upstreamRequestId: details.requestId,
      },
    )
  }

  if (NETWORK_ERROR_CODES.has(networkCode) || SDK_RETRYABLE_NAMES.has(details.name)
    || SDK_RETRYABLE_NAMES.has(details.causeName) || isCodeLessSdkError) {
    return new OcrServiceError(
      '暂时无法连接阿里云 OCR，请稍后重试',
      'OCR_NETWORK_ERROR',
      502,
      {
        cause: error,
        retryable: true,
        upstreamCode: details.code,
        upstreamRequestId: details.requestId,
      },
    )
  }

  if (RETRYABLE_STATUS_CODES.has(details.statusCode)
    || UNAVAILABLE_PATTERN.test(searchable)) {
    return new OcrServiceError(
      '阿里云 OCR 服务暂时不可用，请稍后重试',
      'OCR_UPSTREAM_UNAVAILABLE',
      503,
      {
        cause: error,
        retryable: true,
        upstreamCode: details.code,
        upstreamRequestId: details.requestId,
      },
    )
  }

  if (AUTH_PATTERN.test(searchable) || details.statusCode === 401
    || details.statusCode === 403) {
    return new OcrServiceError(
      '阿里云 OCR 鉴权失败，请联系管理员',
      'OCR_AUTH_FAILED',
      502,
      {
        cause: error,
        upstreamCode: details.code,
        upstreamRequestId: details.requestId,
      },
    )
  }

  if (INPUT_PATTERN.test(searchable) || [400, 413, 415, 416].includes(details.statusCode)) {
    return new OcrServiceError(
      '图片未通过阿里云 OCR 校验，请检查图片内容后重试',
      'OCR_UPSTREAM_REJECTED',
      422,
      {
        cause: error,
        upstreamCode: details.code,
        upstreamRequestId: details.requestId,
      },
    )
  }

  return new OcrServiceError(
    '阿里云 OCR 识别失败，请稍后重试',
    'OCR_UPSTREAM_ERROR',
    502,
    {
      cause: error,
      upstreamCode: details.code,
      upstreamRequestId: details.requestId,
    },
  )
}

export const getOcrErrorLogFields = (error) => {
  const details = getErrorDetails(error)
  return {
    errorName: sanitizeLogValue(details.name, 100),
    errorCode: sanitizeLogValue(error?.code || details.code, 120),
    statusCode: error?.status || details.statusCode || undefined,
    retryable: Boolean(error?.retryable),
    upstreamCode: sanitizeLogValue(error?.upstreamCode || details.code, 120),
    upstreamRequestId: sanitizeLogValue(
      error?.upstreamRequestId || details.requestId,
      160,
    ),
    errorMessage: sanitizeLogValue(details.message),
    causeName: sanitizeLogValue(details.causeName, 100),
    causeCode: sanitizeLogValue(details.causeCode, 120),
    causeMessage: sanitizeLogValue(details.causeMessage),
  }
}
