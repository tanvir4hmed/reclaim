---
inclusion: always
---

# Re:Claim design direction

The mockups Tanvir shared on 2026-11-15 are one example of the intended mood, density and polish. They are not a spec and not assets. Do not copy their photos or layout pixel for pixel. Every product and effect is code-rendered and original.

## Core principle

Day shop and haunted shop share one layout: same DOM, navigation, grid positions and cart. Only lighting, palette, decoration, product condition and copy change. A visitor must be able to point at any haunted item and name what it used to be.

## Palettes (starting values, tune freely)

- Day: cream paper `#f4ecdf`, card cream `#fbf6ee`, Christmas red `#9b1b24`, gold `#c8a24c`, warm ink `#2a2220`.
- Haunted: midnight blue-charcoal `#0e1420`, charcoal cards `#171a22`, dried red `#7a1820`, aged brass `#a8894e`, bone text `#e6dccb`.
- Both states meet WCAG AA contrast for text and controls.

## Composition cues taken from the example

- Header: logo, a few nav links, pill search, account, cart with count badge. The logo mark changes subtly after the reveal (filled → hollow).
- Hero: one rich scene with a CTA on the left. The day scene and the haunted scene occupy the same frame.
- Category tiles under the hero; filter sidebar plus product grid with sort and grid/list toggle.
- Cards: object on fabric, wishlist heart, title, rating, price, qty stepper, red cart button, glow on hover, starburst badge for sale items.
- Product detail: thumbnails, large view, old/new price, qty, Add to cart, an outlined **Inspect** button (eye icon), service icons.
- Cart: right-side drawer with thumbnails, steppers, remove, full-width checkout.

## Craft rules

- Each horror effect must have a reason tied to the object or the story. No random jump scares.
- Prefer slow, small, deniable motion over loud motion. Unease comes from things that are slightly wrong.
- Typography: a serif display face for headings and a clean sans for UI. Use OFL fonts, self-hosted.
- All motion has a `prefers-reduced-motion` alternative that keeps the meaning (show the end state, use a fade).
