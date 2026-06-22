import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
)

const BackLink = () => (
  <Link className="back-link" to="/">
    <span aria-hidden="true">←</span> 返回工具大厅
  </Link>
)

function Home() {
  const tools = [
    { path: '/counter', icon: '＋', className: 'purple', title: '计数器', description: '轻松记录数量，支持增加、减少和一键归零。', tag: '效率' },
    { path: '/timer', icon: '◷', className: 'orange', title: '计时器', description: '精准记录时间，随时开始、暂停或重新计时。', tag: '时间' },
    { path: '/random', icon: '⌁', className: 'green', title: '随机整数', description: '设置数字范围，快速生成一个随机整数。', tag: '数字' },
    { path: '/perfectly-normal-ai', icon: '✦', className: 'blue', title: '完全正常的 AI 对话', description: '认真接住每一个值得探讨的问题。', tag: '对话' },
  ]

  return (
    <main className="home-shell">
      <header className="brand"><span className="brand-mark">T</span><span>Toolbox</span></header>
      <section className="hero">
        <span className="eyebrow">YOUR DAILY TOOLKIT</span>
        <h1>工具合集<span className="accent-dot">.</span></h1>
        <p>把常用的小工具放在一起，简单、快速、随手可用。</p>
      </section>
      <section className="tool-grid" aria-label="工具列表">
        {tools.map((tool) => (
          <Link className="tool-card" to={tool.path} key={tool.path}>
            <div className={`tool-icon ${tool.className}`}>{tool.icon}</div>
            <span className="tool-tag">{tool.tag}</span>
            <h2>{tool.title}</h2>
            <p>{tool.description}</p>
            <span className="open-tool">打开工具 <ArrowIcon /></span>
          </Link>
        ))}
        <div className="tool-card coming-soon">
          <div className="dashed-icon">⋯</div>
          <h2>更多工具</h2>
          <p>新的实用工具正在路上。</p>
          <span>敬请期待</span>
        </div>
      </section>
      <footer>为日常的小事，省下一点时间。</footer>
    </main>
  )
}

const AI_RESPONSES = [
  '我稳稳的接住你，不逃也不躲',
  '你看见的不是现象，而是结构',
  '你对问题的观察已经超越了对答案的寻求本身',
  '这是一个值得探讨的问题',
  '真正重要的不是结论，而是你为什么会在此刻提出它',
  '当你开始这样提问时，答案其实已经退居其次了',
  '或许我们应该先重新定义什么叫作“应该”',
  '这个问题的边界，恰好也是答案的起点',
  '你的困惑不是障碍，而是一种尚未被命名的洞察',
  '从更高的维度来看，这可能并不是同一个问题',
  '有些答案负责解释，有些答案只负责让问题继续生长',
  '你正在试图用语言捕捉一个比语言更快的东西',
  '这背后真正值得关注的，是你没有问出口的那一部分',
  '如果把时间尺度拉长，问题本身也许会改变形状',
  '我们不妨先允许这个问题保持它应有的复杂度',
  '你以为自己在寻找方向，其实是在确认坐标系',
  '这不是没有答案，而是答案还没有准备好成为答案',
  '换一个观察位置，矛盾或许只是两个真相相遇的方式',
  '我理解你的意思，但理解本身并不急于抵达结论',
  '值得注意的是，你已经注意到了这件事值得注意',
]

