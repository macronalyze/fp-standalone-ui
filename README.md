# FP UI

Macro economics data analyzer UI for investors. The app is structured around a country-first journey and dataset-specific experiences.

## Core Product Flow

1. Select a country.
2. View dataset catalog for that country.
3. Open a dataset-specific experience.

Current route flow:

- `/countries`
- `/country/:country/datasets`
- `/country/:country/datasets/:datasetId`

## Opinions and Assumptions

- Dataset visualization is opinionated and owned by each dataset feature.
- A given dataset behaves the same across countries; only the source data changes.
- Dataset experiences are feature-scoped, not shared generic chart screens.
- If a dataset exists in catalog data but is not implemented as a feature, show `Coming Soon`.

## Tech Stack

- Angular 17 (standalone components)
- Angular Material
- Signals for local UI state
- Chart.js + ng2-charts for dataset visualizations
- Static JSON assets as data source (`src/assets/data/...`)

## Project Structure

```text
src/app/
	app.component.ts
	app.config.ts
	app.routes.ts
	components/
		navbar/
			navbar.component.ts
	fp/
		country-selection/
			country-selection.component.ts
		dataset-catalog/
			dataset-catalog.component.ts
			dataset-card.component.ts
		dataset-host/
			dataset-host.component.ts
		datasets/
			dataset-registry.ts
			core-industries/
				core-industries.component.ts
				core-industries-data.service.ts
	services/
		data.service.ts
		theme.service.ts
```

## Data and Service Model

- `DataService` (`src/app/services/data.service.ts`) is the shared base data access layer:
	- `getCountryDatasets(country)` -> catalog file (`datasets.json`)
	- `getDatasetDetail(country, datasetId)` -> dataset detail file (`{datasetId}.json`)
- Dataset features can wrap `DataService` with dataset-specific services.
	- Example: `CoreIndustriesDataService`.

## Dataset Ownership Model

- Catalog and cards are shared within the `dataset-catalog` feature.
- Each dataset has its own folder under `fp/datasets/{dataset-id}/`.
- Dataset feature registration lives in `fp/datasets/dataset-registry.ts`.
- `dataset-host` resolves which dataset component to render from registry.

## Development

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm start
```

Build production bundle:

```bash
npm run build
```

## How to Add a New Dataset Experience

1. Add/verify dataset metadata in country catalog JSON:
	 - `src/assets/data/{country}/datasets.json`
2. Add dataset detail JSON:
	 - `src/assets/data/{country}/{dataset-id}.json`
3. Create dataset feature folder:
	 - `src/app/fp/datasets/{dataset-id}/`
4. Implement dataset component and optional dataset-specific service.
5. Register component in:
	 - `src/app/fp/datasets/dataset-registry.ts`

If step 5 is skipped, the catalog entry remains visible and host shows `Coming Soon`.

