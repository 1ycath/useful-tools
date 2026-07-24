import dotenv from 'dotenv'

dotenv.config({ path: ['.env.ocr.local', '.env.local', '.env'], quiet: true })

const requiredOssVariables = [
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_BUCKET',
  'ALIYUN_OSS_ENDPOINT',
  'ALIYUN_ACCESS_KEY_ID',
  'ALIYUN_ACCESS_KEY_SECRET',
]

export function getOssConfig() {
  const missing = requiredOssVariables.filter((name) => !process.env[name]?.trim())

  if (missing.length > 0) {
    throw new Error(`缺少服务端 OSS 环境变量：${missing.join(', ')}`)
  }

  return {
    region: process.env.ALIYUN_OSS_REGION.trim(),
    bucket: process.env.ALIYUN_OSS_BUCKET.trim(),
    endpoint: process.env.ALIYUN_OSS_ENDPOINT.trim(),
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID.trim(),
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET.trim(),
    secure: true,
  }
}

export function getOcrConfig() {
  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID?.trim()
    || process.env.ALIYUN_ACCESS_KEY_ID?.trim()
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET?.trim()
    || process.env.ALIYUN_ACCESS_KEY_SECRET?.trim()
  const missing = []
  if (!accessKeyId) missing.push('ALIYUN_OCR_ACCESS_KEY_ID')
  if (!accessKeySecret) missing.push('ALIYUN_OCR_ACCESS_KEY_SECRET')

  if (missing.length > 0) {
    const error = new Error(`缺少服务端 OCR 环境变量：${missing.join(', ')}`)
    error.status = 503
    error.code = 'OCR_NOT_CONFIGURED'
    throw error
  }

  const getIntegerOption = (name, fallback, minimum, maximum) => {
    const rawValue = process.env[name]?.trim()
    if (!rawValue) return fallback

    const value = Number(rawValue)
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      const error = new Error(
        `OCR 环境变量 ${name} 必须是 ${minimum} 到 ${maximum} 之间的整数`,
      )
      error.status = 503
      error.code = 'OCR_INVALID_CONFIGURATION'
      throw error
    }

    return value
  }

  return {
    accessKeyId,
    accessKeySecret,
    endpoint: process.env.ALIYUN_OCR_ENDPOINT?.trim() || 'ocr-api.cn-hangzhou.aliyuncs.com',
    connectTimeout: getIntegerOption('ALIYUN_OCR_CONNECT_TIMEOUT_MS', 30000, 1000, 60000),
    readTimeout: getIntegerOption('ALIYUN_OCR_READ_TIMEOUT_MS', 60000, 5000, 120000),
    maxAttempts: getIntegerOption('ALIYUN_OCR_MAX_ATTEMPTS', 2, 1, 4),
    maxConcurrency: getIntegerOption('ALIYUN_OCR_MAX_CONCURRENCY', 2, 1, 10),
    retryBaseDelay: getIntegerOption('ALIYUN_OCR_RETRY_BASE_DELAY_MS', 250, 50, 5000),
    retryMaxDelay: getIntegerOption('ALIYUN_OCR_RETRY_MAX_DELAY_MS', 2000, 100, 10000),
  }
}
