export type UnitStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
export type ReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED';
export type SeasonName = 'PEAK' | 'MID' | 'OFF_PEAK';

export interface CreateReservationDTO {
  unit_id: number;
  member_id: number;
  season_name: SeasonName;
  check_in: string;  // YYYY-MM-DD
  check_out: string; // YYYY-MM-DD
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
