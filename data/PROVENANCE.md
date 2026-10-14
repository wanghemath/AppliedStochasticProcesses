# Observed bike-sharing data: provenance and reuse

The bundled sample contains **365 observed daily records from 2011**, derived from UCI's Bike Sharing dataset. `cnt` is the daily number of completed rentals in the source, including casual and registered users. It is not the number of distinct bicycles, a fleet capacity, unmet requests, or latent demand. The source describes Capital Bikeshare in Washington, D.C.

## Source and license

- Dataset: Hadi Fanaee-T (2013), *Bike Sharing*, UCI Machine Learning Repository, [DOI: 10.24432/C5W894](https://doi.org/10.24432/C5W894).
- [Official dataset page](https://archive.ics.uci.edu/dataset/275/bike+sharing+dataset), accessed and license verified **2026-10-12**.
- [Official archive](https://archive.ics.uci.edu/static/public/275/bike+sharing+dataset.zip), retrieved **2026-10-12**. Source member: `day.csv`, 731 daily records across 2011–2012.
- The UCI landing page licenses the dataset under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Redistribution and adaptation are permitted with attribution; this course subset is an adaptation. Retain this credit and identify changes when reusing it. No endorsement is implied.
- Source paper requested by the archive README: Fanaee-T, H. and Gama, J. (2013), *Event labeling combining ensemble detectors and background knowledge*, Progress in Artificial Intelligence, [DOI: 10.1007/s13748-013-0040-3](https://doi.org/10.1007/s13748-013-0040-3).

The original `Readme.txt` is preserved as `source_readme.txt`. Its citation notice is supplemented by the explicit license on the current UCI landing page. The course uses no weather columns; inconsistent historical descriptions of their normalization do not affect this sample.

## Changes and data dictionary

We retained dates from 2011-01-01 through 2011-12-31 inclusive, retained the four columns below, and sorted dates ascending. The output uses UTF-8 and LF line endings. No rows were imputed, no counts were rescaled, and no synthetic observations were added.

| Field | Meaning and unit |
|---|---|
| `dteday` | Source calendar date, YYYY-MM-DD. The aggregate source does not specify a timezone; no UTC conversion is applied. |
| `cnt` | Nonnegative integer count of completed rentals during that calendar day. |
| `workingday` | 1 if the day is neither a weekend nor a holiday, 0 otherwise, using source coding. |
| `mnth` | Calendar month number, 1–12. |

`bike_daily_2011.csv` is the notebook input. `bike_daily_2011.js` contains the same dates, counts, and recorded `workingday` flags for offline HTML pages and assigns `window.COURSE_BIKE_DATA`. Both are generated from the same extraction. The browser file is data, not a simulated series.

## Reproduce and verify

The sample is already bundled; neither the lesson nor the notebook needs network access. To rebuild, use Python's standard library from the course root:

```bash
python scripts/prepare_data.py --archive /path/to/bike+sharing+dataset.zip
```

Omit `--archive` to download the official archive. The script verifies the pinned SHA-256 before processing and fails if the source changes. It writes the CSV, browser data, original README, and `source_metadata.json`. The metadata records archive, original member, CSV, and browser hashes as well as the retrieval date and transformation. If using an independently retrieved archive, pass its actual retrieval date with `--retrieved-on YYYY-MM-DD`.

## Teaching decisions and limitations

The lesson assumes a **scenario threshold of 4,000 rentals/day**. It is a chosen reporting threshold, **not measured system capacity**, and exceeding it does not establish a shortage. We model the indicator $Y_t=1\{X_t>4000\}$; counts equal to 4,000 do not exceed it. Simulated indicators are explicitly labeled synthetic.

We estimate the constant Bernoulli probability on January–August 2011 (243 days) and reserve September–December (122 days) for chronological validation. Dates are never shuffled. This division is fixed before fitting; after inspecting test results, further tuning would require a new untouched future period for an honest final evaluation. One year cannot establish stable annual seasonality or performance in future years. Weather, availability, policy, and growth may affect observed counts. Predictive differences between time periods are not causal effects.
