import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UmsButtonComponent, UmsFormFieldComponent, UmsInputComponent } from '@ums/design-system';
import { toUmsApiError } from '@ums/shared';
import { AuthService } from '../../core/auth/auth.service';
import { AUTH_ROUTES, RETURN_URL_QUERY_PARAM } from '../../core/auth/auth-routes.constants';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import {
  isLoginFormValid,
  validateLoginForm,
  type LoginFormErrors,
  type LoginFormValues,
} from './login-form.validation';

/**
 * Login for the Student portal (SWEB-6, requirement-spec.md §5: "Session timeout follows the
 * platform-wide Identity policy... MFA is not required for the Student role by default"). No MFA
 * step is built here for that reason; `AuthService.login()`'s response is the natural future seam
 * if that policy ever changes for this role.
 *
 * Redirects to {@link AUTH_ROUTES.authenticatedHome} on success, or to `returnUrl` if `authGuard`
 * sent the student here from a specific page they were trying to reach.
 */
@Component({
  selector: 'app-login-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsButtonComponent, UmsFormFieldComponent, UmsInputComponent, TranslatePipe],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
})
export class LoginFormComponent {
  private readonly authService = inject(AuthService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly identifier = signal('');
  protected readonly password = signal('');
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);
  protected readonly serverErrorMessage = signal<string | null>(null);

  protected get formValues(): LoginFormValues {
    return { identifier: this.identifier(), password: this.password() };
  }

  protected get errors(): LoginFormErrors {
    return this.submitted() ? validateLoginForm(this.formValues) : {};
  }

  protected onSubmit(): void {
    this.submitted.set(true);
    this.serverErrorMessage.set(null);

    const errors = validateLoginForm(this.formValues);
    if (!isLoginFormValid(errors)) {
      return;
    }

    this.submitting.set(true);
    this.authService.login(this.identifier().trim(), this.password()).subscribe({
      next: () => {
        this.submitting.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get(RETURN_URL_QUERY_PARAM);
        void this.router.navigateByUrl(returnUrl || AUTH_ROUTES.authenticatedHome);
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.serverErrorMessage.set(
          toUmsApiError(error).message || this.translation.t('login.serverError.generic'),
        );
      },
    });
  }
}
