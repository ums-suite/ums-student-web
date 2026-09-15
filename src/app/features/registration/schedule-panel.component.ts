import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { UmsBadgeComponent, UmsButtonComponent, UmsEmptyStateComponent } from '@ums/design-system';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { doSectionsConflict } from './registration-eligibility';
import type { ScheduleSelection } from './registration.types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ScheduleRow {
  readonly selection: ScheduleSelection;
  readonly dayLabel: string;
  readonly conflicts: boolean;
}

/**
 * SWEB-14: the persistent "my schedule" side panel -- renders the in-progress selection so a
 * timetable conflict is *seen*, not just error-messaged, before submit (§7 Course Registration
 * key screen). A simplified day-grouped grid (rather than a pixel-precise hour grid) keeps this
 * legible at side-panel width while still surfacing every conflicting pair explicitly.
 */
@Component({
  selector: 'app-schedule-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UmsBadgeComponent, UmsButtonComponent, UmsEmptyStateComponent, TranslatePipe],
  templateUrl: './schedule-panel.component.html',
  styleUrl: './schedule-panel.component.scss',
})
export class SchedulePanelComponent {
  readonly selections = input.required<readonly ScheduleSelection[]>();
  readonly registerRequested = output<ScheduleSelection>();
  readonly removeRequested = output<string>();

  protected readonly rows = computed<readonly ScheduleRow[]>(() => {
    const all = this.selections();
    return all.map((selection) => ({
      selection,
      dayLabel: DAY_LABELS[selection.section.dayOfWeek] ?? String(selection.section.dayOfWeek),
      conflicts: all.some(
        (other) => other !== selection && doSectionsConflict(other.section, selection.section),
      ),
    }));
  });

  protected readonly creditsTotal = computed(() =>
    this.selections().reduce((total, s) => total + s.creditHours, 0),
  );

  protected register(selection: ScheduleSelection): void {
    this.registerRequested.emit(selection);
  }

  protected remove(offeringId: string): void {
    this.removeRequested.emit(offeringId);
  }
}
