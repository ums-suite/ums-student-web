import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  UmsBadgeComponent,
  UmsButtonComponent,
  UmsEmptyStateComponent,
  UmsErrorStateComponent,
  UmsFormFieldComponent,
  UmsInputComponent,
  UmsModalComponent,
  UmsOfflineBannerComponent,
  UmsSelectComponent,
  UmsSkeletonComponent,
  type SelectOption,
} from '@ums/design-system';
import { ConnectivityService } from '../../core/pwa/connectivity.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { buildTimeLabels, computeGridPlacement, routineColorIndex } from './routine.logic';
import { RoutineStore } from './routine.store';
import type { RoutineBlock } from './routine.types';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Routine screen (SWEB-16, requirement-spec.md §3.3/§7): a full week grid, each class a colored
 * block sized to its actual duration, tap-to-expand for detail; an exam list stands in for the
 * spec's "exam-period overlay" (confirmed gap -- `RoutineStore`'s own class doc explains why no
 * real calendar overlay is possible: `Exam` carries no scheduled date anywhere server-side); and a
 * building/room directory stands in for a per-class "where is this room" link (confirmed gap --
 * `SectionDto` has no room field at all).
 */
@Component({
  selector: 'app-routine',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UmsBadgeComponent,
    UmsButtonComponent,
    UmsEmptyStateComponent,
    UmsErrorStateComponent,
    UmsFormFieldComponent,
    UmsInputComponent,
    UmsModalComponent,
    UmsOfflineBannerComponent,
    UmsSelectComponent,
    UmsSkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './routine.component.html',
  styleUrl: './routine.component.scss',
})
export class RoutineComponent {
  protected readonly store = inject(RoutineStore);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly translation = inject(TranslationService);

  protected readonly sessionIdInput = signal('');
  protected readonly selectedBlock = signal<RoutineBlock | null>(null);
  protected readonly selectedBuildingId = signal('');

  protected readonly timeLabels = buildTimeLabels();
  protected readonly dayLabels = DAY_LABELS;

  protected readonly buildingOptions = computed<SelectOption[]>(() =>
    this.store.buildings().map((b) => ({ value: b.id, label: b.name })),
  );

  protected readonly lastUpdatedLabel = computed(() => {
    const fetchedAt = this.store.fetchedAt();
    return fetchedAt ? new Date(fetchedAt).toLocaleTimeString() : '';
  });

  protected loadSession(): void {
    const id = this.sessionIdInput().trim();
    if (id) {
      this.store.loadSession(id);
    }
  }

  protected retry(): void {
    this.loadSession();
  }

  protected placementFor(block: RoutineBlock) {
    return computeGridPlacement(block);
  }

  protected colorClassFor(block: RoutineBlock): string {
    return `routine__block--color-${routineColorIndex(block.offeringId)}`;
  }

  protected dayLabel(dayOfWeek: number): string {
    return DAY_LABELS[dayOfWeek] ?? String(dayOfWeek);
  }

  protected expand(block: RoutineBlock): void {
    this.selectedBlock.set(block);
  }

  protected closeExpanded(): void {
    this.selectedBlock.set(null);
  }

  protected loadRoomDirectory(): void {
    this.store.loadBuildings();
  }

  protected onBuildingSelected(buildingId: string): void {
    this.selectedBuildingId.set(buildingId);
    if (buildingId) {
      this.store.loadRoomsForBuilding(buildingId);
    }
  }

  protected translateMessage(
    key: string,
    params?: Readonly<Record<string, string | number>>,
  ): string {
    return this.translation.t(key, params);
  }
}
