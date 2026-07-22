import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import app from './app.js'

const port = Number(process.env.PORT) || 3001
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.resolve(currentDirectory, '../dist')

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(distDirectory))
  app.get('/{*path}', (_request, response) => response.sendFile(path.join(distDirectory, 'index.html')))
}

app.listen(port, () => {
  console.log(`Toolbox API listening on http://localhost:${port}`)
})
