import { redirect } from 'next/navigation'
import { getServerSupabase } from '@/lib/supabase'
import { getUserIdFromRequest, getLinkedUserId } from '@/lib/auth'
import LinkTelegramForm from '@/components/link-telegram-form'

export const dynamic = 'force-dynamic'

async function getLinkedTelegramInfo(userId: string) {
  const supabase = await getServerSupabase()
  const { data } = await supabase
    .from('users')
    .select('telegram_id, username')
    .eq('id', userId)
    .single()
  return data
}

export default async function SettingsPage() {
  const authUserId = await getUserIdFromRequest()

  if (!authUserId) {
    redirect('/login')
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  const linkedUserId = await getLinkedUserId(authUserId)
  const telegramInfo = linkedUserId ? await getLinkedTelegramInfo(linkedUserId) : null

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Settings</h1>
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div>
          <div className="text-sm text-muted-foreground">Email</div>
          <div className="font-medium text-foreground">{user?.email}</div>
        </div>
        <a
          href="/logout"
          className="inline-block rounded-md bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors"
        >
          Sign out
        </a>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-heading text-base font-semibold text-foreground">Telegram account</h2>
        {telegramInfo ? (
          <p className="text-sm text-foreground">
            Linked to {telegramInfo.username ? `@${telegramInfo.username}` : `telegram id ${telegramInfo.telegram_id}`}
          </p>
        ) : (
          <LinkTelegramForm />
        )}
      </div>

      <details className="rounded-lg border border-border bg-card p-6">
        <summary className="cursor-pointer font-heading text-base font-semibold text-foreground">
          How to create and configure your Telegram bot
        </summary>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Open Telegram and chat with <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-primary underline">@BotFather</a>.</li>
          <li>Send <code className="text-foreground">/newbot</code>, then pick a display name and a username ending in <code className="text-foreground">bot</code>.</li>
          <li>Copy the token BotFather returns (looks like <code className="text-foreground">123456:ABC-DEF...</code>). Keep it secret.</li>
          <li>Set it as <code className="text-foreground">TELEGRAM_BOT_TOKEN</code> in the bot&apos;s environment (<code className="text-foreground">.env</code> locally, or your host&apos;s variables), then restart the bot.</li>
          <li>Optional: in BotFather send <code className="text-foreground">/setcommands</code> to show the command menu.</li>
          <li>Open your bot in Telegram, send <code className="text-foreground">/start</code> then <code className="text-foreground">/link</code>, and enter the code in the form above.</li>
        </ol>
      </details>
    </div>
  )
}
