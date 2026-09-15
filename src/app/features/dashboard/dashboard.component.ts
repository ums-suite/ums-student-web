import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  UmsButtonComponent,
  UmsCardComponent,
  UmsEmptyStateComponent,
  UmsErrorStateComponent,
  UmsSkeletonComponent,
  UmsSparklineComponent,
} from '@ums/design-system';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { FacultyAccentService } from '../../core/theme/faculty-accent.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { greetingKeyForHour } from './dashboard.logic';
import { DashboardStore } from './dashboard.store';

/**
 * The Dashboard (SWEB-9/SWEB-10, requirement-spec.md §3.1/§7): a hero header (name, program,
 * faculty-accent color) above a responsive card grid -- outstanding balance, hostel status, a
 * GPA/CGPA trend preview, and a rotating "what needs your attention" panel.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsButtonComponent,
    UmsCardComponent,
    UmsEmptyStateComponent,
    UmsErrorStateComponent,
    UmsSkeletonComponent,
    UmsSparklineComponent,
    TranslatePipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  protected readonly store = inject(DashboardStore);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly facultyAccent = inject(FacultyAccentService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);

  protected readonly greetingKey = computed(() => greetingKeyForHour(new Date().getHours()));

  protected readonly sparklineData = computed(
    () => this.store.snapshot()?.semesterScoreTrend.map((p) => p.averageScore) ?? [],
  );

  protected readonly lastUpdatedLabel = computed(() => {
    const snapshot = this.store.snapshot();
    if (!snapshot) {
      return '';
    }
    return new Date(snapshot.fetchedAt).toLocaleTimeString();
  });

  constructor() {
    this.store.load();

    // Faculty-accent tint (SWEB-2, §7) -- proxied by departmentId (a documented, confirmed
    // simplification: this app does not consume the Organization module's Faculty entity in this
    // pass, so the student's own department id is used as a stable, deterministic accent key).
    effect(() => {
      const departmentId = this.store.snapshot()?.student.departmentId ?? null;
      this.facultyAccent.applyForFaculty(departmentId);
    });
  }

  protected retry(): void {
    this.store.load();
  }

  protected translateMessage(
    key: string,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    return this.translation.t(key, params);
  }

  protected goTo(path: string | undefined): void {
    if (path) {
      void this.router.navigateByUrl(path);
    }
  }

  protected expandGrades(): void {
    void this.router.navigateByUrl('/grades');
  }
}
