import { Routes } from '@angular/router';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { BookingsComponent } from './features/bookings/bookings.component';
import { InventoryComponent } from './features/inventory/inventory.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'bookings', component: BookingsComponent },
  { path: 'inventory', component: InventoryComponent },
  { path: '**', redirectTo: 'dashboard' }
];