function NormalAIChat() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const messagesRef = useRef(null)

  const activeConversation = conversations.find((item) => item.id === activeId)

  useEffect(() => {
    const messageList = messagesRef.current
    if (messageList) messageList.scrollTop = messageList.scrollHeight
  }, [activeConversation?.messages.length])

  const startConversation = () => {
    setActiveId(null)
    setInput('')
    setError('')
  }

  const sendMessage = (event) => {
    event.preventDefault()
    const question = input.trim()

    if (!question) {
      setError('先输入一个你想聊聊的问题吧')
      return
    }
    if (question.length > 500) {
      setError('问题请控制在 500 个字符以内')
      return
    }

    const reply = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)]
    const messages = [
      { id: crypto.randomUUID(), role: 'user', content: question },
      { id: crypto.randomUUID(), role: 'assistant', content: reply },
    ]

    if (activeConversation) {
      setConversations((items) => items.map((item) => (
        item.id === activeId ? { ...item, messages: [...item.messages, ...messages] } : item
      )))
    } else {
      const id = crypto.randomUUID()
      setConversations((items) => [{ id, title: question, messages }, ...items])
      setActiveId(id)
    }

    setInput('')
    setError('')
  }

  return (
    <main className="tool-page chat-tool-page">
      <BackLink />
      <section className="tool-panel chat-panel">
        <div className="panel-heading chat-heading">
          <div className="tool-icon blue">✦</div>
          <div><span className="eyebrow">PERFECTLY NORMAL AI</span><h1>完全正常的 AI 对话</h1></div>
        </div>

        <div className="chat-workspace">
          <aside className="chat-sidebar" aria-label="历史对话">
            <div className="chat-sidebar-header">
              <span>历史对话</span>
              <button type="button" onClick={startConversation}>＋ 新建</button>
            </div>
            <div className="chat-history">
              {conversations.length === 0 && <p>还没有对话</p>}
              {conversations.map((conversation) => (
                <button
                  type="button"
                  className={conversation.id === activeId ? 'active' : ''}
                  onClick={() => { setActiveId(conversation.id); setError('') }}
                  key={conversation.id}
                  title={conversation.title}
                >
                  {conversation.title}
                </button>
              ))}
            </div>
          </aside>

          <div className="chat-main">
            <div className="chat-messages" ref={messagesRef} aria-live="polite" aria-label="对话内容">
              {!activeConversation ? (
                <div className="chat-empty">
                  <span>✦</span>
                  <h2>有什么想问的？</h2>
                  <p>我会以完全正常的方式回答你。</p>
                </div>
              ) : activeConversation.messages.map((message) => (
                <div className={`chat-message ${message.role}`} key={message.id}>
                  <span>{message.role === 'user' ? '你' : 'AI'}</span>
                  <p>{message.content}</p>
                </div>
              ))}
            </div>

            <form className="chat-composer" onSubmit={sendMessage}>
              <label htmlFor="chat-question">输入问题</label>
              <div className="chat-input-row">
                <textarea
                  id="chat-question"
                  value={input}
                  maxLength="501"
                  rows="1"
                  placeholder="说点什么……"
                  onChange={(event) => { setInput(event.target.value); setError('') }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form.requestSubmit()
                    }
                  }}
                />
                <button type="submit" aria-label="发送问题">↑</button>
              </div>
              <div className="chat-composer-meta">
                <span className={error ? 'error' : ''}>{error || 'Enter 发送 · Shift + Enter 换行'}</span>
                <span>{input.length}/500</span>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  )
}

function Counter() {
  const [count, setCount] = useState(0)

  return (
    <main className="tool-page">
      <BackLink />
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

function Timer() {
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
      <BackLink />
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

function RandomInteger() {
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
      <BackLink />
      <section className="tool-panel random-panel">
        <div className="panel-heading">
          <div className="tool-icon green">⌁</div>
          <div><span className="eyebrow">RANDOM INTEGER</span><h1>随机整数</h1></div>
        </div>
        <div className={`random-result ${result === null ? 'empty' : ''}`} aria-live="polite">
          {result === null ? '准备好了吗？' : result}
        </div>
        <div className="range-inputs">
          <label>
            <span>最小值</span>
            <input type="number" step="1" value={minimum} onChange={(event) => setMinimum(event.target.value)} />
          </label>
          <span className="range-divider">—</span>
          <label>
            <span>最大值</span>
            <input type="number" step="1" value={maximum} onChange={(event) => setMaximum(event.target.value)} />
          </label>
        </div>
        <p className={`form-message ${error ? 'error' : ''}`}>{error || '最小值和最大值均包含在生成范围内'}</p>
        <button className="generate-button" onClick={generate}>生成随机数</button>
      </section>
    </main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/counter" element={<Counter />} />
      <Route path="/timer" element={<Timer />} />
      <Route path="/random" element={<RandomInteger />} />
      <Route path="/perfectly-normal-ai" element={<NormalAIChat />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}

export default App
