import { useEffect, useRef, useState } from 'react'

function TimerTool() {
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const startedAt = useRef(0)
  const storedElapsed = useRef(0)

  useEffect(() => {
    if (!running) return undefined
    startedAt.current = Date.now()
    const id = window.setInterval(() => {
      setElapsed(storedElapsed.current + Date.now() - startedAt.current)
    }, 31)
    return () => window.clearInterval(id)
  }, [running])

  const toggle = () => {
    if (running) storedElapsed.current = elapsed
    setRunning((value) => !value)
  }

  const reset = () => {
    setRunning(false)
    storedElapsed.current = 0
    setElapsed(0)
  }

  const totalSeconds = Math.floor(elapsed / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((elapsed % 1000) / 10)
  const pad = (value) => String(value).padStart(2, '0')

  return (
    <main className="tool-page">
      <section className="tool-panel">
        <div className="panel-heading">
          <div className="tool-icon orange">◷</div>
          <div><span className="eyebrow">STOPWATCH</span><h1>计时器</h1></div>
        </div>
        <div className="timer-display" aria-live="off">
          <span>{pad(hours)}</span><i>:</i><span>{pad(minutes)}</span><i>:</i><span>{pad(seconds)}</span><small>.{pad(centiseconds)}</small>
        </div>
        <div className="timer-labels"><span>时</span><span>分</span><span>秒</span></div>
        <div className="timer-actions">
          <button className={`main-action ${running ? 'pause' : ''}`} onClick={toggle}>{running ? '暂停' : elapsed ? '继续' : '开始'}</button>
          <button className="reset-button" onClick={reset} disabled={!elapsed}>重置</button>
        </div>
      </section>
    </main>
  )
}

export default TimerTool
