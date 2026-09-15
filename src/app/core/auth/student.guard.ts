import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { CurrentUserService } from '@ums/shared';
import { AUTH_ROUTES } from './auth-routes.constants';

/**
 * Renders only the `Student` permission surface (requirement-spec.md §5: "This app renders only
 * the `Student` permission surface... a Faculty/Admin credential must never unlock a different
 * screen set here, and enforcement is server-side (ADR-0006), never 'the frontend chose not to
 * render it.'").
 *
 * **Known gap, matching `@ums/shared`'s own documented one** ("Known gap: permission resolution"
 * in its README): Identity's access token carries Role *names* only, not a resolved `student.*`
 * Permission set, and there is no "my effective permissions" endpoint yet for a client to call.
 * This guard therefore can only check **role membership** (`CurrentUserService.hasAnyRole`), not
 * the actual `student.*` permission strings the backend itself enforces on every student-owned
 * endpoint (which remains the real security boundary regardless of what this guard does -- this
 * is UX convenience, never the trust boundary, exactly like every other client-side check in this
 * app). `STUDENT_ROLE_NAME` is this app's best-current assumption for the seeded/assigned Role
 * name Identity uses for students; no such name is hardcoded anywhere in `ums-core` (roles are
 * created/assigned dynamically through Identity's own role management), so this must be confirmed
 * with the Identity/Student team rather than trusted as authoritative. Flagged in this app's PR as
 * a cross-team follow-up, layered on top of `@ums/shared`'s existing gap.
 */
export const STUDENT_ROLE_NAME = 'Student';

export const studentGuard: CanActivateFn = () => {
  const currentUser = inject(CurrentUserService);
  const router = inject(Router);

  if (currentUser.hasAnyRole([STUDENT_ROLE_NAME])) {
    return true;
  }

  return router.createUrlTree([AUTH_ROUTES.login]);
};
