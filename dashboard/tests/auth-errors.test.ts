import { friendlyAuthError } from '@/lib/authErrors'

describe('friendlyAuthError', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => jest.restoreAllMocks())

  it.each([
    'Password should be at least 6 characters.',
    'New password should be different from the old password.',
    'Password is known to be weak and easy to guess, please choose a different one.',
    'Unable to validate email address: invalid format',
    'email rate limit exceeded',
    'For security purposes, you can only request this after 52 seconds. Too many requests',
  ])('lets the person act on: %s', message => {
    expect(friendlyAuthError({ message }, 'fallback')).toBe(message)
  })

  it.each([
    'duplicate key value violates unique constraint "users_pkey"',
    'relation "auth.users" does not exist',
    'Database error saving new user',
    'JWT expired',
    '',
  ])('hides provider and database text: %j', message => {
    expect(friendlyAuthError({ message, status: 500, code: 'x' }, 'fallback')).toBe('fallback')
  })

  it('logs status and code only, never the message', () => {
    friendlyAuthError({ message: 'secret internals', status: 500, code: 'unexpected_failure' }, 'fallback')
    expect(JSON.stringify((console.error as jest.Mock).mock.calls)).not.toContain('secret internals')
    expect(JSON.stringify((console.error as jest.Mock).mock.calls)).toContain('unexpected_failure')
  })
})
