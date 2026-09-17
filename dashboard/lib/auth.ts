import { headers } from 'next/headers'

export async function getUserIdFromRequest(): Promise<string | null> {
  const headersList = await headers()
  const userId = headersList.get('x-user-id')
  return userId
}
