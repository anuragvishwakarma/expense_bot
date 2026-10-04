import Link from 'next/link'

const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME

export default function NotLinked(): React.ReactElement {
  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-3">
      <h2 className="font-heading text-base font-semibold text-foreground">Connect your Telegram account</h2>
      <p className="text-sm text-muted-foreground">
        Your data lives in the Telegram bot. Link it once to see it here:
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>
          Open the bot in Telegram and tap <strong className="text-foreground">Start</strong>
          {botUsername && (
            <>
              {' '}(<a href={`https://t.me/${botUsername}?start=link`} target="_blank" rel="noreferrer" className="text-primary underline">open @{botUsername}</a>)
            </>
          )}
          .
        </li>
        <li>Send <code className="text-foreground">/link</code> to get a one-time code.</li>
        <li>
          Enter the code in <Link href="/settings" className="text-primary underline">Settings</Link>.
        </li>
      </ol>
      <p className="text-sm text-muted-foreground">
        New to the app? Read the <Link href="/guide" className="text-primary underline">quick guide</Link>.
      </p>
    </div>
  )
}
