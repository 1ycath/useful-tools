import { Router } from 'express'
import multer from 'multer'
import { decodeMultipartFilename } from './fileName.js'
import {
  createDownloadUrl,
  createFolder,
  deleteFile,
  deleteFolder,
  listDirectory,
  moveEntry,
  uploadFile,
} from './ossService.js'

const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
})

const route = (handler) => async (request, response, next) => {
  try {
    await handler(request, response)
  } catch (error) {
    next(error)
  }
}

router.get('/list', route(async (request, response) => {
  response.json(await listDirectory(request.query.prefix ?? ''))
}))

router.post('/folders', route(async (request, response) => {
  response.status(201).json(await createFolder(request.body.parent ?? '', request.body.name))
}))

router.post('/upload', upload.single('file'), route(async (request, response) => {
  if (!request.file) throw new Error('请选择要上传的文件')
  response.status(201).json(await uploadFile(
    request.body.prefix ?? '',
    decodeMultipartFilename(request.file.originalname),
    request.file.buffer,
    request.file.mimetype,
  ))
}))

router.get('/download-url', route(async (request, response) => {
  response.json(await createDownloadUrl(request.query.key))
}))

router.patch('/move', route(async (request, response) => {
  const { source, destination, isFolder = false } = request.body
  response.json(await moveEntry(source, destination, Boolean(isFolder)))
}))

router.delete('/file', route(async (request, response) => {
  response.json(await deleteFile(request.query.key))
}))

router.delete('/folder', route(async (request, response) => {
  response.json(await deleteFolder(request.query.prefix))
}))

export default router
