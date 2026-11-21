import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from './core/services/api.service';
import { AnalyticsOverviewResponse } from './core/models/stayledger.models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="ops-shell">
      <aside class="left-rail">
        <div class="rail-brand">
          <div class="rail-mark">SL</div>
          <div>
            <div class="rail-title">StayLedger</div>
            <div class="rail-sub">Holiday Club Ops</div>
          </div>
        </div>

        <div class="rail-block">
          <label class="rail-label">Portfolio Scope</label>
          <select class="rail-select" [ngModel]="selectedProperty()" (ngModelChange)="selectedProperty.set($event)">
            <option value="ALL">All Coastal &amp; Berg Resorts</option>
            @if (overview(); as ov) {
              @for (p of ov.properties; track p.property_id) {
                <option [value]="p.code">{{ p.name }} ({{ p.code }})</option>
              }
            }
          </select>
        </div>

        <div class="rail-block">
          <input
            type="search"
            class="rail-search"
            placeholder="Quick search member or unit..."
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
          />
        </div>

        <nav class="rail-nav">
          <a routerLink="/dashboard" routerLinkActive="active">
            <span class="nav-ic">◈</span>
            <span>Executive Overview</span>
          </a>
          <a routerLink="/bookings" routerLinkActive="active">
            <span class="nav-ic">▤</span>
            <span>Portfolio Timeline &amp; Bookings</span>
          </a>
          <a routerLink="/inventory" routerLinkActive="active">
            <span class="nav-ic">◫</span>
            <span>Unit Inventory</span>
          </a>
        </nav>

        <div class="rail-footer">
          @if (overview(); as ov) {
            <div class="health-box" [class.warn]="ov.kpis.reconciliation.status !== 'BALANCED'">
              <div class="health-row">
                <span class="dot" [class.warn]="ov.kpis.reconciliation.status !== 'BALANCED'"></span>
                <strong>{{ ov.kpis.reconciliation.status === 'BALANCED' ? 'Ledger Balanced' : 'Check Ledger' }}</strong>
              </div>
              <div class="health-meta">
                {{ ov.kpis.unredeemed_credit_liability | number }} pts member liability
              </div>
            </div>
          }
        </div>
      </aside>

      <div class="main-column">
        <header class="top-strip">
          <div class="strip-left">
            <span class="crumb">Resort Operations Workspace</span>
          </div>
          @if (overview(); as ov) {
            <div class="strip-kpis">
              <div class="mini-kpi">
                <span>Occupancy</span>
                <strong>{{ ov.kpis.portfolio_occupancy_pct }}%</strong>
              </div>
              <div class="mini-kpi">
                <span>Credits Redeemed</span>
                <strong>{{ ov.kpis.total_credits_redeemed | number }}</strong>
              </div>
              <div class="mini-kpi">
                <span>Active Stays</span>
                <strong>{{ ov.kpis.active_bookings }}</strong>
              </div>
            </div>
          }
        </header>

        <main class="workspace">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .ops-shell { display: flex; min-height: 100vh; background: #f4f5f7; color: #18202c; }

    .left-rail { width: 248px; flex-shrink: 0; background: #ffffff; border-right: 1px solid #e2e6ec; display: flex; flex-direction: column; padding: 18px 14px; gap: 14px; }
    .rail-brand { display: flex; align-items: center; gap: 10px; padding: 2px 6px 8px; border-bottom: 1px solid #edf0f5; }
    .rail-mark { width: 34px; height: 34px; border-radius: 8px; background: #1e4b8a; color: #ffffff; font-weight: 700; font-size: 0.9rem; display: grid; place-items: center; }
    .rail-title { font-weight: 700; font-size: 0.98rem; color: #111827; }
    .rail-sub { font-size: 0.72rem; color: #6b7280; }

    .rail-block { display: flex; flex-direction: column; gap: 6px; }
    .rail-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; padding: 0 2px; }
    .rail-select, .rail-search { width: 100%; box-sizing: border-box; background: #f9fafb; border: 1px solid #d1d5db; border-radius: 7px; padding: 7px 9px; font-size: 0.82rem; color: #1f2937; }
    .rail-select:focus, .rail-search:focus { outline: none; border-color: #2563eb; background: #ffffff; }

    .rail-nav { display: flex; flex-direction: column; gap: 4px; margin-top: 2px; }
    .rail-nav a { display: flex; align-items: center; gap: 9px; padding: 9px 10px; border-radius: 7px; text-decoration: none; font-size: 0.84rem; font-weight: 500; color: #374151; transition: background 0.14s ease, color 0.14s ease; }
    .rail-nav a:hover { background: #f3f4f6; color: #111827; }
    .rail-nav a.active { background: #e8eef8; color: #1e4b8a; font-weight: 600; }
    .nav-ic { font-size: 0.9rem; width: 16px; text-align: center; opacity: 0.85; }

    .rail-footer { margin-top: auto; padding-top: 10px; border-top: 1px solid #edf0f5; }
    .health-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 10px; }
    .health-box.warn { background: #fef2f2; border-color: #fecaca; }
    .health-row { display: flex; align-items: center; gap: 7px; font-size: 0.78rem; color: #166534; }
    .health-box.warn .health-row { color: #991b1b; }
    .health-meta { font-size: 0.72rem; color: #4b5563; margin-top: 3px; padding-left: 14px; }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: #16a34a; display: inline-block; }
    .dot.warn { background: #dc2626; }

    .main-column { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .top-strip { background: #ffffff; border-bottom: 1px solid #e2e6ec; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
    .crumb { font-size: 0.8rem; font-weight: 600; color: #4b5563; }
    .strip-kpis { display: flex; gap: 18px; flex-wrap: wrap; }
    .mini-kpi { display: flex; align-items: baseline; gap: 6px; font-size: 0.78rem; color: #6b7280; background: #f8fafc; border: 1px solid #e5e7eb; padding: 4px 10px; border-radius: 6px; }
    .mini-kpi strong { font-size: 0.86rem; color: #111827; font-variant-numeric: tabular-nums; }

    .workspace { flex: 1; padding: 20px 24px 36px; max-width: 1440px; width: 100%; box-sizing: border-box; margin: 0 auto; }

    @media (max-width: 900px) {
      .ops-shell { flex-direction: column; }
      .left-rail { width: 100%; border-right: none; border-bottom: 1px solid #e2e6ec; }
    }
  `]
})
export class App implements OnInit {
  private readonly api = inject(ApiService);
  overview = signal<AnalyticsOverviewResponse | null>(null);
  selectedProperty = signal('ALL');
  searchQuery = signal('');

  ngOnInit(): void {
    this.api.getOverview().subscribe({
      next: (res) => this.overview.set(res)
    });
  }
}