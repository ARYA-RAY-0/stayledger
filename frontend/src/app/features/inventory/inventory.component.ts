import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { UnitItem } from '../../core/models/stayledger.models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Unit Inventory</h1>
        <p class="muted">Accommodation units, nightly point rates, and maintenance readiness</p>
      </div>
      <div class="filters">
        <button class="chip" [class.active]="selectedStatus() === ''" (click)="selectedStatus.set('')">All ({{ allUnits().length }})</button>
        <button class="chip" [class.active]="selectedStatus() === 'AVAILABLE'" (click)="selectedStatus.set('AVAILABLE')">Available ({{ availableCount() }})</button>
        <button class="chip" [class.active]="selectedStatus() === 'OCCUPIED'" (click)="selectedStatus.set('OCCUPIED')">Occupied ({{ occupiedCount() }})</button>
        <button class="chip" [class.active]="selectedStatus() === 'MAINTENANCE'" (click)="selectedStatus.set('MAINTENANCE')">Maintenance ({{ maintenanceCount() }})</button>
      </div>
    </div>

    @if (error()) {
      <div class="alert err">{{ error() }}</div>
    }

    <div class="card">
      @if (loading()) {
        <div class="empty">Loading units...</div>
      } @else if (filteredUnits().length === 0) {
        <div class="empty">No units in this status category.</div>
      } @else {
        <table>
          <thead>
            <tr>
              <th>Resort</th>
              <th>Unit</th>
              <th>Type</th>
              <th>Capacity</th>
              <th>Nightly Rate</th>
              <th>Status</th>
              <th>Set Readiness</th>
            </tr>
          </thead>
          <tbody>
            @for (u of filteredUnits(); track u.unit_id) {
              <tr>
                <td><strong>{{ u.property_name }}</strong> <span class="muted">({{ u.region }})</span></td>
                <td class="mono"><strong>{{ u.unit_code }}</strong></td>
                <td>{{ u.unit_type }}</td>
                <td class="mono">{{ u.sleeps }} guests</td>
                <td class="mono">{{ u.base_credits_per_night }} pts/night</td>
                <td><span class="pill" [class]="u.status.toLowerCase()">{{ u.status }}</span></td>
                <td class="actions">
                  <button
                    class="btn-sm"
                    [disabled]="savingId() === u.unit_id || u.status === 'AVAILABLE'"
                    (click)="setStatus(u.unit_id, 'AVAILABLE')">
                    Mark Available
                  </button>
                  <button
                    class="btn-sm warn"
                    [disabled]="savingId() === u.unit_id || u.status === 'MAINTENANCE'"
                    (click)="setStatus(u.unit_id, 'MAINTENANCE')">
                    Maintenance
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      }
    </div>
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 1.35rem; font-weight: 700; color: #111827; }
    .muted { color: #6b7280; font-size: 0.82rem; }
    .filters { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { background: #ffffff; color: #374151; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .chip.active { background: #1e4b8a; color: #ffffff; border-color: #1e4b8a; }
    .card { background: #ffffff; border: 1px solid #e2e6ec; border-radius: 10px; padding: 14px 18px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 0.84rem; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 10px 10px; border-bottom: 1px solid #eef1f5; }
    th { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; color: #6b7280; background: #f9fafb; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .pill { font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
    .pill.available { background: #dcfce7; color: #166534; }
    .pill.occupied { background: #dbeafe; color: #1e40af; }
    .pill.maintenance { background: #fef3c7; color: #92400e; }
    .actions { display: flex; gap: 6px; }
    .btn-sm { background: #f3f4f6; color: #1f2937; border: 1px solid #d1d5db; padding: 5px 10px; border-radius: 6px; font-size: 0.76rem; font-weight: 600; cursor: pointer; }
    .btn-sm:hover:not(:disabled) { background: #e5e7eb; }
    .btn-sm.warn { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
    .empty { padding: 24px; text-align: center; color: #6b7280; font-size: 0.84rem; }
    .alert.err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 11px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 0.84rem; }
  `]
})
export class InventoryComponent implements OnInit {
  private readonly api = inject(ApiService);
  allUnits = signal<UnitItem[]>([]);
  selectedStatus = signal('');
  loading = signal(true);
  savingId = signal<number | null>(null);
  error = signal('');

  filteredUnits = computed(() => {
    const status = this.selectedStatus();
    return status ? this.allUnits().filter((u) => u.status === status) : this.allUnits();
  });

  availableCount = computed(() => this.allUnits().filter((u) => u.status === 'AVAILABLE').length);
  occupiedCount = computed(() => this.allUnits().filter((u) => u.status === 'OCCUPIED').length);
  maintenanceCount = computed(() => this.allUnits().filter((u) => u.status === 'MAINTENANCE').length);

  ngOnInit(): void {
    this.loadUnits();
  }

  loadUnits(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getUnits().subscribe({
      next: (u) => {
        this.allUnits.set(u);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }

  setStatus(unitId: number, status: UnitItem['status']): void {
    this.savingId.set(unitId);
    this.error.set('');
    this.api.updateUnitStatus(unitId, status).subscribe({
      next: () => {
        this.savingId.set(null);
        this.loadUnits();
      },
      error: (err) => {
        this.savingId.set(null);
        this.error.set(err.message);
      }
    });
  }
}