import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import {
  type AppShellNavItem,
  UmsAppShellComponent,
  UmsBadgeComponent,
  UmsIconButtonComponent,
  UmsOfflineBannerComponent,
} from '@ums/design-system';
import { AuthService } from '../core/auth/auth.service';
import { TranslatePipe } from '../core/i18n/translate.pipe';
import { TranslationService } from '../core/i18n/translation.service';
import { GlobalStore } from '../core/state/global.store';

interface StudentNavItem extends AppShellNavItem {
  readonly path: string;
}

/**
 * The authenticated app shell (SWEB-6, requirement-spec.md §7): top bar + collapsible side nav
 * (`mode="operational"` -- this is a daily-use operational portal, not a marketing mega-menu
 * surface). Wraps `@ums/design-system`'s `UmsAppShellComponent`, owns nav-item-to-route mapping
 * (the design system component only emits `navItemClick`, it never navigates itself), and hosts
 * the offline banner (SWEB-7) so it is visible above every authenticated screen at once.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    UmsAppShellComponent,
    UmsIconButtonComponent,
    UmsBadgeComponent,
    UmsOfflineBannerComponent,
    TranslatePipe,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly translation = inject(TranslationService);
  protected readonly globalStore = inject(GlobalStore);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly navItems = computed<StudentNavItem[]>(() => {
    const url = this.currentUrl();
    const items: Omit<StudentNavItem, 'active'>[] = [
      { label: this.translation.t('shell.nav.dashboard'), icon: 'house', path: '/dashboard' },
      {
        label: this.translation.t('shell.nav.registration'),
        icon: 'book-open',
        path: '/registration',
      },
      { label: this.translation.t('shell.nav.routine'), icon: 'calendar', path: '/routine' },
      {
        label: this.translation.t('shell.nav.grades'),
        icon: 'graduation-cap',
        path: '/grades',
      },
      {
        label: this.translation.t('shell.nav.fees'),
        icon: 'currency-circle-dollar',
        path: '/fees',
      },
      { label: this.translation.t('shell.nav.hostel'), icon: 'buildings', path: '/hostel' },
      {
        label: this.translation.t('shell.nav.library'),
        icon: 'book-bookmark',
        path: '/library',
      },
      {
        label: this.translation.t('shell.nav.requests'),
        icon: 'clipboard-text',
        path: '/requests',
      },
    ];

    return items.map((item) => ({ ...item, href: item.path, active: url.startsWith(item.path) }));
  });

  protected onNavItemClick(item: AppShellNavItem): void {
    const path = (item as StudentNavItem).path ?? item.href;
    if (path) {
      void this.router.navigateByUrl(path);
    }
  }

  protected toggleTheme(): void {
    const order: readonly ('light' | 'dark' | 'system')[] = ['system', 'light', 'dark'];
    const current = this.globalStore.themeMode();
    const next = order[(order.indexOf(current) + 1) % order.length];
    this.globalStore.setThemeMode(next);
  }

  protected toggleLocale(): void {
    this.globalStore.setLocale(this.globalStore.locale() === 'en' ? 'bn' : 'en');
  }

  protected logout(): void {
    this.authService.logout().subscribe({
      complete: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }
}
