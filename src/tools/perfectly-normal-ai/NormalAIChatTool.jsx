import { useEffect, useRef, useState } from 'react'

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

function NormalAIChatTool() {
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
                  <span>✦</span><h2>有什么想问的？</h2><p>我会以完全正常的方式回答你。</p>
                </div>
              ) : activeConversation.messages.map((message) => (
                <div className={`chat-message ${message.role}`} key={message.id}>
                  <span>{message.role === 'user' ? '你' : 'AI'}</span><p>{message.content}</p>
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

export default NormalAIChatTool
