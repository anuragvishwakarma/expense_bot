'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from 'cn'
import { LayoutDashboard, ClipboardList, TrendingUp, HandCoins, Settings, LogOut } from 'lucide-react'

const links = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ClipboardList },
  { href: '/goals', label: 'Goals', icon: TrendingUp },
  { href: '/debts', label: 'Debts', icon: HandCoins },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Expense Tracker
        </h2>
      </div>
      <nav className="flex-1 flex flex-col px-3 py-4">
        <div className="space-y-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
        <Link
          href="/logout"
          className="mt-auto flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors border-t border-sidebar-border pt-4"
        >
          <LogOut className="h-4 w-4" strokeWidth={2} />
          <span>Logout</span>
        </Link>
      </nav>
    </aside>
  )
}
