import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PDFDocument } from 'pdf-lib'
import './pdfMerge.css'

const MAX_FILES = 2

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isPdf = (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

const getOutputName = (fileName) => {
  const baseName = fileName.replace(/\.pdf$/i, '').trim() || 'PDF'
  return `${baseName}-合并.pdf`
}

function PdfMergeTool() {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isMerging, setIsMerging] = useState(false)
  const [message, setMessage] = useState('请选择两个 PDF，文件顺序就是合并顺序。')
  const [messageType, setMessageType] = useState('info')
  const [result, setResult] = useState(null)
  const inputRef = useRef(null)
  const dragDepth = useRef(0)
  const nextId = useRef(0)

  useEffect(() => {
    if (!result?.url) return undefined
    return () => URL.revokeObjectURL(result.url)
  }, [result])

  const clearResult = () => setResult(null)

  const addFiles = (incomingFiles) => {
    const incoming = Array.from(incomingFiles)
    const validFiles = incoming.filter(isPdf)
    const invalidCount = incoming.length - validFiles.length

    if (!incoming.length) return

    const available = MAX_FILES - files.length
    const accepted = validFiles.slice(0, Math.max(available, 0)).map((file) => ({
      id: nextId.current++,
      file,
    }))
    const nextFiles = [...files, ...accepted]
    const ignoredForLimit = validFiles.length - accepted.length

    if (accepted.length) {
      clearResult()
      setFiles(nextFiles)
    }

    if (invalidCount > 0) {
      setMessage('仅支持 PDF 文件，其他文件已忽略。')
      setMessageType('error')
    } else if (ignoredForLimit > 0) {
      setMessage('一次只能合并两个 PDF，多余文件已忽略。')
      setMessageType('error')
    } else if (nextFiles.length === MAX_FILES) {
      setMessage('两个文件已就绪，可以开始合并。')
      setMessageType('success')
    } else {
      setMessage('还需要再选择一个 PDF。')
      setMessageType('info')
    }
  }

  const handleFileInput = (event) => {
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

  const removeFile = (id) => {
    clearResult()
    setFiles((currentFiles) => currentFiles.filter((item) => item.id !== id))
    setMessage('文件已移除，请补充选择两个 PDF。')
    setMessageType('info')
  }

  const swapFiles = () => {
    if (files.length !== MAX_FILES) return
    clearResult()
    setFiles(([first, second]) => [second, first])
    setMessage('合并顺序已调整。')
    setMessageType('info')
  }

  const mergePdfs = async () => {
    if (files.length !== MAX_FILES || isMerging) return

    setIsMerging(true)
    clearResult()
    setMessage('正在本地合并，请稍候…')
    setMessageType('info')

    try {
      const sourceDocuments = await Promise.all(
        files.map(async ({ file }) => PDFDocument.load(await file.arrayBuffer())),
      )
      const mergedDocument = await PDFDocument.create()
      let totalPages = 0

      for (const sourceDocument of sourceDocuments) {
        const pageIndices = sourceDocument.getPageIndices()
        const copiedPages = await mergedDocument.copyPages(sourceDocument, pageIndices)
        copiedPages.forEach((page) => mergedDocument.addPage(page))
        totalPages += copiedPages.length
      }

      const mergedBytes = await mergedDocument.save()
      const blob = new Blob([mergedBytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)

      setResult({
        url,
        name: getOutputName(files[0].file.name),
        size: blob.size,
        pages: totalPages,
      })
      setMessage(`合并完成，共 ${totalPages} 页。文件仍只保存在此浏览器中。`)
      setMessageType('success')
    } catch (error) {
      const encrypted = error?.name === 'EncryptedPDFError' || /encrypt/i.test(error?.message || '')
      setMessage(encrypted
        ? '无法合并：其中一个 PDF 已加密或受密码保护。'
        : '合并失败，请确认两个文件都是完整、有效的 PDF。')
      setMessageType('error')
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <main className="tool-page pdf-merge-page">
      <Link className="back-link" to="/"><span aria-hidden="true">←</span>返回工具大厅</Link>
      <section className="tool-panel pdf-merge-panel">
        <div className="panel-heading">
          <div className="tool-icon coral" aria-hidden="true">▱</div>
          <div>
            <span className="eyebrow">LOCAL PDF MERGER</span>
            <h1>PDF 合并</h1>
          </div>
        </div>

        <div className="pdf-privacy-note">
          <span aria-hidden="true">⌁</span>
          <div><strong>全程本地处理</strong><small>你的 PDF 不会上传到服务器</small></div>
        </div>

        <div
          className={`pdf-drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="pdf-drop-icon" aria-hidden="true">＋</div>
          <h2>{isDragging ? '松开即可添加' : '拖拽两个 PDF 到这里'}</h2>
          <p>或从电脑中选择文件，最多两个</p>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleFileInput}
          />
          <button className="pdf-select-button" type="button" onClick={() => inputRef.current?.click()}>
            选择 PDF 文件
          </button>
        </div>

        {files.length > 0 && (
          <div className="pdf-file-section">
            <div className="pdf-file-heading">
              <h2>合并顺序</h2>
              {files.length === MAX_FILES && (
                <button type="button" onClick={swapFiles}>交换顺序</button>
              )}
            </div>
            <ol className="pdf-file-list">
              {files.map(({ id, file }, index) => (
                <li key={id}>
                  <span className="pdf-order">{index + 1}</span>
                  <span className="pdf-file-mark" aria-hidden="true">PDF</span>
                  <span className="pdf-file-info">
                    <strong title={file.name}>{file.name}</strong>
                    <small>{formatFileSize(file.size)}</small>
                  </span>
                  <button type="button" onClick={() => removeFile(id)} aria-label={`移除 ${file.name}`}>移除</button>
                </li>
              ))}
            </ol>
          </div>
        )}

        <p className={`pdf-status ${messageType}`} role="status" aria-live="polite">{message}</p>

        <div className="pdf-actions">
          <button
            className="pdf-merge-button"
            type="button"
            disabled={files.length !== MAX_FILES || isMerging}
            onClick={mergePdfs}
          >
            {isMerging ? '正在合并…' : '合并 PDF'}
          </button>
          {result && (
            <a className="pdf-download-button" href={result.url} download={result.name}>
              下载合并后文件
              <small>{result.pages} 页 · {formatFileSize(result.size)}</small>
            </a>
          )}
        </div>
      </section>
    </main>
  )
}

export default PdfMergeTool
