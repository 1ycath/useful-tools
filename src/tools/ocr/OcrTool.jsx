import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './ocr.css'

const MAX_FILES = 20
const MAX_FILE_SIZE = 4 * 1024 * 1024
const CONCURRENCY = 3
const STORAGE_KEY = 'toolbox-ocr-results-v1'
const ACCEPTED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tif', 'tiff', 'webp'])
const ACCEPTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/bmp',
  'image/gif',
  'image/tiff',
  'image/webp',
])

const normalizeText = (text) => String(text ?? '').replace(/\r\n?/g, '\n').trim()

const formatFileSize = (bytes) => {
  if (!bytes) return '本地已恢复'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getFileSignature = (file) => `${file.name}:${file.size}:${file.lastModified}`

const getExtension = (name) => name.toLowerCase().split('.').pop()

const isSupportedImage = (file) => (
  ACCEPTED_MIME_TYPES.has(file.type) || ACCEPTED_EXTENSIONS.has(getExtension(file.name))
)

const createLocalId = () => (
  globalThis.crypto?.randomUUID?.() || `ocr-${Date.now()}-${Math.random().toString(16).slice(2)}`
)

const loadSavedResults = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.version !== 1 || !Array.isArray(saved.items) || !saved.items.length) {
      return { items: [], savedAt: null }
    }

    return {
      savedAt: saved.savedAt || null,
      items: saved.items.slice(0, MAX_FILES).map((item, index) => ({
        id: `restored-${index}-${createLocalId()}`,
        signature: `restored:${index}:${item.name}`,
        name: String(item.name || `图片 ${index + 1}`),
        size: 0,
        type: '',
        file: null,
        previewUrl: '',
        previewFailed: false,
        status: 'success',
        text: normalizeText(item.text),
        error: '',
        requestId: '',
        restored: true,
      })),
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return { items: [], savedAt: null }
  }
}

const statusLabels = {
  pending: '等待识别',
  processing: '识别中',
  success: '已完成',
  error: '识别失败',
}

