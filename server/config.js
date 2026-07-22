import dotenv from 'dotenv'

dotenv.config({ path: ['.env.local', '.env'], quiet: true })

const requiredVariables = [
  'ALIYUN_OSS_REGION',
  'ALIYUN_OSS_BUCKET',
  'ALIYUN_OSS_ENDPOINT',
  'ALIYUN_ACCESS_KEY_ID',
  'ALIYUN_ACCESS_KEY_SECRET',
]

export function getOssConfig() {
  const missing = requiredVariables.filter((name) => !process.env[name]?.trim())

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
