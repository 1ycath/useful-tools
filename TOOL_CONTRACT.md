# Tool Contract：新工具接入规范

本文是本项目新增工具时必须遵守的接口约定。目标是让任何 agent 在不改变大厅整体体验的前提下，独立完成一个工具的接入。

## 1. 完成标准

一个新工具只有同时满足以下条件，才算接入完成：

1. 大厅中有可点击的工具卡片。
2. 工具有独立且唯一的 URL 路由。
3. 工具页面提供“返回工具大厅”链接。
4. 核心操作可用，并能处理空值、非法输入和边界值。
5. 页面在 320px 至桌面宽度下无横向滚动或内容遮挡。
6. `npm run build` 成功完成。

## 2. 当前项目入口

- 应用与路由：`src/App.jsx`
- 全局样式：`src/styles.css`
- React 入口：`src/main.jsx`
- 构建配置：`vite.config.js`

项目当前使用 `react-router-dom` 的 `BrowserRouter`。新增工具不要自行操作 `window.location`，统一使用 `<Link>` 和 `<Route>`。

## 3. 工具元数据契约

在 `Home` 组件的 `tools` 数组中添加一项：

```jsx
{
  path: '/example',        // 必填：小写英文路径，保持唯一
  icon: '◇',               // 必填：简短字符或内联图标
  className: 'blue',       // 必填：src/styles.css 中已定义的图标主题类
  title: '示例工具',        // 必填：简短中文名称
  description: '一句话说明用途和主要能力。',
  tag: '分类',              // 必填：2～4 个汉字
}
```

约束：

- `path` 使用 kebab-case，例如 `/word-counter`。
- 不添加带副作用的卡片点击处理；导航由 `Link` 完成。
- 描述尽量控制在 30 个汉字内。
- 新主题色需要同时提供浅色背景和高对比度文字颜色。

## 4. 工具页面契约

工具组件至少采用以下结构：

```jsx
function ExampleTool() {
  return (
    <main className="tool-page">
      <BackLink />
      <section className="tool-panel">
        <div className="panel-heading">
          <div className="tool-icon blue">◇</div>
          <div>
            <span className="eyebrow">EXAMPLE TOOL</span>
            <h1>示例工具</h1>
          </div>
        </div>

        {/* 工具的表单、结果与操作区 */}
      </section>
    </main>
  )
}
```

然后在 `App` 的 `Routes` 内注册：

```jsx
<Route path="/example" element={<ExampleTool />} />
```

必须复用 `.tool-page`、`.tool-panel`、`.panel-heading`、`.tool-icon` 和 `<BackLink />`，以维持页面结构一致。工具特有样式使用有含义的前缀，例如 `.converter-result`，避免覆盖其他工具。

## 5. 交互与状态约定

- 使用 React state 管理可见状态，不直接修改 DOM。
- 对用户输入先验证，再计算结果；错误提示应靠近输入区。
- 数字工具应明确边界是否包含、单位和精度。
- 定时器、监听器和订阅必须在 `useEffect` 清理函数中释放。
- “重置”应恢复工具的初始状态，而不是刷新页面。
- 异步操作应提供进行中状态，并防止重复提交。
- 不把工具状态挂在全局，除非多个页面确实需要共享。

## 6. 移动端与可访问性约定

- 最小支持宽度为 320px，禁止产生横向滚动。
- 主要按钮和输入框的触控高度至少 44px，推荐 52～54px。
- 不能只依赖 hover 展示关键功能。
- 使用原生 `button`、`input` 和 `label`；图标按钮必须设置 `aria-label`。
- 动态结果使用合适的 `aria-live`，高频计时显示除外。
- 大数字需要设置最大宽度和换行策略，避免超长结果撑破容器。
- 新增断点应优先沿用现有的 `900px`、`640px` 和 `430px`。

## 7. 验收清单

接入后逐项检查：

- [ ] 从大厅能进入新工具，URL 正确。
- [ ] 返回链接能回到大厅。
- [ ] 正常输入、空输入、非法输入和边界值行为正确。
- [ ] 在 320px、390px、640px 和桌面宽度下检查布局。
- [ ] 键盘可以访问输入框和所有按钮。
- [ ] 控制台没有 React 警告或运行时错误。
- [ ] 执行 `npm run build` 并确认成功。

## 8. Agent 交付格式

完成后请简要报告：新增路由、主要能力、输入校验、移动端处理和构建结果。不要只说“已完成”；若有未覆盖的边界或外部依赖，应明确列出。
