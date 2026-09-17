import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Sans } from 'next/font/google'
import { cn } from 'cn'
import './globals.css'
import Layout from '@/components/layout'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-heading',
  weight: ['500', '600'],
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Expense Tracker Dashboard',
  description: 'Track your expenses, income, goals, and more.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning={true}
      className={cn('font-sans', fraunces.variable, plexSans.variable)}
    >
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  )
}
