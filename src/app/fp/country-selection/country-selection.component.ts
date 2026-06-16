import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataService } from '../../services/data.service';

interface CountryOption {
  id: string;
  name: string;
  flag: string;
  datasets: number;
  enabled: boolean;
}

@Component({
  selector: 'app-country-selection',
  standalone: true,
  imports: [MatCardModule, MatButtonModule],
  template: `
    <div class="page-container">
      <section class="hero-row">
        <div class="hero">
          <h1>Select a Country</h1>
          <p>Start by choosing a country to explore available macroeconomic datasets.</p>
        </div>

        <div class="search-bar">
          <input
            type="search"
            class="country-search"
            placeholder="Search countries..."
            [value]="searchTerm()"
            (input)="onSearch(($any($event.target).value ?? '').toString())" />
        </div>
      </section>

      <section class="country-grid">
        @for (country of filteredCountries(); track country.id) {
          <mat-card class="country-card" [class.disabled]="!country.enabled">
            <mat-card-content>
              <div class="country-flag">{{ country.flag }}</div>
              <h2>{{ country.name }}</h2>
              <p>{{ country.datasets }} dataset{{ country.datasets > 1 ? 's' : '' }} available</p>
              <button
                mat-raised-button
                color="primary"
                [disabled]="!country.enabled"
                (click)="selectCountry(country.id)">
                Explore Datasets
              </button>
            </mat-card-content>
          </mat-card>
        }

        @if (!filteredCountries().length) {
          <div class="no-results">No countries match your search.</div>
        }
      </section>
    </div>
  `,
  styles: [`
    .hero-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .hero h1 {
      font-size: 2rem;
      margin-bottom: 8px;
    }

    .hero p {
      opacity: 0.75;
      max-width: 640px;
    }

    .search-bar {
      display: flex;
      justify-content: flex-end;
      flex: 1;
      min-width: 280px;
    }

    .country-search {
      width: 100%;
      max-width: 420px;
      padding: 10px 12px;
      border: 1px solid rgba(128, 128, 128, 0.45);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.04);
      color: inherit;
      outline: none;
    }

    .country-search:focus {
      border-color: var(--mat-app-primary, #26c6da);
      box-shadow: 0 0 0 2px rgba(38, 198, 218, 0.2);
    }

    .country-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    .country-card {
      height: 100%;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .country-card:not(.disabled) {
      cursor: pointer;
    }

    .country-card:not(.disabled):hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.2);
    }

    .country-card mat-card-content {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: center;
      text-align: center;
      padding: 20px;
    }

    .country-flag {
      font-size: 2rem;
      line-height: 1;
    }

    .country-card h2 {
      margin: 0;
      font-size: 1.1rem;
    }

    .country-card p {
      margin: 0;
      opacity: 0.7;
      font-size: 0.9rem;
    }

    .country-card.disabled {
      opacity: 0.55;
    }

    .no-results {
      grid-column: 1 / -1;
      opacity: 0.75;
      text-align: center;
      padding: 20px;
      border: 1px dashed rgba(128, 128, 128, 0.4);
      border-radius: 10px;
    }

    @media (max-width: 768px) {
      .hero-row {
        align-items: stretch;
      }

      .search-bar {
        min-width: 100%;
        justify-content: flex-start;
      }

      .country-search {
        max-width: none;
      }
    }
  `],
})
export class CountrySelectionComponent {
  private router = inject(Router);
  private dataService = inject(DataService);
  searchTerm = signal('');

  countries = signal<CountryOption[]>([
    { id: 'india', name: 'India', flag: '🇮🇳', datasets: 0, enabled: true },
    { id: 'usa', name: 'United States', flag: '🇺🇸', datasets: 0, enabled: false },
    { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', datasets: 0, enabled: false },
    { id: 'canada', name: 'Canada', flag: '🇨🇦', datasets: 0, enabled: false },
    { id: 'australia', name: 'Australia', flag: '🇦🇺', datasets: 0, enabled: false },
    { id: 'germany', name: 'Germany', flag: '🇩🇪', datasets: 0, enabled: false },
    { id: 'france', name: 'France', flag: '🇫🇷', datasets: 0, enabled: false },
    { id: 'japan', name: 'Japan', flag: '🇯🇵', datasets: 0, enabled: false },
    { id: 'china', name: 'China', flag: '🇨🇳', datasets: 0, enabled: false },
    { id: 'brazil', name: 'Brazil', flag: '🇧🇷', datasets: 0, enabled: false },
    { id: 'singapore', name: 'Singapore', flag: '🇸🇬', datasets: 0, enabled: false },
    { id: 'south-korea', name: 'South Korea', flag: '🇰🇷', datasets: 0, enabled: false },
    { id: 'south-africa', name: 'South Africa', flag: '🇿🇦', datasets: 0, enabled: false },
    { id: 'mexico', name: 'Mexico', flag: '🇲🇽', datasets: 0, enabled: false },
    { id: 'russia', name: 'Russia', flag: '🇷🇺', datasets: 0, enabled: false },
    { id: 'italy', name: 'Italy', flag: '🇮🇹', datasets: 0, enabled: false },
    { id: 'spain', name: 'Spain', flag: '🇪🇸', datasets: 0, enabled: false },
    { id: 'netherlands', name: 'Netherlands', flag: '🇳🇱', datasets: 0, enabled: false },
    { id: 'sweden', name: 'Sweden', flag: '🇸🇪', datasets: 0, enabled: false },
    { id: 'switzerland', name: 'Switzerland', flag: '🇨🇭', datasets: 0, enabled: false }
  ]);

  constructor() {
    this.refreshCountryDatasetCounts();
  }

  filteredCountries = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.countries();

    return this.countries().filter((country) => {
      return country.name.toLowerCase().includes(term)
        || country.id.toLowerCase().includes(term)
        || country.flag.includes(term);
    });
  });

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  selectCountry(countryId: string): void {
    void this.router.navigate(['/country', countryId, 'datasets']);
  }

  private refreshCountryDatasetCounts(): void {
    this.countries()
      .filter((country) => country.enabled)
      .forEach((country) => {
        this.dataService.getCountryDatasets(country.id).pipe(
          catchError(() => of({ datasets: [] }))
        ).subscribe((response) => {
          const datasetsCount = response.datasets?.length ?? 0;
          this.countries.update((currentCountries) =>
            currentCountries.map((currentCountry) => {
              if (currentCountry.id !== country.id) {
                return currentCountry;
              }

              return {
                ...currentCountry,
                datasets: datasetsCount,
              };
            })
          );
        });
      });
  }
}
