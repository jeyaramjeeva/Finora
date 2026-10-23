import { describe, expect, it } from 'vitest'
import { passwordsMatch, usernameAllowed } from '../../server/auth.mjs'

describe('sign-in name', () => {
  it('accepts only Jeeva Jeyaram', () => {
    expect(usernameAllowed('Jeeva Jeyaram')).toBe(true)
    expect(usernameAllowed(' Jeeva Jeyaram ')).toBe(true)
    expect(usernameAllowed('jeeva jeyaram')).toBe(false)
    expect(usernameAllowed('Someone Else')).toBe(false)
  })

  it('compares the full password', () => {
    expect(passwordsMatch('correct-horse', 'correct-horse')).toBe(true)
    expect(passwordsMatch('correct-horse', 'correct-horses')).toBe(false)
    expect(passwordsMatch('short', 'correct-horse')).toBe(false)
  })
})
