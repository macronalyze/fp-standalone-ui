import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { ExportDataComponent } from './export-data.component';
import { ImportDataComponent } from './import-data.component';

@Component({
  selector: 'app-import-export',
  standalone: true,
  imports: [MatTabsModule, MatIconModule, RouterLink, ExportDataComponent, ImportDataComponent],
  template: `
    <div class="page-container">
      <div class="breadcrumb">
        <a [routerLink]="['/country', country, 'datasets']" class="back-link">
          <mat-icon>arrow_back</mat-icon>
          {{ formatCountryName(country) }} Datasets
        </a>
        <span class="crumb-sep">/</span>
        <span>Trade Data</span>
      </div>

      <div class="header-block">
        <h2>Import / Export Trade Data</h2>
        <p class="meta">Switch tabs to analyze exports and imports with country compare mode.</p>
      </div>

      <mat-tab-group animationDuration="200ms">
        <mat-tab label="Export Data">
          <app-export-data [country]="country"></app-export-data>
        </mat-tab>
        <mat-tab label="Import Data">
          <app-import-data [country]="country"></app-import-data>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      font-size: 0.9rem;
      opacity: 0.75;
    }

    .back-link {
      display: flex;
      align-items: center;
      gap: 4px;
      text-decoration: none;
      color: inherit;
    }

    .crumb-sep {
      opacity: 0.5;
    }

    .header-block {
      margin-bottom: 8px;
    }

    .header-block h2 {
      margin: 0 0 4px;
    }

    .meta {
      opacity: 0.7;
      font-size: 0.9rem;
    }
  `],
})
export class ImportExportComponent {
  @Input({ required: true }) country = 'india';

  formatCountryName(countryCode: string): string {
    return countryCode
      .split('-')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(' ');
  }
}
