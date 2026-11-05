# BMW Generation Tree

An interactive, chronological technology tree of BMW production generations (1927 – 2026), styled after the World of Tanks tech tree. Plain HTML, CSS, JavaScript and SVG — no dependencies, no build step, no backend.

## Run it

**Easiest:** double-click `index.html`. It works straight from disk (it falls back to `data/bmw-models.js` because browsers block `fetch()` of local JSON).

**Or serve it** (then it reads `data/bmw-models.json` directly):

```bash
cd bmw-tree
python3 -m http.server 8000      # then open http://localhost:8000
```

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | The site |
| `data/bmw-models.json` | **Source of truth** for all records |
| `data/bmw-models.js` | Generated copy for `file://` use — don't edit by hand |
| `tools/build-data.js` | `node tools/build-data.js` — validates the JSON (duplicate ids, end < start, broken links) and regenerates the `.js` copy |
| `tools/check-wikipedia.js` | `node tools/check-wikipedia.js --write` — checks every Wikipedia URL (needs internet, Node 18+) and sets `wikipediaVerified` |

## Updating the database

Edit `data/bmw-models.json`, then run `node tools/build-data.js`. Each record:

```json
{
  "id": "bmw-3-series-e46-sedan",
  "model": "BMW 3 Series", "series": "3 Series", "line": "Sedan",
  "generation": "E46", "family": "E46", "codeType": "Production chassis code",
  "body": "Sedan", "tags": ["Sedan"],
  "productionStart": 1997, "productionEnd": 2005,
  "status": "discontinued", "category": "Standard", "chassisFamily": "E",
  "predecessorId": "...", "successorId": "...", "basedOn": null, "relatedMIds": [],
  "wikipedia": "https://en.wikipedia.org/wiki/BMW_3_Series_(E46)", "wikipediaVerified": false,
  "uncertain": null, "notes": null
}
```

* `series` picks the lane (column group); `line` picks the sub-column inside it (body style, or model for M / i / historic lanes).
* `productionEnd: null` means still in production.
* `category`: `Standard`, `M`, `M Performance`, `Electric`, `Special`.
* `status` rules: current = still built; historical = ended before 1990; discontinued = ended 1990 or later.
* `uncertain` holds a plain-language reason whenever a date, code or link isn't confirmed. These records show an amber dot in the tree.
* New `series`/lane names also need an entry in the `LANES` list at the top of `app.js`.

## Using the site

* **Drag** to pan, **scroll / pinch** to zoom, `+ − ⤢ ⟲` buttons or arrow keys (when the tree is focused).
* Card top = production start; the coloured rail below it = how long it was built. The vertical scale is the same for every lane, so overlapping generations genuinely overlap.
* **Click a node** for the detail drawer (bottom sheet on phones): predecessor/successor, related M model, Wikipedia, archive link, image (loaded live from Wikipedia when online), compare.
* **Click a lane title** to collapse it, or a family band (HISTORIC, NUMBERED SERIES, …) to collapse a group.
* **Timeline / Families** toggle: true time scale, or generations stacked in order.
* **Search** (press `/`): `E46`, `1998`, `M3`, `X5`, `E92 Coupé`, `G80`, `3 Series Touring`. Matches are highlighted and framed.
* Filters (body, year range + decades, model family, chassis code, type, status) combine with AND between groups and OR within a group. The URL updates so a filtered view can be shared.
* **CSV** exports the currently filtered generations.
* On phones the default is a searchable, collapsible family list with proportional mini-timelines; switch to **Tree** for pan/pinch.

## Data accuracy — please read

The database was compiled from general knowledge of public reference sources, **not** checked against BMW Group Classic or live Wikipedia in this build.

* **Wikipedia URLs are all `wikipediaVerified: false`.** Run `node tools/check-wikipedia.js --write` on a machine with internet, then `node tools/build-data.js`. Body-specific codes (E91/E92/E93 …) point to the shared family article.
* Records carrying an `uncertain` note (about a quarter of them) have a start/end year, code, article title or current-production status that needs confirming. Chassis codes `G90`/`G99` (M5), `NA0` (Neue Klasse iX3) and the 2026 status of the 8 Series, M8, Z4 and X4 are the ones to check first.
* Pre-war and post-war historic cars use marketing designations, not chassis codes (`codeType` says which).
* Dates are worldwide production years; regional exceptions are noted in `notes` where known.
* BMW archive links point only to the BMW Group Classic portal, not to deep pages (no deep URLs were invented).
