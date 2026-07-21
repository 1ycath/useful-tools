import { Link } from 'react-router-dom'
import { tools } from '../tools/toolRegistry'

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
)

function HomePage() {
  return (
    <main className="home-shell">
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

export default HomePage
