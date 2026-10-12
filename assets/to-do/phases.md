markdown_content = """# Cell City Project To-Do List

## PHASE 1 — Project Foundation

- [+] GitHub repository
- [+] index.html
- [+] city.html
- [+] Semantic HTML
- [+] Basic navigation
- [+] Assets folder
- [+] Final project folder structure
- [+] Global CSS
- [+] Bootstrap integration

## PHASE 2 — Global UI

- [+] Element 1: Global background/theme
- [+] Element 2: Navbar
- [+] Element 3: Brand/logo
- [+] Element 4: Navigation links
- [+] Element 5: Responsive mobile navigation
- [+] Element 6: Footer

## 🏠 PHASE 3 — Home Page

- [+] Element 7: Hero section
- [+] Element 8: Hero heading
- [+] Element 9: Hero description
- [+] Element 10: CTA button
- [+] Element 11: Cell-city preview (the hero now shows a pixel-art cell city; the Cell → City Guide lives on city.html)
- [+] Element 12: Organelle cards (deferred — organelles will be discovered inside the Interactive City, Phase 4, not a standalone page)
- [+] Element 13: Central Dogma visualization (deferred to City/Bio Lab, later phase)
- [+] Element 14: "How Cell City Works" section (now the concise "What is Cell City?" section + three concept pillars)
- [+] Element 14b: Hero visual (original pixel-art cell city drawn from sprites; placeholder removed)

## 🏙️ PHASE 4 — Interactive Cell City

- [+] Element 15: City container
- [+] Element 16: SVG city map
- [+] Element 17: Cell membrane/border
- [+] Element 18: Cytoplasm environment
- [+] Element 19: Cytoskeleton roads
- [+] Element 20: Nucleus / City Hall
- [+] Element 21: Mitochondria / Power Plant
- [+] Element 22: Ribosomes / Protein Factory
- [+] Element 23: Rough ER
- [+] Element 24: Smooth ER
- [+] Element 25: Golgi
- [+] Element 26: Lysosome
- [+] Element 27: Vesicles
- [+] Element 28: Building hover effects
- [+] Element 29: Building click interaction
- [+] Element 30: Information panel/modal
- [+] Element 31: Animated transport vehicles
- [+] Element 32: Energy-flow animation

## 🔬 PHASE 5 — ORGANELLE DISCOVERY (inside the City)

- Note: no standalone organelles page (by design). Organelle info is
  data-driven (data/organelles.js, JSON-compatible so it also works from
  file://) and surfaced through a click → popup/modal on the City page.
- [+] Element 33: Organelle navigation (keyboard-reachable map + searchable structure directory)
- [+] Element 34: Organelle summary view (modal summary + directory entries)
- [+] Element 35: Detailed information panel (Learn More view in the same modal)
- [+] Element 36: Biology/city-role distinction
- [+] Element 37: Bootstrap modal
- [+] Element 38: Bootstrap accordion (detail view sections)
- [+] Element 39: Organelle search/filter

## 🧬 PHASE 6 — BIO LAB

- [+] Element 40: DNA input
- [+] Element 41: DNA validation
- [+] Element 42: GC calculation
- [+] Element 43: Complement
- [+] Element 44: Reverse complement
- [+] Element 45: DNA → RNA transcription
- [+] Element 46: RNA → protein translation
- [+] Element 47: Codon table
- [+] Element 48: Codon interaction
- [+] Element 49: Mutation comparison
- [+] Element 50: Substitution visualization
- [+] Element 51: Insertion visualization
- [+] Element 52: Deletion visualization

## 🎮 PHASE 7 — CHALLENGES

- [+] Element 53: Challenge cards
- [+] Element 54: Question system
- [+] Element 55: Answer buttons
- [+] Element 56: Score calculation
- [+] Element 57: Feedback
- [+] Element 58: Progress bar
- [+] Element 59: Challenge completion
- [+] Element 60: localStorage progress

## ✨ PHASE 8 — POLISH

- [+] Element 61: CSS animations
- [+] Element 62: Hover effects
- [+] Element 63: Transitions
- [+] Element 64: Responsive design
- [ ] Element 65: Accessibility (keyboard, focus, labels, reduced motion implemented and tested; still needs a manual screen-reader and contrast pass)
- [+] Element 66: Error handling
- [ ] Element 67: Loading states (none implemented: all data is bundled and loads synchronously)
- [ ] Element 68: Final biological fact-check (content self-checked; needs review by a subject expert)
- [ ] Element 69: Final GitHub cleanup (pending your review and commit)
- [+] Element 70: README
      """

with open('/mnt/data/cell_city_todo.md', 'w') as f:
f.write(markdown_content)

print("File generated successfully.")