function OcrTool() {
  const [initialSavedResults] = useState(loadSavedResults)
  const [items, setItems] = useState(initialSavedResults.items)
  const [completedAt, setCompletedAt] = useState(initialSavedResults.savedAt)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [message, setMessage] = useState(
    initialSavedResults.items.length
      ? '已恢复上次保存的文本结果，原图片未保存。'
      : '最多添加 20 张图片，确认顺序后再开始识别。',
  )
  const [messageType, setMessageType] = useState(initialSavedResults.items.length ? 'success' : 'info')
  const inputRef = useRef(null)
  const dragDepth = useRef(0)
  const previewUrls = useRef(new Set())

  const successfulItems = useMemo(
    () => items.filter((item) => item.status === 'success'),
    [items],
  )

  const combinedText = useMemo(
    () => successfulItems
      .map((item) => `【${item.name}】\n${normalizeText(item.text)}`)
      .join('\n\n'),
    [successfulItems],
  )

  const fileItems = items.filter((item) => item.file)
  const completedFiles = fileItems.filter((item) => ['success', 'error'].includes(item.status)).length
  const pendingFiles = fileItems.filter((item) => ['pending', 'error'].includes(item.status))

  useEffect(() => {
    if (!successfulItems.length) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      savedAt: completedAt || new Date().toISOString(),
      items: successfulItems.map((item) => ({
        name: item.name,
        text: normalizeText(item.text),
      })),
    }))
  }, [completedAt, successfulItems])

  useEffect(() => {
    const urls = previewUrls.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const updateItem = (id, changes) => {
    setItems((currentItems) => currentItems.map((item) => (
      item.id === id ? { ...item, ...changes } : item
    )))
  }

  const revokePreview = (item) => {
    if (!item.previewUrl) return
    URL.revokeObjectURL(item.previewUrl)
    previewUrls.current.delete(item.previewUrl)
  }

  const clearPreviews = (currentItems = items) => {
    currentItems.forEach(revokePreview)
  }

  const addFiles = (incomingFiles) => {
    const incoming = Array.from(incomingFiles)
    if (!incoming.length || isProcessing) return

    const replacingRestored = items.some((item) => item.restored)
    const baseItems = replacingRestored ? [] : items
    const signatures = new Set(baseItems.map((item) => item.signature))
    const accepted = []
    let invalidCount = 0
    let emptyCount = 0
    let oversizedCount = 0
    let duplicateCount = 0
    let limitCount = 0

    for (const file of incoming) {
      if (baseItems.length + accepted.length >= MAX_FILES) {
        limitCount += 1
        continue
      }
      if (!file.size) {
        emptyCount += 1
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        oversizedCount += 1
        continue
      }
      if (!isSupportedImage(file)) {
        invalidCount += 1
        continue
      }

      const signature = getFileSignature(file)
      if (signatures.has(signature)) {
        duplicateCount += 1
        continue
      }

      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.add(previewUrl)
      signatures.add(signature)
      accepted.push({
        id: createLocalId(),
        signature,
        name: file.name,
        size: file.size,
        type: file.type,
        file,
        previewUrl,
        previewFailed: false,
        status: 'pending',
        text: '',
        error: '',
        requestId: '',
        restored: false,
      })
    }

    if (replacingRestored && accepted.length) {
      clearPreviews(items)
      localStorage.removeItem(STORAGE_KEY)
    }

    if (accepted.length) {
      setItems([...baseItems, ...accepted])
      setCompletedAt(null)
    }

    const ignored = []
    if (invalidCount) ignored.push(`${invalidCount} 张格式不支持`)
    if (emptyCount) ignored.push(`${emptyCount} 张为空文件`)
    if (oversizedCount) ignored.push(`${oversizedCount} 张超过 4 MB`)
    if (duplicateCount) ignored.push(`${duplicateCount} 张重复`)
    if (limitCount) ignored.push(`${limitCount} 张超过数量上限`)

    if (ignored.length) {
      setMessage(`${accepted.length ? `已添加 ${accepted.length} 张；` : ''}${ignored.join('，')}，已忽略。`)
      setMessageType('error')
    } else if (accepted.length) {
      setMessage(`已添加 ${accepted.length} 张图片，共 ${baseItems.length + accepted.length} 张。`)
      setMessageType('success')
    }
  }

  const handleInputChange = (event) => {
    addFiles(event.target.files)
    event.target.value = ''
  }

  const handleDragEnter = (event) => {
    event.preventDefault()
    dragDepth.current += 1
    setIsDragging(true)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setIsDragging(false)
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const removeItem = (id) => {
    if (isProcessing) return
    const item = items.find((currentItem) => currentItem.id === id)
    if (item) revokePreview(item)
    setItems((currentItems) => currentItems.filter((currentItem) => currentItem.id !== id))
    setMessage('')
  }

  const clearResults = () => {
    if (isProcessing) return
    clearPreviews()
    setItems([])
    setCompletedAt(null)
    localStorage.removeItem(STORAGE_KEY)
    setMessage('已清空图片和本地保存的识别结果。')
    setMessageType('info')
  }

  const recognizeItem = async (item) => {
    updateItem(item.id, { status: 'processing', error: '' })

    try {
      const formData = new FormData()
      formData.append('image', item.file, item.name)
      const response = await fetch('/api/ocr/recognize', {
        method: 'POST',
        body: formData,
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const error = new Error(data.error || '识别失败，请稍后重试')
        error.code = data.code || ''
        throw error
      }

      updateItem(item.id, {
        status: 'success',
        text: normalizeText(data.text),
        requestId: data.requestId || '',
        error: '',
      })
      return true
    } catch (error) {
      updateItem(item.id, {
        status: 'error',
        error: error.message || '识别失败，请稍后重试',
      })
      return false
    }
  }

  const startRecognition = async () => {
    const targets = items.filter((item) => item.file && ['pending', 'error'].includes(item.status))
    if (!targets.length || isProcessing) return

    setIsProcessing(true)
    setMessage(`正在识别 ${targets.length} 张图片，请保持页面打开。`)
    setMessageType('info')

    let nextIndex = 0
    let successCount = 0
    const worker = async () => {
      while (nextIndex < targets.length) {
        const targetIndex = nextIndex
        nextIndex += 1
        if (await recognizeItem(targets[targetIndex])) successCount += 1
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker()),
    )

    const failedCount = targets.length - successCount
    setCompletedAt(new Date().toISOString())
    setIsProcessing(false)
    setMessage(
      failedCount
        ? `识别完成：成功 ${successCount} 张，失败 ${failedCount} 张，可单独重试失败项。`
        : `识别完成，共成功处理 ${successCount} 张图片。`,
    )
    setMessageType(failedCount ? 'error' : 'success')
  }

  const retryItem = async (item) => {
    if (!item.file || isProcessing) return
    setIsProcessing(true)
    setMessage(`正在重新识别 ${item.name}…`)
    setMessageType('info')
    const succeeded = await recognizeItem(item)
    setCompletedAt(new Date().toISOString())
    setIsProcessing(false)
    setMessage(succeeded ? `${item.name} 已重新识别完成。` : `${item.name} 仍未识别成功。`)
    setMessageType(succeeded ? 'success' : 'error')
  }

  const copyCombinedText = async () => {
    if (!combinedText) return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(combinedText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = combinedText
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.append(textarea)
        textarea.select()
        const copied = document.execCommand('copy')
        textarea.remove()
        if (!copied) throw new Error('copy failed')
      }

      setMessage('已复制合并全文。')
      setMessageType('success')
    } catch {
      setMessage('复制失败，请在合并全文文本框中手动复制。')
      setMessageType('error')
    }
  }

  const downloadText = () => {
    if (!combinedText) return

    const recognizedAt = completedAt ? new Date(completedAt) : new Date()
    const datePart = recognizedAt.toISOString().slice(0, 10).replaceAll('-', '')
    const blob = new Blob([`\uFEFF${combinedText}`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `OCR识别结果-${datePart}.txt`
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    setMessage('TXT 文档已下载。')
    setMessageType('success')
  }

  const downloadWord = async () => {
    if (!successfulItems.length || isExporting) return
    setIsExporting(true)
    setMessage('正在生成 Word 文档…')
    setMessageType('info')

    try {
      const { Document, HeadingLevel, Packer, Paragraph } = await import('docx')
      const recognizedAt = completedAt ? new Date(completedAt) : new Date()
      const children = [
        new Paragraph({ text: 'OCR 识别结果', heading: HeadingLevel.TITLE }),
        new Paragraph({
          text: `生成时间：${recognizedAt.toLocaleString('zh-CN', { hour12: false })}`,
        }),
      ]

      successfulItems.forEach((item, index) => {
        children.push(new Paragraph({
          text: `${index + 1}. ${item.name}`,
          heading: HeadingLevel.HEADING_1,
        }))
        const lines = normalizeText(item.text).split('\n')
        if (!lines.length || (lines.length === 1 && !lines[0])) {
          children.push(new Paragraph({ text: '（未识别到文字）' }))
        } else {
          lines.forEach((line) => children.push(new Paragraph({ text: line })))
        }
      })

      const documentFile = new Document({ sections: [{ children }] })
      const blob = await Packer.toBlob(documentFile)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const datePart = recognizedAt.toISOString().slice(0, 10).replaceAll('-', '')
      link.href = url
      link.download = `OCR识别结果-${datePart}.docx`
      link.hidden = true
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      setMessage(`Word 文档已生成，包含 ${successfulItems.length} 张图片的文字。`)
      setMessageType('success')
    } catch {
      setMessage('Word 文档生成失败，请稍后重试。')
      setMessageType('error')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className="tool-page ocr-page">
      <Link className="back-link" to="/"><span aria-hidden="true">←</span>返回工具大厅</Link>
      <section className="tool-panel ocr-panel">
        <div className="panel-heading ocr-heading">
          <div className="tool-icon green" aria-hidden="true">▣</div>
          <div>
            <span className="eyebrow">ALIYUN BATCH OCR</span>
            <h1>图片 OCR</h1>
          </div>
        </div>

        <div className="ocr-privacy-note">
          <span aria-hidden="true">云</span>
          <div>
            <strong>通过阿里云识别，本地保留文本</strong>
            <small>图片仅用于本次识别，不写入本站存储；刷新后只恢复文件名和文字。</small>
          </div>
        </div>

        <div
          className={`ocr-drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="ocr-drop-icon" aria-hidden="true">图</div>
          <h2>{isDragging ? '松开即可添加图片' : '拖拽多张图片到这里'}</h2>
          <p>PNG、JPG、BMP、GIF、TIFF、WebP · 每张不超过 4 MB · 最多 20 张</p>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept=".png,.jpg,.jpeg,.bmp,.gif,.tif,.tiff,.webp,image/png,image/jpeg,image/bmp,image/gif,image/tiff,image/webp"
            multiple
            onChange={handleInputChange}
          />
          <button
            className="ocr-select-button"
            type="button"
            disabled={isProcessing}
            onClick={() => inputRef.current?.click()}
          >
            选择图片
          </button>
        </div>

        {fileItems.length > 0 && isProcessing && (
          <div className="ocr-progress" aria-live="polite">
            <div>
              <span>批量识别进度</span>
              <strong>{completedFiles} / {fileItems.length}</strong>
            </div>
            <progress max={fileItems.length} value={completedFiles}>{completedFiles}</progress>
          </div>
        )}

        {items.length > 0 && (
          <section className="ocr-files-section" aria-labelledby="ocr-files-title">
            <div className="ocr-section-heading">
              <div>
                <h2 id="ocr-files-title">图片与识别文本</h2>
                <small>{items.length} / {MAX_FILES} 张</small>
              </div>
              <button type="button" disabled={isProcessing} onClick={clearResults}>清空全部</button>
            </div>

            <div className="ocr-file-list">
              {items.map((item, index) => (
                <article className={`ocr-file-card ${item.status}`} key={item.id}>
                  <div className="ocr-file-summary">
                    <div className="ocr-thumbnail">
                      {item.previewUrl && !item.previewFailed ? (
                        <img
                          src={item.previewUrl}
                          alt=""
                          onError={() => updateItem(item.id, { previewFailed: true })}
                        />
                      ) : (
                        <span aria-hidden="true">文</span>
                      )}
                    </div>
                    <span className="ocr-order">{index + 1}</span>
                    <div className="ocr-file-meta">
                      <strong title={item.name}>{item.name}</strong>
                      <small>{formatFileSize(item.size)}{item.restored ? ' · 仅文本' : ''}</small>
                    </div>
                    <span className={`ocr-status-badge ${item.status}`}>
                      {statusLabels[item.status]}
                    </span>
                    <button
                      className="ocr-remove-button"
                      type="button"
                      disabled={isProcessing}
                      onClick={() => removeItem(item.id)}
                      aria-label={`移除 ${item.name}`}
                    >
                      移除
                    </button>
                  </div>

                  {item.status === 'success' && (
                    <label className="ocr-text-field">
                      <span>识别文本</span>
                      <textarea
                        value={item.text}
                        rows={6}
                        onChange={(event) => updateItem(item.id, { text: event.target.value })}
                        placeholder="未识别到文字，你也可以在这里手动补充。"
                      />
                    </label>
                  )}

                  {item.status === 'error' && (
                    <div className="ocr-file-error" role="alert">
                      <span>{item.error}</span>
                      <button type="button" disabled={isProcessing} onClick={() => retryItem(item)}>
                        重新识别
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {message && (
          <p className={`ocr-message ${messageType}`} role="status" aria-live="polite">{message}</p>
        )}

        {items.length > 0 && (
          <div className="ocr-primary-actions">
            <button
              className="ocr-start-button"
              type="button"
              disabled={!pendingFiles.length || isProcessing}
              onClick={startRecognition}
            >
              {isProcessing ? '正在识别…' : `开始识别${pendingFiles.length ? `（${pendingFiles.length} 张）` : ''}`}
            </button>
          </div>
        )}

        {successfulItems.length > 0 && (
          <section className="ocr-combined-section" aria-labelledby="ocr-combined-title">
            <div className="ocr-section-heading">
              <div>
                <h2 id="ocr-combined-title">合并全文</h2>
                <small>按图片顺序自动整理，共 {successfulItems.length} 段</small>
              </div>
            </div>
            <textarea
              className="ocr-combined-text"
              value={combinedText}
              rows={12}
              readOnly
              aria-label="合并后的全部识别文本"
            />
            <div className="ocr-export-actions">
              <button
                className="ocr-export-button copy"
                type="button"
                onClick={copyCombinedText}
              >
                一键复制全文
                <small>复制到剪贴板</small>
              </button>
              <button
                className="ocr-export-button text"
                type="button"
                onClick={downloadText}
              >
                下载 TXT
                <small>纯文本 · .txt</small>
              </button>
              <button
                className="ocr-download-button"
                type="button"
                disabled={isExporting}
                onClick={downloadWord}
              >
                {isExporting ? '正在生成 Word…' : '下载 Word 文档'}
                <small>{successfulItems.length} 个图片分段 · .docx</small>
              </button>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default OcrTool
