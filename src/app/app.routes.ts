import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'countries', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'countries',
    loadComponent: () => import('./fp/country-selection/country-selection.component').then(m => m.CountrySelectionComponent),
    canActivate: [authGuard],
  },
  {
    path: 'country/:country/datasets',
    loadComponent: () => import('./fp/dataset-catalog/dataset-catalog.component').then(m => m.DatasetCatalogComponent),
    canActivate: [authGuard],
  },
  {
    path: 'country/:country/datasets/:datasetId',
    loadComponent: () => import('./fp/dataset-host/dataset-host.component').then(m => m.DatasetHostComponent),
    canActivate: [authGuard],
  },
  { path: '**', redirectTo: 'countries' },
];
