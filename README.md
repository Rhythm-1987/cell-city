# Cell City

An interactive educational website that teaches cell biology by drawing a cell as a small pixel-art city, with a bioinformatics lab and biology challenges.

## Features

- **Home**: pixel-art introduction to the project.
- **City**: an SVG pixel-art cell. Every structure (nucleus, mitochondria, ribosomes, rough and smooth ER, Golgi, lysosomes, vesicles, membrane, cytoplasm, cytoskeleton) can be selected with the mouse, touch or keyboard (Tab, then Enter or Space), or from the searchable directory. A popup gives a summary; **Learn More** expands the same popup into a detailed view. Vesicles and illustrative ATP particles animate (and can be paused; they are off by default when the system asks for reduced motion). A **Take a Challenge** button runs the quiz inside the City.
- **Bio Lab**: DNA analyser (length, base counts, GC%, complement, reverse complement), transcription (coding or template strand), translation (reading frames, optional AUG start and stop handling), a searchable 64-codon explorer, and a substitution / insertion / deletion visualiser.
- **Challenges**: 5 categories, 21 questions, instant feedback with explanations, scores, restart, and saved best scores.

## Technology

HTML5, CSS3, vanilla JavaScript, SVG, JSON-compatible data and `localStorage`, plus the Bootstrap 5.3.3 CSS/JS bundle loaded from the jsDelivr CDN (navbar, modals, tabs, accordion). No build step, no package manager, no backend.

## Project structure

```
index.html  city.html  bio-lab.html  challenges.html
css/style.css            design system and all page styles
data/sprites.js          pixel-art sprite definitions
data/organelles.js       biology + city-analogy text for each structure
data/genetic-code.js     the standard genetic code (single source for the table and translation)
data/challenges.js       challenge categories and questions
js/main.js               shared helpers, active navigation link
js/pixel.js              sprite renderer (sprites -> crisp SVG)
js/scene.js              builds the City scene (also the home-page hero)
js/city.js               City interactions, directory, popups
js/biolab-core.js        sequence logic (no DOM)
js/biolab.js             Bio Lab interface
js/challenges.js         shared quiz engine (Challenges page and City popup)
assets/                  roadmap and reference files
```

Data lives in plain `.js` files (not `.json`) so the site works when opened straight from disk: browsers block `fetch()` of local JSON on `file://`.

## Running locally

Open `index.html` in a browser. Bootstrap is loaded from a CDN, so the first load needs an internet connection. Alternatively, serve the folder with any static server, for example `python -m http.server` and visit http://localhost:8000.

## Using the Bio Lab

- Sequences are written 5' to 3'. Spaces, line breaks, lower case and FASTA `>` header lines are ignored.
- **Transcription** treats the input as the coding strand by default (mRNA is the same sequence with T replaced by U). Choose "Template strand" to get the reverse complement instead.
- **Translation** reads the forward strand only. Frame 1/2/3 starts at base 1/2/3. Stop codons are shown as `*`; leftover bases that do not make a full codon are reported, not translated.
- **Mutations**: positions count from 1. Insertion puts the new base immediately *before* the chosen position (use length + 1 to append). The tool edits sequences only; it makes no clinical predictions. Sequences are limited to 200 bases.

## Challenge progress

Results are saved in your browser's `localStorage` under the key `cellCity.challengeProgress.v1`: for each challenge, the best score, last score, number of attempts and completion time. Missing, corrupt or outdated data is ignored, and a blocked `localStorage` only disables saving. "Reset saved progress" on the Challenges page clears it.

## Publishing on GitHub Pages

Push the repository, then in **Settings > Pages** choose the `main` branch and the root folder. All paths are relative and lower case, so it works on a project site (`https://<user>.github.io/<repo>/`).

## Assets and licences

All artwork (sprites, hero scene, icons) is original and generated from the definitions in `data/sprites.js`. The only third-party code is Bootstrap 5.3.3 (MIT licence), loaded from a CDN. `assets/images/home-cell.png` and `assets/images/Cutaway-drawing-cell.webp` are earlier reference images that the site no longer uses.
