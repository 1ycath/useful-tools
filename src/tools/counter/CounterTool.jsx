import { useState } from 'react'

function CounterTool() {
  const [count, setCount] = useState(0)

  return (
    <main className="tool-page">
      <section className="tool-panel">
        <div className="panel-heading">
          <div className="tool-icon purple">＋</div>
          <div><span className="eyebrow">SIMPLE COUNTER</span><h1>计数器</h1></div>
        </div>
        <div className="counter-display" aria-live="polite">{count}</div>
        <div className="counter-actions">
          <button className="round-button secondary" onClick={() => setCount((value) => value - 1)} aria-label="减少 1">−</button>
          <button className="round-button primary" onClick={() => setCount((value) => value + 1)} aria-label="增加 1">＋</button>
        </div>
        <button className="text-button" onClick={() => setCount(0)}>重置为零</button>
      </section>
    </main>
  )
}

export default CounterTool
