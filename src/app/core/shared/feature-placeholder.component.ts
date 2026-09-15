import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { UmsEmptyStateComponent } from '@ums/design-system';
import { TranslatePipe } from '../i18n/translate.pipe';

/**
 * Shared placeholder leaf for a not-yet-built feature route (SWEB-6 app shell/routing). Reused
 * across every authenticated section not yet in this flow's scope (Routine, Grades, Fees, Hostel,
 * Library, Requests, Notifications) so the route tree/guard structure can land now and each
 * feature ticket later swaps only its own leaf's `loadComponent`, not the tree around it.
 *
 * The label comes from the route's own `data.label` rather than one hardcoded string per usage,
 * so this file never needs editing as new sections are wired up in `app.routes.ts`.
 */
@Component({
  selector: 'app-feature-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsEmptyStateComponent, TranslatePipe],
  template: `<ums-empty-state
    [title]="'shell.comingSoon.title' | translate"
    [description]="'shell.comingSoon.body' | translate: { label: label() }"
  />`,
})
export class FeaturePlaceholderComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly label = toSignal(
    this.route.data.pipe(map((data) => (data['label'] as string | undefined) ?? 'This section')),
    { initialValue: 'This section' },
  );
}
