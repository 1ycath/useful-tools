import { NavLink, Outlet } from 'react-router-dom'
import { tools } from '../tools/toolRegistry'

function MainLayout() {
  return (
    <div className="app-shell">
      <aside className="main-sidebar">
        <NavLink className="sidebar-brand" to="/" end>
          <span className="brand-mark">T</span>
          <span>Toolbox</span>
        </NavLink>
        <nav className="sidebar-nav" aria-label="工具导航">
          <NavLink to="/" end>工具大厅</NavLink>
          {tools.map((tool) => (
            <NavLink to={tool.path} key={tool.path}>
              <span aria-hidden="true">{tool.icon}</span>
              {tool.title}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  )
}

export default MainLayout
