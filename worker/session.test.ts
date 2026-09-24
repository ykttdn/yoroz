import { describe, expect, it } from 'vitest'

import { isAllowedEmail } from './session'

describe('isAllowedEmail', () => {
  it('accepts a listed address', () => {
    expect(isAllowedEmail('a@example.com,b@example.com', 'b@example.com')).toBe(true)
  })

  it('ignores case', () => {
    expect(isAllowedEmail('Alice@Example.com', 'alice@EXAMPLE.com')).toBe(true)
  })

  it('ignores whitespace around each entry', () => {
    expect(isAllowedEmail(' a@example.com , b@example.com ', 'b@example.com')).toBe(true)
  })

  it('rejects an unlisted address', () => {
    expect(isAllowedEmail('a@example.com', 'b@example.com')).toBe(false)
  })

  it('does not match on a substring', () => {
    expect(isAllowedEmail('a@example.com', 'aa@example.com')).toBe(false)
    expect(isAllowedEmail('aa@example.com', 'a@example.com')).toBe(false)
  })

  it('rejects everyone when the list is empty', () => {
    expect(isAllowedEmail('', 'a@example.com')).toBe(false)
  })
})
