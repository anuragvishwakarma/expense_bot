import Sidebar from './sidebar'
import TopNav from './top-nav'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopNav />
      <div className="flex h-[calc(100vh-4rem)]">
        <Sidebar />
        <div className="flex-1 p-6">{children}</div>
      </div>
    </div>
  )
}