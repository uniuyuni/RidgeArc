# Accuracy validation: first pass (2026-11-25)

## Decision
Keep current single panorama UI and browser architecture while testing geometry independently. Do not tune by visual impression alone. v0.5 is not yet validated against the actual landscape.

## Research candidates
- HORAYZON: https://github.com/ChristianSteger/HORAYZON — independent terrain ray-tracing, horizon and future shadow reference; Python/native engine, investigate local installation, licensing and georeferencing.
- GRASS GIS r.horizon: https://grass.osgeo.org/grass-stable/manuals/r.horizon.html — independent horizon elevation reference; local/offline validation candidate, not required in the browser.
- horizonator: https://github.com/dkogan/horizonator — terrain renderer design comparison; investigate implementation/license before reuse.
- GSI elevation source priority: https://maps.gsi.go.jp/development/hyokochi.html — confirm exact source at each observation/sample.
- pvlib SPA: https://github.com/pvlib/pvlib-python/blob/main/pvlib/solarposition.py — additional independent solar reference. Existing solar check used Swiss Ephemeris, not pvlib.

## Executed checks
1. Swiss Ephemeris Moshier topocentric Sun, height 374.04m, lat 35.416459 lon 139.048985, JST, 10 minute samples with reference geometric elevation >= 0. Current formula reproduced separately. Maximum absolute azimuth / geometric elevation error:
   - 2026-11-22 (60 samples): 0.00482537 / 0.00695236 degrees.
   - 2026-06-21 (86): 0.00734830 / 0.00199923 degrees.
   - 2026-03-20 (72): 0.00927795 / 0.00764563 degrees.
   Refraction, horizon timing and current JS module execution not established by this comparison. Nine independent reference samples are now regression fixtures.
2. Original GSI GML archive for Tanzawa, private input not committed. Two adjacent 5m mesh blocks, DEM5A preferred, DEM5B fallback, bilinear, same WGS84 Geod distance/curvature model in both profiles. The estimated eye height is 374.041m (includes 1.6m above ground). Compare 2m radial spacing to v0.5 radial schedule:
   - 2km: 295/1440 completely sampled directions. MAE 0.01264 degrees; p95 0.07679; max 0.25867.
   - 8km: 50/1440 completely sampled directions. MAE 0.000444 degrees; p95 0; max 0.01126. Not representative of full landscape.
   - 235.5 deg partial coverage (56.9% of 8km samples): highest available sample 10.89452 vs 10.75680 deg, distance 2366m for dense sample. NOT a validated skyline because missing terrain may be higher.
   This isolates radial sample spacing only; not actual web tiles, angular interpolation, terrain rendering or complete real-world horizon. Offline script: validation/tanzawa_sampling.py. Source archive contains mixed JGD realizations treated as aligned for this provisional experiment.
3. Current visibleSurface copied verbatim and checked against independent linear segment search with patched surfaceDistance: 4824 deterministic synthetic rays; max distance error 1.1368683772161603e-13 m. Found surfaceDistance formerly returned last segment distance even above the local skyline; patched to return null. Regression test added. No full Node suite or browser test executed in this pass.

## Proposed acceptance criteria (not achieved)
- Synthetic surfaces: zero hit/no-hit disagreements and <= 1e-6 m error for same piecewise-linear input.
- Solar: geometry < 0.02 degrees against independent ephemeris across locations/dates, separate tests of refraction, radius and event solver.
- Terrain skyline: target p95 <= 0.1 degrees and max <= 0.25 degrees on valid reference sectors; benchmark both sample spacing and actual tile sources, height/position sensitivity, source seams, angular spacing, long-range curvature. Do not silently treat DEM gaps as clear.
- Real photos: known surveyed viewpoint, camera orientation/focal length, identifiable ridge landmarks; record residuals and distinguish vegetation from bare-earth errors.
- Future: independent 3D mesh first-hit/depth reference and real-browser timing/memory. First establish terrain reliability, then improve presentation and features.

## Remaining uncertainty
The uploaded screenshot does not identify the exact viewpoint/date/height; the second observatory location and camera orientation in earlier photographs are not confirmed. Current 70km cutoff, DEM holes and data-source seams remain. No claim of a validated product or of a measured error for the screenshot.
