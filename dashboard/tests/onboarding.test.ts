import { stepDone, isComplete } from '@/lib/onboarding'

describe('onboarding', () => {
  it('maps state to ordered step flags', () => {
    expect(stepDone({ linked: true, hasAccount: false, hasTransaction: false })).toEqual([true, false, false])
  })
  it('is complete only when every step is done', () => {
    expect(isComplete({ linked: true, hasAccount: true, hasTransaction: false })).toBe(false)
    expect(isComplete({ linked: true, hasAccount: true, hasTransaction: true })).toBe(true)
  })
})
