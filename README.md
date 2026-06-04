# Plant Field App

Mobile Web-App/PWA prototype for learning and identifying sampled plant species in the field.

## Files

- `index.html`: app shell
- `style.css`: mobile-friendly layout
- `app.js`: filtering, tree rendering, iNaturalist image loading
- `data/species.json`: species/taxonomy/plot/rank/notes data
- `scripts/export_species_for_app.R`: export script from R objects into `data/species.json`
- `images/`: optional local images

## How to use locally

Open the folder in RStudio or terminal and start a small local server, for example:

```r
servr::httd("plant-field-app")
```

Then open the shown local URL in your browser.

Directly opening `index.html` can fail because browsers block loading local JSON files.

## Own images

Put images into folders like:

```text
images/Poa_trivialis/photo1.jpg
```

Then add paths to `species_notes.csv` in a column called `local_images`, separated by semicolons:

```text
images/Poa_trivialis/photo1.jpg; images/Poa_trivialis/photo2.jpg
```
