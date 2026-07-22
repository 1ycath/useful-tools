import path from 'node:path'
import OSS from 'ali-oss'
import { getOssConfig } from './config.js'
import { validateName, validateObjectKey, validatePrefix } from './pathSafety.js'

let client

function getClient() {
  if (!client) client = new OSS(getOssConfig())
  return client
}

async function listAll(query) {
  const objects = []
  const prefixes = new Set()
  let continuationToken

  do {
    const result = await getClient().listV2({
      ...query,
      'max-keys': 1000,
      ...(continuationToken ? { 'continuation-token': continuationToken } : {}),
    })
    objects.push(...(result.objects ?? []))
    for (const prefix of result.prefixes ?? []) prefixes.add(prefix)
    continuationToken = result.nextContinuationToken
  } while (continuationToken)

  return { objects, prefixes: [...prefixes] }
}

export async function listDirectory(rawPrefix = '') {
  const prefix = validatePrefix(rawPrefix)
  const { objects, prefixes } = await listAll({ prefix, delimiter: '/' })

  const folders = prefixes.map((key) => ({
    type: 'folder',
    key,
    name: key.slice(prefix.length).replace(/\/$/, ''),
  }))

  const files = objects
    .filter((object) => object.name !== prefix && !object.name.endsWith('/'))
    .map((object) => ({
      type: 'file',
      key: object.name,
      name: object.name.slice(prefix.length),
      size: object.size,
      lastModified: object.lastModified,
      etag: object.etag,
    }))

  return { prefix, items: [...folders, ...files] }
}

export async function createFolder(rawParent, rawName) {
  const parent = validatePrefix(rawParent)
  const name = validateName(rawName, '文件夹名称')
  const key = `${parent}${name}/`
  await getClient().put(key, Buffer.alloc(0))
  return { key, name }
}

export async function uploadFile(rawPrefix, rawName, buffer, contentType) {
  const prefix = validatePrefix(rawPrefix)
  const name = validateName(rawName, '文件名')
  const key = `${prefix}${name}`
  await getClient().put(key, buffer, {
    headers: contentType ? { 'Content-Type': contentType } : undefined,
  })
  return { key, name, size: buffer.length }
}

export async function createDownloadUrl(rawKey) {
  const key = validateObjectKey(rawKey)
  const filename = path.posix.basename(key)
  const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
  const url = await getClient().signatureUrlV4(
    'GET',
    300,
    { queries: { 'response-content-disposition': disposition } },
    key,
  )
  return { url, expiresIn: 300 }
}

async function copyObject(source, destination) {
  await getClient().copy(destination, source)
}

export async function moveEntry(rawSource, rawDestination, isFolder) {
  if (isFolder) {
    const source = validatePrefix(rawSource, { allowRoot: false })
    const destination = validatePrefix(rawDestination, { allowRoot: false })
    if (source === destination) throw new Error('源目录与目标目录相同')
    if (destination.startsWith(source)) throw new Error('不能把文件夹移动到其自身内部')

    const { objects } = await listAll({ prefix: source })
    if (objects.length === 0) throw new Error('源文件夹不存在或为空标记已丢失')

    for (const object of objects) {
      await copyObject(object.name, `${destination}${object.name.slice(source.length)}`)
    }
    await deleteFolder(source)
    return { source, destination, count: objects.length }
  }

  const source = validateObjectKey(rawSource)
  const destination = validateObjectKey(rawDestination)
  if (source === destination) throw new Error('源文件与目标文件相同')
  await copyObject(source, destination)
  await getClient().delete(source)
  return { source, destination, count: 1 }
}

export async function deleteFile(rawKey) {
  const key = validateObjectKey(rawKey)
  await getClient().delete(key)
  return { key }
}

export async function deleteFolder(rawPrefix) {
  const prefix = validatePrefix(rawPrefix, { allowRoot: false })
  let deleted = 0
  let continuationToken

  do {
    const result = await getClient().listV2({
      prefix,
      'max-keys': 1000,
      ...(continuationToken ? { 'continuation-token': continuationToken } : {}),
    })
    const names = (result.objects ?? []).map((object) => object.name)
    if (names.length > 0) {
      await getClient().deleteMulti(names, { quiet: true })
      deleted += names.length
    }
    continuationToken = result.nextContinuationToken
  } while (continuationToken)

  return { prefix, deleted }
}
