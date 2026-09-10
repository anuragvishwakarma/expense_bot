import Link from 'next/link';
import { Menu, LogOut, User, Dashboard, BarChart3, List, Settings, TrendingUp, CreditCard } from 'lucide-react';

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r">
      <div className="p-4">
        <Link href="/" className="flex items-center space-x-3 mb-6">
          <Dashboard className="h-5 w-5" />
          <span className="font-medium">Dashboard</span>
        </Link>

        <nav className="space-y-1">
          <Link href="/transactions" className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
            <List className="h-5 w-5" />
            <span>Transactions</span>
          </Link>

          <Link href="/goals" className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
            <TrendingUp className="h-5 w-5" />
            <span>Goals</span>
          </Link>

          <Link href="/debts" className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
            <CreditCard className="h-5 w-5" />
            <span>Debts</span>
          </Link>

          <Link href="/reports" className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
            <BarChart3 className="h-5 w-5" />
            <span>Reports</span>
          </Link>

          <Link href="/settings" className="flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Link>
        </nav>
      </div>

      <div className="p-4 pt-0">
        <Link href="/auth/sign-out" className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-50/50">
          <LogOut className="h-5 w-5" />
          <span>Sign out</span>
        </Link>
      </div>
    </aside>
  );
}