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
assets/                  roadmap and reference files, favicon
tests/                   automated checks (see "Tests" below)
```

Data lives in plain `.js` files (not `.json`) so the site works when opened straight from disk: browsers block `fetch()` of local JSON on `file://`.

## Running locally

Open `index.html` in a browser, or serve the folder with any static server, for example `python -m http.server` and visit http://localhost:8000.

**Internet connection and Bootstrap.** Bootstrap 5.3.3 is loaded from the jsDelivr CDN, so the site is *not* fully offline. If the CDN is unreachable, the page shows a notice and:

- the **Challenges** page, the **Bio Lab** calculations and the **Home** page still work (the layout falls back to the site's own CSS and looks plainer);
- the **City** pop-ups and "Take a Challenge" dialog do not open, the Bio Lab tabs cannot be switched, and the mobile menu does not open, because they use Bootstrap's JavaScript.

Copying Bootstrap's CSS and JS into the repository and pointing the four pages at those copies would remove the dependency; this has not been done.

## Using the Bio Lab

- Sequences are written 5' to 3'. Spaces, line breaks, lower case and FASTA `>` header lines are ignored.
- **Transcription** treats the input as the coding strand by default (mRNA is the same sequence with T replaced by U). Choose "Template strand" to get the reverse complement instead.
- **Translation** reads the forward strand only. Frame 1/2/3 starts at base 1/2/3. Stop codons are shown as `*`; leftover bases that do not make a full codon are reported, not translated.
- **Mutations**: positions count from 1. Insertion puts the new base immediately *before* the chosen position (use length + 1 to append). The tool edits sequences only; it makes no clinical predictions. Sequences are limited to 200 bases. The note under the result reads the sequence as coding DNA from base 1 purely as an illustration. A one-base insertion or deletion is not a multiple of three, so in a real coding region it *can* shift the reading frame; whether it does depends on the gene.

## Challenge progress

Results are saved in your browser's `localStorage` under the key `cellCity.challengeProgress.v1`: for each challenge, the best score, last score, number of attempts and completion time. Every stored value is validated (integer scores between 0 and the number of questions, matching question count); anything missing, corrupt or outdated is ignored, and a blocked `localStorage` only disables saving (the results screen says so). "Reset saved progress" on the Challenges page clears it.

## Publishing on GitHub Pages

Push the repository, then in **Settings > Pages** choose the `main` branch and the root folder. All paths are relative and lower case, so it works on a project site (`https://<user>.github.io/<repo>/`).

## Assets and licences

All artwork (sprites, hero scene, icons) is original and generated from the definitions in `data/sprites.js`. The only third-party code is Bootstrap 5.3.3 (MIT licence), loaded from a CDN. `assets/images/home-cell.png` and `assets/images/Cutaway-drawing-cell.webp` are earlier reference images that the site no longer uses.

## Tests

The tests use only Node.js (v22 or newer, for its built-in test runner and WebSocket) and an installed Microsoft Edge or Chrome. There is nothing to install.

```
node --test "tests/unit/*.test.js"                                  # fast: logic, data, markup, colour contrast
node --test --test-concurrency=1 "tests/browser/*.test.js"          # drives headless Edge through every page
node --test --test-concurrency=1 "tests/unit/*.test.js" "tests/browser/*.test.js"   # everything
```

- `tests/unit` loads the shipped scripts in Node. The genetic code is checked against a separately written amino-acid-to-codon table, and sequence functions against hand-computed values.
- `tests/browser` talks to Edge over the DevTools protocol (`tests/helpers/browser.js`, no dependencies) using real mouse and keyboard input. It serves the repository from a local server, also under a `/Cell_City/` sub-path and from `file://`, and fails on any console error, failed request or horizontal overflow.
- Set `EDGE_PATH` if Edge or Chrome is installed somewhere unusual. Without a browser the browser tests are reported as skipped, not passed.
- The Edge tests need internet access because Bootstrap loads from the CDN.

These do not replace a screen-reader pass, an expert review of the biology text or testing on real phones.
