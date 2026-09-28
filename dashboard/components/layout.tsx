'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './sidebar'
import TopNav from './top-nav'

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-64 flex flex-col min-h-screen">
        <TopNav />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  )
}
