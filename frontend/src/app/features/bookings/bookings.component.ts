import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/services/api.service';
import { MemberItem, ReservationItem, UnitItem } from '../../core/models/stayledger.models';

@Component({
  selector: 'app-bookings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Portfolio Timeline &amp; Reservations</h1>
        <p class="muted">Visual unit stay schedule, instant credit quoting, and member stay details</p>
      </div>
      <div class="head-actions">
        <button class="btn-light" type="button" (click)="prefillOverlap()">Test Overlapping Dates</button>
        <button class="btn-light" type="button" (click)="reloadAll()">Sync Schedule</button>
      </div>
    </div>

    @if (feedback()) {
      <div class="alert ok">{{ feedback() }}</div>
    }
    @if (error()) {
      <div class="alert err">{{ error() }}</div>
    }

    <div class="inspector-layout">
      <div class="center-pane">
        <section class="card">
          <h2>Create Reservation</h2>
          <form [formGroup]="form" (ngSubmit)="submitBooking()" class="form-grid">
            <label>
              Accommodation Unit
              <select formControlName="unit_id">
                @for (u of units(); track u.unit_id) {
                  <option [value]="u.unit_id">
                    {{ u.property_code }} · {{ u.unit_code }} ({{ u.unit_type }} · {{ u.base_credits_per_night }} pts/n)
                  </option>
                }
              </select>
            </label>

            <label>
              Club Member
              <select formControlName="member_id">
                @for (m of members(); track m.member_id) {
                  <option [value]="m.member_id">
                    {{ m.full_name }} ({{ m.credits_balance | number }} pts)
                  </option>
                }
              </select>
            </label>

            <label>
              Season
              <select formControlName="season_name">
                <option value="OFF_PEAK">Off-Peak (0.75x)</option>
                <option value="MID">Mid Season (1.00x)</option>
                <option value="PEAK">Peak Season (1.50x)</option>
              </select>
            </label>

            <label>
              Check-In
              <input type="date" formControlName="check_in" />
            </label>

            <label>
              Check-Out
              <input type="date" formControlName="check_out" />
            </label>

            <div class="submit-col">
              <button class="btn-primary" type="submit" [disabled]="form.invalid || submitting()">
                {{ submitting() ? 'Saving...' : 'Confirm Stay' }}
              </button>
            </div>
          </form>

          @if (quote(); as q) {
            <div class="quote-bar" [class.alert-tone]="!q.validDates || q.insufficient || q.unitMaintenance">
              <span>
                <strong>{{ q.nights }}</strong> night(s) × <strong>{{ q.multiplier }}x</strong> =
                <strong class="accent">{{ q.totalCredits | number }} credits</strong>
              </span>
              <span>
                @if (!q.validDates) {
                  <span class="bad-txt">Choose a check-out date after check-in.</span>
                } @else if (q.unitMaintenance) {
                  <span class="bad-txt">This unit is currently in maintenance.</span>
                } @else if (q.insufficient) {
                  <span class="bad-txt">Needs {{ q.totalCredits - q.memberBalance | number }} more credits than member holds.</span>
                } @else {
                  <span class="ok-txt">Balance after booking: {{ q.projectedBalance | number }} credits</span>
                }
              </span>
            </div>
          }
        </section>

        <section class="card">
          <div class="card-top">
            <h2>Unit Stay Schedule</h2>
            <span class="muted">Click any stay bar to inspect member &amp; booking details</span>
          </div>

          @if (loading()) {
            <div class="empty">Loading unit schedule...</div>
          } @else {
            <div class="timeline-list">
              @for (u of units(); track u.unit_id) {
                <div class="timeline-row">
                  <div class="unit-meta">
                    <div class="u-title">{{ u.unit_code }} · {{ u.unit_type }}</div>
                    <div class="u-sub">{{ u.property_name }} · <span class="u-state" [class]="u.status.toLowerCase()">{{ u.status }}</span></div>
                  </div>
                  <div class="unit-tracks">
                    @for (r of reservationsForUnit(u.unit_id); track r.reservation_id) {
                      <button
                        type="button"
                        class="stay-chip"
                        [class.cancelled]="r.status === 'CANCELLED'"
                        [class.selected]="selectedReservation()?.reservation_id === r.reservation_id"
                        (click)="selectReservation(r)">
                        <span class="stay-guest">{{ r.member_name }}</span>
                        <span class="stay-dates mono">{{ r.check_in }} → {{ r.check_out }} ({{ r.credits_charged }} pts)</span>
                      </button>
                    }
                    @if (reservationsForUnit(u.unit_id).length === 0) {
                      <span class="open-slot">Open for booking</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <section class="card">
          <h2>All Reservations</h2>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Unit</th>
                <th>Member</th>
                <th>Stay Window</th>
                <th>Credits</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (r of reservations(); track r.reservation_id) {
                <tr class="clickable-row" (click)="selectReservation(r)">
                  <td class="mono"><strong>{{ r.reference_code }}</strong></td>
                  <td>{{ r.property_code }} · <span class="mono">{{ r.unit_code }}</span></td>
                  <td>{{ r.member_name }}</td>
                  <td class="mono">{{ r.check_in }} → {{ r.check_out }} ({{ r.nights }}n)</td>
                  <td class="mono">{{ r.credits_charged | number }}</td>
                  <td><span class="badge" [class]="r.status.toLowerCase()">{{ r.status }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      </div>

      <aside class="right-inspector">
        <div class="inspector-card">
          <div class="insp-head">
            <span class="insp-kicker">Member &amp; Stay 360°</span>
            <h3>{{ activeMember()?.full_name || 'Select a Reservation' }}</h3>
            @if (activeMember(); as m) {
              <div class="insp-sub">{{ m.member_no }} · {{ m.tier }} Tier</div>
            }
          </div>

          @if (activeMember(); as m) {
            <div class="balance-box">
              <div class="bal-label">Available Credit Balance</div>
              <div class="bal-val">{{ m.credits_balance | number }} <span>pts</span></div>
              <div class="bal-exp">Valid through {{ m.credits_expiry_date }}</div>
            </div>
          }

          @if (selectedReservation(); as r) {
            <div class="detail-list">
              <div class="detail-row">
                <span>Booking Ref</span>
                <strong class="mono">{{ r.reference_code }}</strong>
              </div>
              <div class="detail-row">
                <span>Property &amp; Unit</span>
                <strong>{{ r.property_name }} ({{ r.unit_code }})</strong>
              </div>
              <div class="detail-row">
                <span>Check-In / Out</span>
                <strong class="mono">{{ r.check_in }} → {{ r.check_out }}</strong>
              </div>
              <div class="detail-row">
                <span>Season &amp; Nights</span>
                <strong>{{ r.season_name }} · {{ r.nights }} nights</strong>
              </div>
              <div class="detail-row">
                <span>Credits Charged</span>
                <strong class="mono">{{ r.credits_charged | number }} pts</strong>
              </div>
              <div class="detail-row">
                <span>Status</span>
                <span class="badge" [class]="r.status.toLowerCase()">{{ r.status }}</span>
              </div>
            </div>

            @if (r.status !== 'CANCELLED') {
              <button class="btn-refund" type="button" (click)="cancelBooking(r.reservation_id)">
                Cancel Stay &amp; Refund {{ r.credits_charged | number }} Credits
              </button>
            }
          } @else {
            <p class="muted">Click any reservation on the schedule or table to inspect stay details and manage cancellations.</p>
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 1.35rem; font-weight: 700; color: #111827; }
    h2 { margin: 0 0 12px; font-size: 0.98rem; font-weight: 600; color: #111827; }
    h3 { margin: 2px 0; font-size: 1.05rem; color: #111827; }
    .muted { color: #6b7280; font-size: 0.82rem; margin: 2px 0 0; }
    .head-actions { display: flex; gap: 8px; }

    .inspector-layout { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 18px; align-items: start; }
    .center-pane { min-width: 0; }
    .card { background: #ffffff; border: 1px solid #e2e6ec; border-radius: 10px; padding: 16px 18px; margin-bottom: 16px; overflow-x: auto; }
    .card-top { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }

    .form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(165px, 1fr)); gap: 12px; align-items: end; }
    label { display: flex; flex-direction: column; gap: 5px; font-size: 0.76rem; font-weight: 600; color: #374151; }
    select, input { background: #f9fafb; border: 1px solid #d1d5db; border-radius: 7px; padding: 8px 10px; font-size: 0.84rem; color: #111827; }

    .quote-bar { margin-top: 12px; padding: 10px 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e2e6ec; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 0.82rem; color: #374151; }
    .quote-bar.alert-tone { background: #fef2f2; border-color: #fecaca; }
    .accent { color: #1e4b8a; }
    .ok-txt { color: #15803d; font-weight: 600; }
    .bad-txt { color: #b91c1c; font-weight: 600; }

    .timeline-list { display: flex; flex-direction: column; gap: 8px; }
    .timeline-row { display: grid; grid-template-columns: 195px minmax(0, 1fr); gap: 12px; padding: 10px 12px; border: 1px solid #eef1f5; border-radius: 8px; background: #fafbfc; align-items: center; }
    .u-title { font-size: 0.84rem; font-weight: 600; color: #111827; }
    .u-sub { font-size: 0.74rem; color: #6b7280; margin-top: 2px; }
    .u-state { font-weight: 600; }
    .u-state.available { color: #15803d; }
    .u-state.occupied { color: #1e4b8a; }
    .u-state.maintenance { color: #b45309; }

    .unit-tracks { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .stay-chip { display: inline-flex; flex-direction: column; text-align: left; background: #e8eef8; border: 1px solid #bfd0eb; color: #163a6c; border-radius: 7px; padding: 6px 10px; cursor: pointer; transition: all 0.14s ease; }
    .stay-chip:hover { background: #dbe6f7; }
    .stay-chip.selected { outline: 2px solid #1e4b8a; background: #dbe6f7; }
    .stay-chip.cancelled { background: #f3f4f6; border-color: #d1d5db; color: #6b7280; text-decoration: line-through; }
    .stay-guest { font-size: 0.78rem; font-weight: 600; }
    .stay-dates { font-size: 0.7rem; opacity: 0.88; }
    .open-slot { font-size: 0.76rem; color: #9ca3af; font-style: italic; }

    table { width: 100%; border-collapse: collapse; font-size: 0.83rem; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #eef1f5; }
    th { font-size: 0.72rem; font-weight: 600; text-transform: uppercase; color: #6b7280; background: #f9fafb; }
    .clickable-row { cursor: pointer; }
    .clickable-row:hover { background: #f8fafc; }

    .right-inspector { position: sticky; top: 64px; }
    .inspector-card { background: #ffffff; border: 1px solid #e2e6ec; border-radius: 10px; padding: 18px; }
    .insp-kicker { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #1e4b8a; }
    .insp-sub { font-size: 0.78rem; color: #6b7280; }
    .balance-box { margin: 14px 0; padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e5e7eb; }
    .bal-label { font-size: 0.72rem; color: #6b7280; text-transform: uppercase; font-weight: 600; }
    .bal-val { font-size: 1.45rem; font-weight: 700; color: #111827; margin: 2px 0; font-variant-numeric: tabular-nums; }
    .bal-val span { font-size: 0.82rem; font-weight: 500; color: #6b7280; }
    .bal-exp { font-size: 0.74rem; color: #6b7280; }

    .detail-list { display: flex; flex-direction: column; gap: 9px; padding-top: 8px; border-top: 1px solid #eef1f5; margin-bottom: 14px; }
    .detail-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.8rem; }
    .detail-row span { color: #6b7280; }
    .detail-row strong { color: #111827; text-align: right; }

    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .badge { font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: #dbeafe; color: #1e40af; }
    .badge.cancelled { background: #fee2e2; color: #991b1b; }
    .badge.checked_in { background: #dcfce7; color: #166534; }

    .btn-primary { width: 100%; background: #1e4b8a; color: #fff; border: none; padding: 9px 14px; border-radius: 7px; font-size: 0.82rem; font-weight: 600; cursor: pointer; }
    .btn-primary:hover:not(:disabled) { background: #163a6c; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-light { background: #ffffff; color: #374151; border: 1px solid #d1d5db; padding: 7px 12px; border-radius: 7px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
    .btn-light:hover { background: #f3f4f6; }
    .btn-refund { width: 100%; background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; padding: 9px 12px; border-radius: 7px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
    .btn-refund:hover { background: #fee2e2; }

    .empty { padding: 20px; text-align: center; color: #6b7280; font-size: 0.84rem; }
    .alert { padding: 11px 14px; border-radius: 8px; margin-bottom: 14px; font-size: 0.84rem; }
    .alert.ok { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
    .alert.err { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

    @media (max-width: 1080px) {
      .inspector-layout { grid-template-columns: 1fr; }
      .right-inspector { position: static; }
      .timeline-row { grid-template-columns: 1fr; }
    }
  `]
})
export class BookingsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  reservations = signal<ReservationItem[]>([]);
  units = signal<UnitItem[]>([]);
  members = signal<MemberItem[]>([]);
  selectedReservation = signal<ReservationItem | null>(null);
  loading = signal(true);
  feedback = signal('');
  error = signal('');
  submitting = signal(false);

  form = this.fb.nonNullable.group({
    unit_id: [3, Validators.required],
    member_id: [1, Validators.required],
    season_name: ['MID' as 'PEAK' | 'MID' | 'OFF_PEAK', Validators.required],
    check_in: ['2027-03-10', Validators.required],
    check_out: ['2027-03-13', Validators.required]
  });

  formVal = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  activeMember = computed(() => {
    const sel = this.selectedReservation();
    if (sel) {
      return this.members().find((m) => m.member_id === sel.member_id) || null;
    }
    const chosenId = Number(this.formVal().member_id);
    return this.members().find((m) => m.member_id === chosenId) || this.members()[0] || null;
  });

  quote = computed(() => {
    const v = this.formVal();
    const unit = this.units().find((u) => u.unit_id === Number(v.unit_id));
    const member = this.members().find((m) => m.member_id === Number(v.member_id));
    if (!unit || !member || !v.check_in || !v.check_out) return null;

    const start = new Date(v.check_in);
    const end = new Date(v.check_out);
    const validDates = !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start;
    const nights = validDates ? Math.round((end.getTime() - start.getTime()) / 86400000) : 0;
    const multMap: Record<string, number> = { OFF_PEAK: 0.75, MID: 1.0, PEAK: 1.5 };
    const multiplier = multMap[v.season_name || 'MID'] ?? 1.0;
    const totalCredits = Math.round(unit.base_credits_per_night * nights * multiplier);
    const projectedBalance = member.credits_balance - totalCredits;

    return {
      validDates,
      nights,
      multiplier,
      totalCredits,
      memberBalance: member.credits_balance,
      projectedBalance,
      insufficient: projectedBalance < 0,
      unitMaintenance: unit.status === 'MAINTENANCE'
    };
  });

  ngOnInit(): void {
    this.reloadAll();
  }

  reloadAll(): void {
    this.loading.set(true);
    this.api.getReservations().subscribe({
      next: (r) => {
        this.reservations.set(r);
        this.loading.set(false);
        const currentId = this.selectedReservation()?.reservation_id;
        if (currentId) {
          this.selectedReservation.set(r.find((item) => item.reservation_id === currentId) || null);
        } else if (r.length > 0) {
          this.selectedReservation.set(r[0]);
        }
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
    this.api.getUnits().subscribe({ next: (u) => this.units.set(u) });
    this.api.getMembers().subscribe({ next: (m) => this.members.set(m) });
  }

  reservationsForUnit(unitId: number): ReservationItem[] {
    return this.reservations().filter((r) => r.unit_id === unitId);
  }

  selectReservation(r: ReservationItem): void {
    this.selectedReservation.set(r);
  }

  prefillOverlap(): void {
    const active = this.reservations().find((r) => r.status !== 'CANCELLED');
    if (!active) {
      this.error.set('Create an active booking first so there is an existing stay window to overlap.');
      return;
    }
    const altMember = this.members().find((m) => m.member_id !== active.member_id && m.credits_balance >= 1500) || this.members()[0];
    this.form.patchValue({
      unit_id: active.unit_id,
      member_id: altMember ? altMember.member_id : active.member_id,
      season_name: active.season_name,
      check_in: active.check_in,
      check_out: active.check_out
    });
    this.error.set('');
    this.feedback.set(`Filled existing stay dates (${active.check_in} → ${active.check_out}) on ${active.unit_code}. Click "Confirm Stay" to see how overlapping dates are blocked.`);
  }

  submitBooking(): void {
    if (this.form.invalid) return;
    this.error.set('');
    this.feedback.set('');
    this.submitting.set(true);

    const raw = this.form.getRawValue();
    this.api.createReservation({
      unit_id: Number(raw.unit_id),
      member_id: Number(raw.member_id),
      season_name: raw.season_name,
      check_in: raw.check_in,
      check_out: raw.check_out
    }).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.feedback.set(`Reservation ${created.reference_code} confirmed — ${created.credits_charged} credits used (updated balance: ${created.new_member_balance} pts).`);
        this.reloadAll();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(err.message);
      }
    });
  }

  cancelBooking(id: number): void {
    this.error.set('');
    this.feedback.set('');
    this.api.cancelReservation(id).subscribe({
      next: (res) => {
        this.feedback.set(`Reservation ${res.reference_code} cancelled — ${res.credits_refunded} credits returned to member balance (${res.new_member_balance} pts).`);
        this.reloadAll();
      },
      error: (err) => {
        this.error.set(err.message);
      }
    });
  }
}