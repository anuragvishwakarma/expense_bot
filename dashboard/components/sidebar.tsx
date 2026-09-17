import Link from 'next/link'
import { LayoutDashboard, ClipboardList, TrendingUp, Settings, LogOut } from 'lucide-react'

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white shadow-xl p-4">
      <div className="flex h-16 items-center">
        <h2 className="text-xl font-bold">Expense Tracker</h2>
      </div>
      <nav className="mt-6 space-y-2">
        <Link href="/" className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100">
          <LayoutDashboard className="mr-4 h-5 w-5" />
          <span>Overview</span>
        </Link>
        <Link href="/transactions" className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100">
          <ClipboardList className="mr-4 h-5 w-5" />
          <span>Transactions</span>
        </Link>
        <Link href="/goals" className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100">
          <TrendingUp className="mr-4 h-5 w-5" />
          <span>Goals</span>
        </Link>
        <Link href="/settings" className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100">
          <Settings className="mr-4 h-5 w-5" />
          <span>Settings</span>
        </Link>
        <Link href="/logout" className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100">
          <LogOut className="mr-4 h-5 w-5" />
          <span>Logout</span>
        </Link>
      </nav>
    </aside>
  )
}