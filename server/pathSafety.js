function hasControlCharacters(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0)
    return code <= 31 || code === 127
  })
}

function validateCommonPath(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label}必须是字符串`)
  }

  const path = value.trim()
  if (path.startsWith('/') || path.includes('\\') || hasControlCharacters(path)) {
    throw new Error(`${label}格式不安全`)
  }

  const segments = path.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error(`${label}不能包含 . 或 .. 路径段`)
  }

  return path
}

export function validatePrefix(value = '', { allowRoot = true } = {}) {
  const path = validateCommonPath(value, '目录路径')
  if (!path) {
    if (allowRoot) return ''
    throw new Error('禁止操作根目录')
  }
  return `${path.replace(/\/+$/, '')}/`
}

export function validateObjectKey(value) {
  const path = validateCommonPath(value, '文件路径').replace(/\/+$/, '')
  if (!path) throw new Error('文件路径不能为空')
  return path
}

export function validateName(value, label = '名称') {
  if (typeof value !== 'string') throw new TypeError(`${label}必须是字符串`)
  const name = value.trim()
  if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\\') || hasControlCharacters(name)) {
    throw new Error(`${label}不能为空，且不能包含 /、\\、. 或 .. 路径段`)
  }
  return name
}
