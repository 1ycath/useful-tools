import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import HomePage from '../pages/HomePage'
import CounterTool from '../tools/counter/CounterTool'
import NormalAIChatTool from '../tools/perfectly-normal-ai/NormalAIChatTool'
import RandomIntegerTool from '../tools/random-integer/RandomIntegerTool'
import TimerTool from '../tools/timer/TimerTool'

const PdfMergeTool = lazy(() => import('../tools/pdf-merge/PdfMergeTool'))
const FileStorageTool = lazy(() => import('../tools/file-storage/FileStorageTool'))

function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="counter" element={<CounterTool />} />
        <Route path="timer" element={<TimerTool />} />
        <Route path="random" element={<RandomIntegerTool />} />
        <Route path="perfectly-normal-ai" element={<NormalAIChatTool />} />
        <Route path="pdf-merge" element={(
          <Suspense fallback={<main className="tool-page"><section className="tool-panel">正在加载 PDF 合并工具…</section></main>}>
            <PdfMergeTool />
          </Suspense>
        )} />
        <Route path="file-storage" element={(
          <Suspense fallback={<main className="tool-page"><section className="tool-panel">正在加载文件存储工具…</section></main>}>
            <FileStorageTool />
          </Suspense>
        )} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  )
}

export default AppRoutes
