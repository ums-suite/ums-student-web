/**
 * Canonical paths for the auth-adjacent screens (SWEB-4), kept in one place so the login/guest
 * guards (this file's siblings) and the actual route definitions (SWEB-6) never drift apart.
 */
export const AUTH_ROUTES = {
  login: '/login',
  /** Where an authenticated student lands with nowhere more specific to go. */
  authenticatedHome: '/dashboard',
} as const;

/** Query param `authGuard` attaches so the login screen can return the student to where they were headed. */
export const RETURN_URL_QUERY_PARAM = 'returnUrl';
