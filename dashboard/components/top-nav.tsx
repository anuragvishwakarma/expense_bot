import { Bell, MessageSquare, User } from 'lucide-react'

export default function TopNav() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between px-4 md:px-8 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center gap-4 pl-10 md:pl-0 text-muted-foreground">
        <Bell className="h-5 w-5" strokeWidth={2} />
        <MessageSquare className="h-5 w-5" strokeWidth={2} />
      </div>
      <div className="flex items-center gap-3 text-sm">
        <User className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
        <span className="hidden md:block text-foreground">Welcome, User</span>
      </div>
    </header>
  )
}
