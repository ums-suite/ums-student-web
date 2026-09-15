import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { studentGuard } from './core/auth/student.guard';

const placeholder = () =>
  import('./core/shared/feature-placeholder.component').then((m) => m.FeaturePlaceholderComponent);

/**
 * Root route table (SWEB-1/SWEB-6). This entire app is CSR, no SSR (requirement-spec.md
 * §2/§10.1) -- every route sits behind {@link authGuard}/{@link studentGuard} except `/login`.
 *
 * `/login` is guest-only ({@link guestGuard}) -- an already-authenticated student is sent to the
 * dashboard instead of seeing the login form again. Every other route requires both
 * authentication ({@link authGuard}) and Student role membership ({@link studentGuard}, §5's
 * "renders only the Student permission surface" -- best-effort client-side UX, never the real
 * trust boundary) and renders inside the shared {@link AppShellComponent} (top bar + side nav).
 *
 * Every leaf here is {@link FeaturePlaceholderComponent} until its own SWEB ticket lands, except
 * Dashboard (SWEB-9/SWEB-10) and Course Registration (SWEB-11 through SWEB-15), this pass's
 * actual scope.
 */
export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/login/login-form.component').then((m) => m.LoginFormComponent),
  },
  {
    path: '',
    canActivate: [authGuard, studentGuard],
    loadComponent: () => import('./shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'registration',
        loadComponent: () =>
          import('./features/registration/registration.component').then(
            (m) => m.RegistrationComponent,
          ),
      },
      {
        path: 'routine',
        loadComponent: () =>
          import('./features/routine/routine.component').then((m) => m.RoutineComponent),
      },
      { path: 'grades', loadComponent: placeholder, data: { label: 'Grades' } },
      { path: 'fees', loadComponent: placeholder, data: { label: 'Fees' } },
      { path: 'hostel', loadComponent: placeholder, data: { label: 'Hostel' } },
      { path: 'library', loadComponent: placeholder, data: { label: 'Library' } },
      { path: 'requests', loadComponent: placeholder, data: { label: 'Requests' } },
      { path: '**', loadComponent: placeholder, data: { label: 'This page' } },
    ],
  },
];
