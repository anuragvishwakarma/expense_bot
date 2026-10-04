import Link from 'next/link'
import ResetPasswordForm from '@/components/reset-password-form'
import { getUserIdFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  const signedIn = !!(await getUserIdFromRequest())
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg">
        <div className="p-8">
          <h1 className="font-heading text-2xl font-semibold text-center text-foreground mb-2">Choose a new password</h1>
          {signedIn ? (
            <>
              <p className="text-sm text-muted-foreground text-center mb-8">At least 8 characters. Other devices will be signed out.</p>
              <ResetPasswordForm />
            </>
          ) : (
            <div className="mt-6 space-y-4 text-center text-sm text-muted-foreground">
              <p>This reset link has expired or was already used.</p>
              <Link href="/forgot-password" className="text-primary underline">Request a new link</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
