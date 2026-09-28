import Link from 'next/link'

export default function NotLinked(): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">
        This account isn&apos;t linked to a Telegram user yet. Send{' '}
        <code className="text-foreground">/link</code> to the bot, then enter the code in{' '}
        <Link href="/settings" className="text-primary underline">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}
