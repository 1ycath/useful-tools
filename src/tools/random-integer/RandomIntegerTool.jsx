import { useState } from 'react'

function RandomIntegerTool() {
  const [minimum, setMinimum] = useState('1')
  const [maximum, setMaximum] = useState('100')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const generate = () => {
    if (minimum === '' || maximum === '') {
      setError('请完整输入最小值和最大值')
      return
    }
    const min = Number(minimum)
    const max = Number(maximum)
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
      setError('请输入有效的整数')
      return
    }
    if (min > max) {
      setError('最小值不能大于最大值')
      return
    }
    setResult(Math.floor(Math.random() * (max - min + 1)) + min)
    setError('')
  }

  return (
    <main className="tool-page">
      <section className="tool-panel random-panel">
        <div className="panel-heading">
          <div className="tool-icon green">⌁</div>
          <div><span className="eyebrow">RANDOM INTEGER</span><h1>随机整数</h1></div>
        </div>
        <div className={`random-result ${result === null ? 'empty' : ''}`} aria-live="polite">
          {result === null ? '准备好了吗？' : result}
        </div>
        <div className="range-inputs">
          <label><span>最小值</span><input type="number" step="1" value={minimum} onChange={(event) => setMinimum(event.target.value)} /></label>
          <span className="range-divider">—</span>
          <label><span>最大值</span><input type="number" step="1" value={maximum} onChange={(event) => setMaximum(event.target.value)} /></label>
        </div>
        <p className={`form-message ${error ? 'error' : ''}`}>{error || '最小值和最大值均包含在生成范围内'}</p>
        <button className="generate-button" onClick={generate}>生成随机数</button>
      </section>
    </main>
  )
}

export default RandomIntegerTool
