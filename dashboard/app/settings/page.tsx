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

const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME

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
          <>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Open the bot in Telegram and tap <strong className="text-foreground">Start</strong>.</li>
              <li>The bot replies with a link code.</li>
              <li>Enter the code here.</li>
            </ol>
            <LinkTelegramForm />
          </>
        )}
      </div>

      {!telegramInfo && botUsername && (
        <a
          href={`https://t.me/${botUsername}?start=link`}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Open @{botUsername} in Telegram
        </a>
      )}
    </div>
  )
}
