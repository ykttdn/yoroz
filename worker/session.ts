export const SESSION_COOKIE = 'session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

export const EXPECTED_USER_HEADER = 'X-Expected-User'
export const ANOTHER_USER_ERROR = 'Signed in as another user'

export const isAllowedEmail = (allowedEmails: string, email: string) =>
  allowedEmails.split(',').some(allowed => allowed.trim().toLowerCase() === email.toLowerCase())
