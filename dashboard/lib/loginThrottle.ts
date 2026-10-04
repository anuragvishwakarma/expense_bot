import { createFailureTracker } from './rateLimit'

const WINDOW_MS = 15 * 60 * 1000
// Three scopes of failed sign-in attempts. The per-pair limit stops guessing on one account from one
// address without letting a stranger lock the owner out (their own address is unaffected). The
// per-address limit stops one machine trying many accounts. The per-account limit caps a distributed
// guesser; because it blocks everyone, completing a password reset clears it (see clearAccountFailures),
// so an attacker cannot keep the real owner out.
export const byPair = createFailureTracker(5, WINDOW_MS)
export const byIp = createFailureTracker(20, WINDOW_MS)
export const byEmail = createFailureTracker(50, WINDOW_MS)

export const clearAccountFailures = (email: string) => byEmail.reset(email.trim().toLowerCase())
