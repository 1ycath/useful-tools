import { useCallback, useEffect, useRef, useState } from 'react'
import './fileStorage.css'

async function api(path, options) {
  const response = await fetch(`/api/storage${path}`, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试')
  return data
}

function formatSize(size) {
  if (size < 1024) return `${size} B`
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`
  return `${(size / 1024 ** 3).toFixed(1)} GB`
}

function parentOf(key, isFolder) {
  const normalized = isFolder ? key.replace(/\/$/, '') : key
  const separator = normalized.lastIndexOf('/')
  return separator < 0 ? '' : normalized.slice(0, separator + 1)
}

function joinPath(prefix, name, isFolder) {
  const cleanPrefix = prefix.trim().replace(/^\/+|\/+$/g, '')
  const cleanName = name.trim().replace(/^\/+|\/+$/g, '')
  return `${cleanPrefix ? `${cleanPrefix}/` : ''}${cleanName}${isFolder ? '/' : ''}`
}

function FileStorageTool() {
  const [prefix, setPrefix] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef(null)

  const loadDirectory = useCallback(async (nextPrefix) => {
    setLoading(true)
    setError('')
    try {
      const data = await api(`/list?prefix=${encodeURIComponent(nextPrefix)}`)
      setPrefix(data.prefix)
      setItems(data.items)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    api('/list?prefix=')
      .then((data) => {
        if (!active) return
        setPrefix(data.prefix)
        setItems(data.items)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const runAction = async (label, action, successMessage) => {
    setBusy(label)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
      await loadDirectory(prefix)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const createFolder = () => {
    const name = window.prompt('请输入文件夹名称')
    if (!name) return
    void runAction('create-folder', () => api('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent: prefix, name }),
    }), `已新建文件夹“${name.trim()}”`)
  }

  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList ?? [])
    if (files.length === 0) return

    const oversized = files.find((file) => file.size > 100 * 1024 * 1024)
    if (oversized) {
      setError(`“${oversized.name}”超过 100 MB，无法上传`)
      return
    }

    setBusy('upload')
    setError('')
    let completed = 0
    let failure

    try {
      for (const file of files) {
        setMessage(`正在上传 ${completed + 1}/${files.length}：${file.name}`)
        const form = new FormData()
        form.append('prefix', prefix)
        form.append('file', file)
        await api('/upload', { method: 'POST', body: form })
        completed += 1
      }
    } catch (requestError) {
      failure = requestError
    }

    await loadDirectory(prefix)
    if (failure) {
      setError(`${completed > 0 ? `已上传 ${completed} 个文件；` : ''}${failure.message}`)
      setMessage('')
    } else {
      setMessage(files.length === 1 ? `已上传“${files[0].name}”` : `已上传 ${files.length} 个文件`)
    }
    setBusy('')
  }

  const selectFiles = (event) => {
    void uploadFiles(event.target.files)
    event.target.value = ''
  }

  const dropFiles = (event) => {
    event.preventDefault()
    setDragging(false)
    if (!busy) void uploadFiles(event.dataTransfer.files)
  }

  const download = async (item) => {
    setBusy(item.key)
    setError('')
    try {
      const { url } = await api(`/download-url?key=${encodeURIComponent(item.key)}`)
      window.location.assign(url)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const rename = (item) => {
    const name = window.prompt('请输入新名称', item.name)
    if (!name || name.trim() === item.name) return
    const destination = joinPath(parentOf(item.key, item.type === 'folder'), name, item.type === 'folder')
    void runAction(item.key, () => api('/move', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: item.key, destination, isFolder: item.type === 'folder' }),
    }), `已重命名为“${name.trim()}”`)
  }

  const move = (item) => {
    const destinationFolder = window.prompt('请输入目标文件夹路径；移动到根目录请留空', prefix)
    if (destinationFolder === null) return
    const destination = joinPath(destinationFolder, item.name, item.type === 'folder')
    void runAction(item.key, () => api('/move', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: item.key, destination, isFolder: item.type === 'folder' }),
    }), `已移动“${item.name}”`)
  }

  const remove = (item) => {
    if (!window.confirm(`确定删除${item.type === 'folder' ? '文件夹及其中全部内容' : '文件'}“${item.name}”吗？`)) return
    const path = item.type === 'folder'
      ? `/folder?prefix=${encodeURIComponent(item.key)}`
      : `/file?key=${encodeURIComponent(item.key)}`
    void runAction(item.key, () => api(path, { method: 'DELETE' }), `已删除“${item.name}”`)
  }

  const crumbs = prefix.split('/').filter(Boolean)

  return (
    <main className="tool-page storage-tool-page">
      <section className="tool-panel storage-panel">
        <div className="panel-heading storage-heading">
          <div className="tool-icon blue">▤</div>
          <div>
            <span className="eyebrow">PRIVATE OSS STORAGE</span>
            <h1>文件存储</h1>
          </div>
        </div>

        <div className="storage-toolbar">
          <button type="button" onClick={createFolder} disabled={Boolean(busy)}>新建文件夹</button>
          <button type="button" onClick={() => void loadDirectory(prefix)} disabled={loading || Boolean(busy)}>刷新</button>
          <input ref={fileInput} type="file" multiple onChange={selectFiles} aria-label="选择要上传的文件" />
        </div>

        <nav className="storage-breadcrumbs" aria-label="当前文件夹路径">
          <button type="button" onClick={() => void loadDirectory('')} disabled={!prefix}>根目录</button>
          {crumbs.map((crumb, index) => {
            const crumbPrefix = `${crumbs.slice(0, index + 1).join('/')}/`
            return (
              <span key={crumbPrefix}>
                <i>/</i>
                <button type="button" onClick={() => void loadDirectory(crumbPrefix)} disabled={crumbPrefix === prefix}>{crumb}</button>
              </span>
            )
          })}
        </nav>

        {(error || message) && (
          <div className="storage-status" aria-live="polite">
            {error ? <span className="error">{error}</span> : <span>{message}</span>}
          </div>
        )}

        <div className="storage-list" aria-busy={loading}>
          <div className="storage-row storage-list-header">
            <span>名称</span><span>大小</span><span>更新时间</span><span>操作</span>
          </div>
          {loading && <div className="storage-empty">正在加载…</div>}
          {!loading && items.length === 0 && <div className="storage-empty">这个文件夹是空的</div>}
          {!loading && items.map((item) => (
            <div className="storage-row" key={item.key}>
              <button
                type="button"
                className="storage-name"
                onClick={() => item.type === 'folder' ? void loadDirectory(item.key) : void download(item)}
                disabled={Boolean(busy)}
                title={item.key}
              >
                <span className="storage-entry-icon" aria-hidden="true">
                  {item.type === 'folder' && (
                    <svg viewBox="0 0 24 24"><path d="M3.5 6.8a2 2 0 0 1 2-2h4.1l2 2.2h6.9a2 2 0 0 1 2 2v8.2a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.8Z" /></svg>
                  )}
                </span>
                {item.name}
              </button>
              <span data-label="大小">{item.type === 'folder' ? '—' : formatSize(item.size)}</span>
              <span data-label="更新时间">{item.lastModified ? new Date(item.lastModified).toLocaleString('zh-CN') : '—'}</span>
              <div className="storage-actions">
                {item.type === 'file' && <button type="button" onClick={() => void download(item)} disabled={Boolean(busy)}>下载</button>}
                <button type="button" onClick={() => rename(item)} disabled={Boolean(busy)}>重命名</button>
                <button type="button" onClick={() => move(item)} disabled={Boolean(busy)}>移动</button>
                <button type="button" className="danger" onClick={() => remove(item)} disabled={Boolean(busy)}>删除</button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={`storage-dropzone${dragging ? ' dragging' : ''}`}
          onClick={() => fileInput.current?.click()}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
          onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false)
          }}
          onDrop={dropFiles}
          disabled={Boolean(busy)}
        >
          <span className="storage-drop-icon" aria-hidden="true">⇧</span>
          <span><strong>{dragging ? '松开即可上传' : '拖拽文件到这里'}</strong>，或点击选择文件</span>
          <small>支持多文件上传，单个文件不超过 100 MB</small>
        </button>
      </section>
    </main>
  )
}

export default FileStorageTool
