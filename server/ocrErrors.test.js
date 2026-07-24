import assert from 'node:assert/strict'
import test from 'node:test'
import {
  OcrServiceError,
  classifyOcrError,
  createUpstreamResponseError,
  getOcrErrorLogFields,
} from './ocrErrors.js'

test('classifies throttling errors as retryable rate limits', () => {
  const upstreamError = createUpstreamResponseError({
    code: 'Throttling.User',
    message: 'Request denied because the throttling threshold is reached.',
    requestId: 'request-rate-limit',
  }, 400)
  const error = classifyOcrError(upstreamError)

  assert.equal(error.code, 'OCR_RATE_LIMITED')
  assert.equal(error.status, 429)
  assert.equal(error.retryable, true)
  assert.equal(error.upstreamRequestId, 'request-rate-limit')
})

test('classifies network timeouts as retryable gateway timeouts', () => {
  const upstreamError = new Error('connect ETIMEDOUT')
  upstreamError.code = 'ETIMEDOUT'
  const error = classifyOcrError(upstreamError)

  assert.equal(error.code, 'OCR_UPSTREAM_TIMEOUT')
  assert.equal(error.status, 504)
  assert.equal(error.retryable, true)
})

test('classifies unavailable upstream responses as retryable', () => {
  const upstreamError = createUpstreamResponseError({
    code: 'ServiceUnavailable',
    message: 'Server error.',
    requestId: 'request-unavailable',
  }, 503)
  const error = classifyOcrError(upstreamError)

  assert.equal(error.code, 'OCR_UPSTREAM_UNAVAILABLE')
  assert.equal(error.status, 503)
  assert.equal(error.retryable, true)
})

test('retries code-less SDK errors as transient network failures', () => {
  const error = classifyOcrError(new Error('socket closed unexpectedly'))

  assert.equal(error.code, 'OCR_NETWORK_ERROR')
  assert.equal(error.status, 502)
  assert.equal(error.retryable, true)
})

test('does not retry authentication errors', () => {
  const upstreamError = createUpstreamResponseError({
    code: 'noPermission',
    message: 'You are not authorized to perform this operation.',
    requestId: 'request-auth',
  }, 401)
  const error = classifyOcrError(upstreamError)

  assert.equal(error.code, 'OCR_AUTH_FAILED')
  assert.equal(error.status, 502)
  assert.equal(error.retryable, false)
})

test('does not retry invalid image errors', () => {
  const upstreamError = createUpstreamResponseError({
    code: 'illegalImageContent',
    message: 'The corresponding image content is missing.',
    requestId: 'request-input',
  }, 400)
  const error = classifyOcrError(upstreamError)

  assert.equal(error.code, 'OCR_UPSTREAM_REJECTED')
  assert.equal(error.status, 422)
  assert.equal(error.retryable, false)
})

test('preserves local service errors', () => {
  const original = new OcrServiceError(
    'OCR 返回了无法解析的结果',
    'OCR_INVALID_RESPONSE',
  )

  assert.equal(classifyOcrError(original), original)
})

test('redacts credentials from structured log fields', () => {
  const upstreamError = new Error(
    'request failed AccessKeyId=LTAI123456789&Signature=top-secret',
  )
  const fields = getOcrErrorLogFields(classifyOcrError(upstreamError))
  const serialized = JSON.stringify(fields)

  assert.equal(serialized.includes('LTAI123456789'), false)
  assert.equal(serialized.includes('top-secret'), false)
})
