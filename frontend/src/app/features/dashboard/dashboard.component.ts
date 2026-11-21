import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsOverviewResponse } from '../../core/models/stayledger.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Executive Operations Overview</h1>
        <p class="muted">Real-time resort occupancy, point liability, and double-entry ledger verification</p>
      </div>
      <button class="btn-primary" (click)="loadOverview()">Refresh Metrics</button>
    </div>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    @if (loading()) {
      <div class="card muted">Loading resort metrics...</div>
    } @else if (data(); as d) {
      <div class="verify-bar" [class.drift]="d.kpis.reconciliation.status !== 'BALANCED'">
        <div class="verify-info">
          <span class="tag" [class.ok]="d.kpis.reconciliation.status === 'BALANCED'" [class.bad]="d.kpis.reconciliation.status !== 'BALANCED'">
            {{ d.kpis.reconciliation.status === 'BALANCED' ? 'Balances Verified' : 'Balance Mismatch Found' }}
          </span>
          <span>
            Member point balances match ledger history with <strong>{{ d.kpis.reconciliation.total_variance }}</strong> pts variance
            and <strong>{{ d.kpis.reconciliation.missing_debit_count }}</strong> missing stay debits.
          </span>
        </div>
        <button class="btn-light" type="button" (click)="showAudit.set(!showAudit())">
          {{ showAudit() ? 'Hide Member Breakdown' : 'View Member Breakdown' }}
        </button>
      </div>

      @if (showAudit()) {
        <div class="card">
          <h2>Member Wallet &amp; Ledger Audit</h2>
          <table>
            <thead>
              <tr>
                <th>Member ID</th>
                <th>Member</th>
                <th>Current Balance</th>
                <th>Ledger Net Sum</th>
                <th>Entries</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              @for (m of d.kpis.reconciliation.members; track m.member_id) {
                <tr>
                  <td class="mono">{{ m.member_no }}</td>
                  <td><strong>{{ m.full_name }}</strong></td>
                  <td class="mono">{{ m.stored_balance | number }} pts</td>
                  <td class="mono">{{ m.ledger_sum | number }} pts</td>
                  <td class="mono">{{ m.entry_count }}</td>
                  <td>
                    @if (m.variance === 0) {
                      <span class="pill ok">Matched</span>
                    } @else {
                      <span class="pill bad">{{ m.variance }} pts diff</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-title">Active Occupancy</div>
          <div class="kpi-val">{{ d.kpis.portfolio_occupancy_pct }}%</div>
          <div class="kpi-sub">{{ d.kpis.occupied_units }} of {{ d.kpis.total_units - d.kpis.maintenance_units }} ready units occupied</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Credits Redeemed</div>
          <div class="kpi-val">{{ d.kpis.total_credits_redeemed | number }}</div>
          <div class="kpi-sub">{{ d.kpis.credits_per_available_unit | number }} avg credits per unit</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Member Credit Pool</div>
          <div class="kpi-val">{{ d.kpis.unredeemed_credit_liability | number }}</div>
          <div class="kpi-sub">Held across {{ d.kpis.total_members }} club members</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Average Stay</div>
          <div class="kpi-val">{{ d.kpis.avg_length_of_stay }} <span>nights</span></div>
          <div class="kpi-sub">{{ d.kpis.cancellation_rate_pct }}% cancellation rate</div>
        </div>
      </div>

      <div class="card">
        <h2>Resort Property Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Resort</th>
              <th>Location</th>
              <th>Units (Ready / Occupied / Maint)</th>
              <th>Occupancy</th>
              <th>Active Stays</th>
              <th>Credits Used</th>
              <th>Avg Stay</th>
            </tr>
          </thead>
          <tbody>
            @for (p of d.properties; track p.property_id) {
              <tr>
                <td class="mono"><strong>{{ p.code }}</strong></td>
                <td><strong>{{ p.name }}</strong></td>
                <td>{{ p.region }}</td>
                <td class="mono">{{ p.available_units }} / {{ p.occupied_units }} / {{ p.maintenance_units }}</td>
                <td>
                  <div class="meter">
                    <div class="bar"><div class="fill" [style.width.%]="p.active_occupancy_pct"></div></div>
                    <span class="mono">{{ p.active_occupancy_pct }}%</span>
                  </div>
                </td>
                <td class="mono">{{ p.active_bookings }}</td>
                <td class="mono">{{ p.total_credits_redeemed | number }}</td>
                <td class="mono">{{ p.avg_length_of_stay }}n</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="split-grid">
        <div class="card">
          <h2>Season Demand &amp; Yield</h2>
          <table>
            <thead>
              <tr>
                <th>Season</th>
                <th>Bookings</th>
                <th>Nights</th>
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              @for (s of d.kpis.season_yield; track s.season_name) {
                <tr>
                  <td><strong>{{ s.season_name }}</strong></td>
                  <td class="mono">{{ s.booking_count }}</td>
                  <td class="mono">{{ s.total_nights }}</td>
                  <td class="mono">{{ s.credits_yield | number }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="card">
          <h2>Recent Point Ledger Activity</h2>
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Activity</th>
                <th>Change</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of d.recent_ledger; track entry.ledger_id) {
                <tr>
                  <td><strong>{{ entry.member_name }}</strong> <span class="muted">({{ entry.member_no }})</span></td>
                  <td class="small">{{ entry.entry_type.replace('_', ' ') }}</td>
                  <td class="mono" [class.pos]="entry.delta > 0" [class.neg]="entry.delta < 0">
                    {{ entry.delta > 0 ? '+' + entry.delta : entry.delta }}
                  </td>
                  <td class="mono">{{ entry.balance_after | number }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 1.35rem; font-weight: 700; color: #111827; }
    h2 { margin: 0 0 12px; font-size: 0.98rem; font-weight: 600; color: #111827; }
    .muted { color: #6b7280; font-size: 0.84rem; margin: 3px 0 0; }
    .small { font-size: 0.78rem; color: #4b5563; }

    .verify-bar { background: #ffffff; border: 1px solid #d1fae5; border-left: 4px solid #16a34a; border-radius: 9px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 0.84rem; }
    .verify-bar.drift { border-color: #fecaca; border-left-color: #dc2626; }
    .verify-info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; color: #374151; }
    .tag { font-size: 0.72rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
    .tag.ok { background: #dcfce7; color: #166534; }
    .tag.bad { background: #fee2e2; color: #991b1b; }

    .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; margin-bottom: 16px; }
    .kpi-card { background: #ffffff; border: 1px solid #e2e6ec; border-radius: 10px; padding: 16px 18px; }
    .kpi-title { font-size: 0.74rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
    .kpi-val { font-size: 1.65rem; font-weight: 700; color: #111827; margin: 5px 0; font-variant-numeric: tabular-nums; }
    .kpi-val span { font-size: 0.88rem; font-weight: 500; color: #6b7280; }
    .kpi-sub { font-size: 0.78rem; color: #6b7280; }

    .card { background: #ffffff; border: 1px solid #e2e6ec; border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; overflow-x: auto; }
    .split-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }

    table { width: 100%; border-collapse: collapse; font-size: 0.84rem; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 10px 10px; border-bottom: 1px solid #eef1f5; }
    th { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; background: #f9fafb; }
    tbody tr:hover { background: #f8fafc; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    .meter { display: flex; align-items: center; gap: 8px; min-width: 110px; }
    .bar { flex: 1; height: 6px; background: #e5e7eb; border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; background: #1e4b8a; border-radius: 999px; }

    .pill { font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
    .pill.ok { background: #dcfce7; color: #166534; }
    .pill.bad { background: #fee2e2; color: #991b1b; }
    .pos { color: #15803d; font-weight: 600; }
    .neg { color: #b91c1c; font-weight: 600; }

    .btn-primary { background: #1e4b8a; color: #ffffff; border: none; padding: 8px 14px; border-radius: 7px; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
    .btn-primary:hover { background: #163a6c; }
    .btn-light { background: #ffffff; color: #1f2937; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 7px; font-size: 0.78rem; font-weight: 600; cursor: pointer; }
    .btn-light:hover { background: #f3f4f6; }
    .alert.error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 11px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 0.84rem; }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  data = signal<AnalyticsOverviewResponse | null>(null);
  error = signal('');
  loading = signal(true);
  showAudit = signal(false);

  ngOnInit(): void {
    this.loadOverview();
  }

  loadOverview(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getOverview().subscribe({
      next: (res) => {
        this.data.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }
}