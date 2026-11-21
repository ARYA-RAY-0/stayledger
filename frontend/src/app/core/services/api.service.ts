import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AnalyticsOverviewResponse,
  CreateReservationPayload,
  MemberItem,
  ReservationItem,
  UnitItem
} from '../models/stayledger.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://127.0.0.1:4000/api';

  private freshParams(initial: Record<string, string> = {}): HttpParams {
    let params = new HttpParams({ fromObject: initial });
    return params.set('_t', String(Date.now()));
  }

  getOverview(): Observable<AnalyticsOverviewResponse> {
    return this.http.get<AnalyticsOverviewResponse>(
      `${this.baseUrl}/analytics/overview`,
      { params: this.freshParams() }
    );
  }

  getUnits(propertyId?: number | null, status?: string): Observable<UnitItem[]> {
    const raw: Record<string, string> = {};
    if (propertyId) raw['propertyId'] = String(propertyId);
    if (status) raw['status'] = status;
    return this.http.get<UnitItem[]>(`${this.baseUrl}/units`, { params: this.freshParams(raw) });
  }

  updateUnitStatus(unitId: number, status: UnitItem['status']): Observable<UnitItem> {
    return this.http.patch<UnitItem>(`${this.baseUrl}/units/${unitId}/status`, { status });
  }

  getMembers(): Observable<MemberItem[]> {
    return this.http.get<MemberItem[]>(`${this.baseUrl}/members`, { params: this.freshParams() });
  }

  getReservations(): Observable<ReservationItem[]> {
    return this.http.get<ReservationItem[]>(`${this.baseUrl}/reservations`, {
      params: this.freshParams()
    });
  }

  createReservation(payload: CreateReservationPayload): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/reservations`, payload);
  }

  cancelReservation(reservationId: number): Observable<any> {
    return this.http.patch<any>(`${this.baseUrl}/reservations/${reservationId}/cancel`, {});
  }
}