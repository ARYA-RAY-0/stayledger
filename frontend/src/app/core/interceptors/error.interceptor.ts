import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

function humanizeError(err: HttpErrorResponse): string {
  const code = err.error?.code as string | undefined;
  const backendMsg = (err.error?.error as string | undefined)?.toLowerCase() || '';

  if (code === 'DATE_CONFLICT' || backendMsg.includes('overlap') || backendMsg.includes('conflict')) {
    return 'Those dates overlap with an existing reservation on this unit. Select different dates or another available unit.';
  }
  if (code === 'INSUFFICIENT_CREDITS' || backendMsg.includes('insufficient') || backendMsg.includes('credits')) {
    return 'This member does not have enough available credits for the selected stay length and season.';
  }
  if (code === 'UNIT_MAINTENANCE' || backendMsg.includes('maintenance')) {
    return 'This unit is currently under maintenance and cannot accept new reservations. Switch the unit back to Available first.';
  }
  if (code === 'INVALID_DATES') {
    return 'Check-out date must be after check-in date.';
  }
  if (err.status === 0 || backendMsg.includes('unknown error')) {
    return 'Unable to reach the resort operations server right now. Check that the API service is running and try again.';
  }
  if (err.status === 404) {
    return 'The requested record could not be found. Refresh the view to sync the latest data.';
  }
  if (err.status >= 500) {
    return 'Something went wrong while saving changes. No partial booking was left behind—please try again.';
  }

  return err.error?.error || 'Could not complete that action. Please review your selections and try again.';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      return throwError(() => ({
        status: err.status,
        code: err.error?.code || 'REQUEST_FAILED',
        message: humanizeError(err)
      }));
    })
  );
};