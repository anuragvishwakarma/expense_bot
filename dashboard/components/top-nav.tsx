import { Bell, MessageSquare, User } from 'lucide-react'

export default function TopNav() {
  return (
    <header className="flex items-center justify-between px-4 py-4 bg-white shadow-sm">
      <div className="flex items-center space-x-4">
        <Bell className="h-5 w-5" />
        <MessageSquare className="h-5 w-5" />
      </div>
      <div className="flex items-center space-x-3">
        <User className="h-5 w-5" />
        <span className="hidden md:block">Welcome, User</span>
      </div>
    </header>
  )
}