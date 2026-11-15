# Requirements Document

## Introduction

Re:Claim is a playable browser horror experience for the Kiroween 2026 Costume Contest. It opens as a polished, cheerful Christmas e-commerce shop. A small white cloth ghost hides behind the shop's objects and now and then flies to a new hiding place. Clicking it is the only trigger that reveals the same shop after a fictional war. The visitor can browse, search, inspect and cart objects in both states. Each featured object has a normal state, a haunted inspection and a distinct consequence when carted. Checkout is a fictional final transaction. The ending returns the visitor to the opening shop with one difference left behind by them.

### Story and intent

- **What the products are:** every item belonged to someone lost in a fictional war. The Christmas sale is a polished resale of the dead's belongings. Each object still carries its owner's last moment (shoes that walked through fire, a watch that stopped, a letter that was never sent, a photo with one person missing).
- **The name:** "Re:Claim" reads as an email subject ("Re: Claim your offer") and as the owners reclaiming what was taken.
- **The psychology:** the visitor arrives as a normal holiday shopper. Familiar objects with a second meaning make the visitor recognize the loss themselves; nothing is explained. Every Add to Cart is a small act of taking, and the objects answer back. Checkout makes the visitor pay with part of themselves, and the ending turns them into the next object on the shelf. The visitor is not a victim of the shop; they are its newest stock.
- **The horror style:** slow, small, deniable wrongness. One anomaly moves while the rest of the shop holds still. Every effect comes from an object's story. No random jump scares.

Under the story, the shop is built from real e-commerce dark patterns (fake countdowns, false scarcity, pre-checked add-ons, confirmshaming). An optional receipt after the ending names them, so the piece also teaches visitors to recognize manipulative shopping tactics during the holiday season.

No real payments, accounts or personal data. All objects, effects and sound are code-rendered or code-generated.

## Glossary

- **Shop**: the Re:Claim web application.
- **Day state**: the Christmas sale before the reveal.
- **Haunted state**: the same shop after the reveal.
- **Reveal**: the in-place transformation from Day state to Haunted state.
- **Ghost**: a small white cloth ghost, drawn originally for this project as a homage to Kiro's ghost mascot, that hides behind objects in the Day state and is the only Reveal trigger.
- **Live object**: a product rendered in real time as a lit 3D object, not a photo, whose condition and motion change in place.
- **Anomaly**: any unnatural event (a Consequence, a bat landing, the hand crawling, an early sign).
- **Stage**: the right to show a major Anomaly. Only one major Anomaly holds the Stage at a time.
- **Lasting mark**: a trace an Anomaly leaves behind (footprints, blood prints, ash, a tilted tag) that stays until the ending.
- **Hiding spot**: a predefined place behind a shop object (hero decoration, product tile, category tile, header element) where the Ghost can hide.
- **Storm flicker**: the lightning-like flicker of every light in the shop, with a knock on the screen, caused by hovering or focusing the Ghost.
- **Featured product**: one of the nine objects with special behavior (shoes, pocket watch, doll, letter, typewriter, mirror, photo frame, cake, telephone).
- **Consequence**: the distinct effect a featured product causes when added to the cart in the Haunted state.
- **Echo**: the object left behind by a player. The next visitor's Ghost hides behind it.
- **Echo service**: a small API that stores the latest Echo so a different visitor can receive it.
- **Reduced motion**: the user's `prefers-reduced-motion: reduce` setting.

## Requirements

### Requirement 1: Christmas storefront

**User Story:** As a visitor, I want a convincing, polished Christmas shop, so that I believe it is a real store before anything goes wrong.

#### Acceptance Criteria

1. WHEN the Shop loads for the first time, THE Shop SHALL show the Day state with a header (logo, navigation, search, account, cart with count), a hero scene, category tiles, a filter sidebar, a product grid and a footer.
2. THE Day state SHALL use warm red, cream and gold, with holiday lights, stars, ornaments, a snowman, toys, gifts, chocolates and cakes in the hero and decoration.
3. THE Shop SHALL be fully usable at viewport widths from 360 px to 1920 px, collapsing the sidebar into a filter drawer below 900 px.
4. THE Shop SHALL show a visible shop clock, styled as a "sale ends in" countdown, on every view.
5. THE Shop SHALL present at least 18 products, including the nine Featured products, spread across at least four categories.
6. THE Day state SHALL use believable sales pressure that the receipt (Requirement 25) later names: the "sale ends in" countdown, "Only 1 left" scarcity badges and starburst discounts.
### Requirement 2: Products with a second meaning

**User Story:** As a visitor, I want product descriptions that read as normal at first, so that I recognize their second meaning after the reveal.

#### Acceptance Criteria

1. THE Shop SHALL give every product a name, category, price, rating, short description and a Day and Haunted rendering.
2. THE Day description of each Featured product SHALL read as ordinary sales copy AND SHALL contain a phrase whose second meaning becomes clear in the Haunted state.
3. WHILE in the Haunted state, THE Shop SHALL show each product's haunted name, description, condition and price, keeping the item recognizable as its Day version.
4. THE Haunted price SHALL be expressed in non-monetary terms (for example time, years, or a memory).
5. THE product copy SHALL refer only to a fictional war, with no real country, flag, conflict or person.

### Requirement 3: Search

**User Story:** As a visitor, I want to search the shop, so that I can find products quickly.

#### Acceptance Criteria

1. WHEN the visitor types in the search field, THE Shop SHALL filter products by name, category and description within 100 ms per keystroke.
2. WHEN no products match, THE Shop SHALL show an empty state with a way to clear the search.
3. THE search SHALL work by keyboard alone, including Enter to submit and Escape to clear.
4. WHILE in the Haunted state, THE search SHALL keep working on the haunted names and descriptions.

### Requirement 4: Categories, filters and sorting

**User Story:** As a visitor, I want to browse by category, price and order, so that the shop behaves like a real store.

#### Acceptance Criteria

1. WHEN the visitor selects a category tile, nav link or sidebar checkbox, THE Shop SHALL show only products in the selected categories.
2. THE Shop SHALL provide a two-handle price range filter that is operable by pointer, touch and keyboard.
3. THE Shop SHALL sort products by featured, price ascending, price descending and rating.
4. THE Shop SHALL provide a grid and a list view toggle.
5. WHEN filters, search or sort change, THE Shop SHALL keep each product at a stable position relative to the others so the Reveal does not reshuffle the grid.
6. THE Shop SHALL reflect the active category, search and sort in the URL so that reloading keeps the view.

### Requirement 5: Product detail and inspection

**User Story:** As a visitor, I want a product page with a closer inspection view, so that I can examine objects like in a real store and discover what they hide.

#### Acceptance Criteria

1. WHEN the visitor opens a product, THE Shop SHALL show a detail view with thumbnails, a large view, old and new price, qty stepper, Add to cart, an Inspect button and service icons.
2. WHEN the visitor activates Inspect in the Day state, THE Shop SHALL show a normal close-up of the object that can be rotated or zoomed.
3. WHEN the visitor activates Inspect on a Featured product in the Haunted state, THE Shop SHALL show that product's haunted inspection (Requirements 13–21).
4. THE inspection view SHALL load its detailed rendering on demand, so the product grid does not pay for it.
5. THE detail and inspection views SHALL be closable with a close button, the Escape key and the browser Back action, returning focus to the element that opened them.

### Requirement 6: Cart

**User Story:** As a visitor, I want a working cart, so that the shopping flow feels real in both states.

#### Acceptance Criteria

1. WHEN the visitor adds a product, THE Shop SHALL add it to the cart, update the header count and announce the change to assistive technology.
2. THE cart drawer SHALL let the visitor change quantity, remove items and proceed to checkout.
3. THE cart SHALL persist across page reloads on the same device.
4. WHEN the Reveal happens, THE cart SHALL keep the same items and quantities, showing them in their Haunted rendering.
5. THE cart total SHALL equal the sum of each item's unit price times quantity in the current state's terms.

### Requirement 7: Early signs before the Reveal

**User Story:** As a visitor, I want rare, deniable signs that something is wrong, so that the Reveal feels earned.

#### Acceptance Criteria

1. WHILE in the Day state, THE Shop SHALL occasionally show one subtle sign: a single holiday bulb goes out, a framed picture tilts, or an ornament's shadow keeps moving after the ornament stops.
2. THE Shop SHALL show at most one sign at a time, each lasting no more than 2 seconds, with at least 30 seconds between signs.
3. THE signs SHALL never block or change shopping controls.
4. WHILE Reduced motion is on, THE signs SHALL use static changes (a dark bulb, a tilted frame) instead of motion.

### Requirement 8: The hiding Ghost

**User Story:** As a visitor, I want to notice a small white cloth ghost hiding in the shop, so that finding it becomes my way into the horror.

#### Acceptance Criteria

1. WHILE in the Day state, THE Shop SHALL show one Ghost: a small white cloth ghost with a rounded head, a wavy hem and two dark oval eyes, mostly hidden behind a Hiding spot, with part of it (an edge of cloth, a peeking face) visible.
1a. THE Ghost SHALL be an original drawing that nods to Kiro's ghost mascot; THE Shop SHALL not embed the official Kiro logo file unless permission is confirmed (Rules section 11).
2. THE Shop SHALL define at least eight Hiding spots across the hero, category tiles, product tiles and header, including spots visible on a 360 px wide screen.
3. WHILE the visitor is not interacting with the Ghost, THE Ghost SHALL occasionally fly to a different Hiding spot along a soft floating path, with 15 to 40 seconds between flights.
4. THE Ghost SHALL appear for the first time within 10 seconds of the first load, and SHALL peek out noticeably (lean out, then hide again) at least once every 20 seconds so a first-time visitor can find it.
5. THE Ghost SHALL never cover a product's price, cart button, search field or navigation.
6. WHEN the visitor clicks or taps the Ghost, THE Shop SHALL start the Reveal (Requirement 10).
7. THE Ghost SHALL be the only control that starts the Reveal.
8. THE Ghost SHALL be reachable by keyboard: it SHALL be focusable when visible, have an accessible name that does not spoil the story (for example "Something behind the decorations"), and start the Reveal with Enter or Space.
9. WHILE Reduced motion is on, THE Ghost SHALL move between Hiding spots with a fade instead of a flight.

### Requirement 9: Storm flicker on hover

**User Story:** As a visitor, I want the shop to react when I get close to the Ghost, so that I feel I found something I should not touch.

#### Acceptance Criteria

1. WHEN the pointer hovers over the Ghost or the Ghost receives keyboard focus, THE Shop SHALL play a Storm flicker: every light in the shop (holiday bulbs, lantern, star glow, page lighting) flickers like lightning and goes dark for an instant, and the screen gives a single knock (a short jolt as if something hit the glass).
2. THE Storm flicker SHALL last no more than 1.2 seconds and SHALL flash no more than three times in any one-second period, in line with WCAG 2.3.1.
3. THE Storm flicker SHALL not repeat until the pointer leaves the Ghost and returns, with at least 3 seconds between flickers.
4. WHEN the Storm flicker starts, THE Ghost SHALL freeze and look toward the pointer, and SHALL not fly away while hovered.
5. WHERE the visitor uses touch input, THE first tap on the Ghost SHALL play the Storm flicker and a second tap within 4 seconds SHALL start the Reveal; IF no second tap comes, THEN THE Ghost SHALL hide again.
6. WHILE Reduced motion is on, THE Storm flicker SHALL be a single soft dim of the lights with no jolt and no flashing.

### Requirement 10: The Reveal

**User Story:** As a visitor, I want the shop I was browsing to transform around me, so that I recognize what every object used to be.

#### Acceptance Criteria

1. WHEN the Reveal starts, THE Shop SHALL transform the current view in place, without a page load or route change, within 3 seconds.
2. THE Reveal SHALL keep the same navigation, header, grid positions, filters, search text, scroll position and cart.
3. THE Reveal SHALL change lighting, palette (midnight blue, charcoal, aged brass), decorations, product condition, product copy and the logo mark.
4. THE Haunted hero SHALL occupy the same frame as the Day hero, with its objects in recognizable positions (the tree, the lantern, the snow globe, the framed group photo).
5. THE Haunted state SHALL persist across reloads until the ending (Requirement 23) completes.
6. WHILE Reduced motion is on, THE Reveal SHALL be a cross-fade of no more than 1 second.

### Requirement 11: Haunted ambient life

**User Story:** As a visitor, I want the haunted shop to feel inhabited, so that it stays unsettling while I shop.

#### Acceptance Criteria

1. WHILE in the Haunted state, THE Shop SHALL show at least three animated bats that hang upside down from shop edges, unfold their wings, fly across the shop and land at a different perch.
2. Now and then, a bat SHALL leave the hero banner, flap down into the product grid, hang upside down from the edge of a product card, and later fly to a different card.
3. THE Shop SHALL have at most two bats in flight at a time, and bats SHALL never block a control the visitor is using; a bat on a card SHALL take off if the pointer reaches that card's controls.
3a. Once per Haunted visit, a severed hand SHALL rise from the bottom edge of the screen finger by finger, grip the edge of the page, and pull itself with its fingers toward the product grid.
3b. WHEN the visitor scrolls, THE hand SHALL be able to move to another part of the page, but the bloody fingerprints and drag marks it left SHALL stay fixed to the page where they fell (Lasting marks in page coordinates).
3c. Later, THE same hand SHALL occasionally reach in from a screen edge to retrieve a fallen ornament, at most once per 45 seconds.
4. THE Haunted state SHALL use controlled parallax, delayed reflections (reflective surfaces lag the visitor's pointer by a noticeable delay) and shapes hidden in negative space (figures that appear only in the gaps between objects).
5. WHILE Reduced motion is on, THE bats SHALL stay perched with small wing movement, the hand SHALL appear only as its finished prints and drag marks, and parallax SHALL be off.

### Requirement 12: Featured product rules

**User Story:** As a visitor, I want each featured object to answer back when I take it, so that every purchase has a cost.

#### Acceptance Criteria

1. THE Shop SHALL give each Featured product a Day state, a Haunted state, a haunted inspection and a Consequence.
2. WHILE in the Haunted state, WHEN the visitor opens a Featured product, THE Shop SHALL show that product's first Anomaly inside the product view.
3. WHEN the visitor adds a Featured product to the cart in the Haunted state, THE Shop SHALL play that product's Consequence, which SHALL spread beyond the product card into the whole page, and SHALL leave a Lasting mark.
3a. THE Shop SHALL schedule Anomalies so that only one major Anomaly holds the Stage at a time; WHILE an Anomaly holds the Stage, all other ambient motion (bats, hand, signs) SHALL hold still.
3b. THE Shop SHALL leave a quiet gap of at least 6 seconds between ambient Anomalies; Consequences triggered by the visitor SHALL take the Stage immediately and pause ambient ones.
3. A Consequence that leaves a lasting change (a reversed clock, a fly on the UI, a changed envelope) SHALL keep that change until the ending, including across reloads.
4. WHEN the same product is added again, THE Shop SHALL not replay a lasting Consequence in full, and MAY play a short reminder.
5. IF a Featured product was carted in the Day state, THEN its Consequence SHALL play the first time the visitor adds or increments it in the Haunted state.
6. WHILE Reduced motion is on, every Consequence SHALL show its end state with a fade, keeping its meaning.

### Requirement 13: Shoes

1. THE Day shoes SHALL be pristine and unworn.
2. THE Haunted shoes SHALL be worn, torn and scorched.
3. WHEN carted in the Haunted state, small footprints SHALL appear one after another, alternating left and right foot, along a path that turns now left, now right, as if someone invisible were walking across the screen, ending at the cart icon.
4. Older footprints SHALL fade slowly; THE last pair beside the cart SHALL stay as a Lasting mark.

### Requirement 14: Pocket watch

1. THE Day watch SHALL show the correct local time.
2. THE Haunted watch SHALL be stopped. WHEN the visitor opens the product, its hands SHALL start moving forward; WHEN the visitor opens the case in the haunted inspection, time SHALL stutter backward.
3. WHEN carted in the Haunted state, THE watch hands SHALL stop, shudder once, then run backward.
4. At the same moment, THE shop clock (Requirement 1.4) SHALL start running in reverse and keep doing so until the ending.

### Requirement 15: Doll

1. THE Day doll SHALL be a clean Christmas gift.
2. THE Haunted doll SHALL be damaged and partly unstitched.
3. WHEN carted in the Haunted state, THE doll's eyes SHALL turn toward the empty spot in the group photo (Requirement 19) wherever that photo is visible on screen, and stay turned.

### Requirement 16: Letter

1. THE letter SHALL open on hover, tap or keyboard activation.
2. WHILE in the Haunted state, WHEN the letter opens, a bloodstain SHALL spread across the single word "Sorry."
3. WHEN carted in the Haunted state, THE envelope's recipient SHALL change to "The next person who opens this."

### Requirement 17: Typewriter

1. WHILE in the Haunted state, THE typewriter SHALL type a confession dated tomorrow (the visitor's local date plus one day), one letter at a time.
1a. For each letter, THE matching key SHALL press down and spring back, and the letter SHALL appear on the paper at the moment the type bar strikes; at each line end the carriage SHALL return and the paper SHALL advance a line.
2. WHEN carted in the Haunted state, THE last line of the confession SHALL change to describe the action the visitor just took, including the local time (for example "At 11:42 PM I put the typewriter in my cart.").

### Requirement 18: Mirror

1. THE Day mirror SHALL reflect a soft, warm room.
2. WHILE in the Haunted state, THE mirror SHALL show a figure standing with its back turned, and its reflection SHALL follow the pointer with a delay.
3. WHEN carted in the Haunted state, a ghostly face SHALL appear deep inside the glass, blurred, then slowly come forward until it is sharp and looking at the visitor, and keep looking.
4. After that, every reflective surface in the shop (the hero mirror, ornaments) SHALL show a faint copy of the face for a moment when the pointer passes it, as a Lasting mark.

### Requirement 19: Photo frame

1. THE Day frame SHALL show a family group in a festive pose.
2. THE Haunted frame SHALL show the same group in the same positions with the person in the middle gone, leaving an obvious gap.
2a. WHEN the visitor opens the Haunted photo, THE people on both sides of the gap SHALL lean slightly toward the empty spot, as if missing them.
3. THE same group photo SHALL hang in the hero scene, where it is the frame that tilts in the Day state (Requirement 7).
4. WHEN carted in the Haunted state, THE others in the photo SHALL shift aside to leave room for one more, in every visible copy of the photo.

### Requirement 20: Cake

1. THE Day cake SHALL be fresh, with cream and berries.
2. THE Haunted cake SHALL be collapsed and rotted, with an unmistakably nonhuman bite, and a fly that flicks its wings.
3. WHEN carted in the Haunted state, THE fly SHALL leave the product tile and settle on a part of the shop UI (for example the search field or header), staying there and moving off briefly when the pointer comes near.

### Requirement 21: Telephone

1. WHEN the visitor opens the telephone's full product view, THE handset SHALL rattle as it rings, and the price tag beside it SHALL tremble with each ring.
2. WHEN carted in the Haunted state, THE cart icon SHALL ring, with a visual ringing animation and an "Answer" control, and the price tags of nearby product cards SHALL tremble with each ring; one tag SHALL stay slightly askew as a Lasting mark.
3. WHEN the visitor answers, THE Shop SHALL show subtitles of a voice from the other side of the sale, and play the voice only if sound is on.
4. IF the visitor does not answer within 20 seconds, THEN THE cart SHALL stop ringing and ring again the next time the cart is opened.

### Requirement 22: Checkout as the final transaction

**User Story:** As a visitor, I want checkout to ask for a price I did not expect, so that finishing the purchase feels like a choice with weight.

#### Acceptance Criteria

1. WHILE in the Day state, THE checkout SHALL show a normal order summary, and its payment step SHALL say that payments are paused for the holiday rush, with the Ghost hiding on that page, so the order cannot complete before the Reveal.
2. WHILE in the Haunted state, THE checkout SHALL offer a fictional choice of payment: time, age, or a memory chosen from a preset list.
3. THE checkout SHALL not ask for or accept free text, names, emails, addresses, card numbers or any other personal data.
4. THE checkout SHALL require explicit agreement within the story: an unchecked agreement box with in-story terms and a separate Accept button, disabled until the box is checked.
5. THE checkout SHALL let the visitor decline and return to the cart at every step. The decline control SHALL use confirmshaming copy (for example "No, I'll spend Christmas alone") while still working normally.
6. THE checkout SHALL include a pre-checked "gift wrap" add-on that the visitor can uncheck, in both states.
7. WHEN the visitor accepts, THE Shop SHALL give the page one brief tremor, let the room go quiet (ambient motion and effects stop), and show "Your order has been accepted."
8. WHILE Reduced motion is on, THE tremor SHALL be replaced by a single dim.

### Requirement 23: Ending and Echo

**User Story:** As a visitor, I want the shop to return to how it started, with one thing of mine left behind, so that the ending lands without explanation.

#### Acceptance Criteria

1. WHEN "Your order has been accepted." has shown for about 4 seconds, THE Shop SHALL return to the exact Day state storefront from the opening: default view, empty cart, normal clock, no lasting Consequences.
2. THE Echo SHALL be the object left behind by the player: the Featured product they added to the cart most recently, shown in the condition the player left it in (for example the envelope addressed to "The next person who opens this").
3. WHILE the returned storefront is shown, THE Echo SHALL sit in the hero scene and THE Ghost SHALL hide behind it, as the only visible difference from the opening.
4. THE ending SHALL show no explanatory text; the visual echo carries it.
5. WHEN the ending has completed, THE footer SHALL offer a small, optional "View receipt" link (Requirement 25).

### Requirement 24: Shared Echo for the next real visitor

**User Story:** As a visitor, I want to find what the previous player left behind, so that the shop feels like it remembers.

#### Acceptance Criteria

1. WHEN a player completes the ending, THE Shop SHALL send the Echo to the Echo service as a product id and a condition id only.
2. WHEN a new visitor loads the Shop, THE Shop SHALL fetch the latest Echo left by someone else and place it in the hero scene with the Ghost hiding behind it.
3. IF the Echo service is unreachable or slow (over 1.5 seconds), THEN THE Shop SHALL fall back to an Echo stored on the device, or to no Echo, without errors visible to the visitor.
4. THE Echo service SHALL store no IP addresses, user agents, cookies or identifiers, and SHALL accept only known product and condition ids.
5. THE Echo service SHALL rate-limit writes and reject malformed input.

### Requirement 25: Receipt of dark patterns

**User Story:** As a visitor, I want to see which tricks the shop used on me, so that I can spot them in real shops.

#### Acceptance Criteria

1. WHEN the visitor opens "View receipt", THE Shop SHALL show a receipt-styled page listing each dark pattern the shop used (for example the fake countdown, false scarcity badges, pre-checked add-ons, confirmshaming on decline) with a one-line plain explanation and where it appeared.
2. THE receipt SHALL list only patterns that actually appear in the Shop.
3. THE receipt SHALL link to a reputable public reference on deceptive design.
4. THE receipt SHALL never appear before the ending and SHALL not interrupt the echo.

### Requirement 26: Accessibility

1. THE Shop SHALL make every essential interaction (browse, search, filter, inspect, cart, find and activate the Ghost, every Consequence, checkout, ending) work with a keyboard and on touch screens.
2. THE Shop SHALL show a visible focus indicator in both states and keep a logical focus order; modals and drawers SHALL trap focus and restore it on close.
3. THE Shop SHALL announce cart changes, the Reveal and the order result through an ARIA live region, without spoiling the story before the Reveal.
4. THE Shop SHALL honor Reduced motion everywhere, as specified per requirement, and provide an in-page motion toggle that overrides it in either direction.
5. THE Shop SHALL never flash more than three times in any one-second period.
6. THE Shop SHALL meet WCAG 2.2 AA contrast for text and controls in both states.

### Requirement 27: Performance

1. THE product grid SHALL scroll and animate at 60 fps on a mid-range laptop and stay above 45 fps on a mid-range phone.
2. THE Shop SHALL render all Live objects through one shared WebGL canvas (one context) with a separate view per tile, redrawing only views that are visible and changing.
3. THE initial JavaScript download SHALL be at most 250 KB gzipped, with 3D and inspection code loaded on demand.
4. THE Shop SHALL pause ambient animation while the tab is hidden.
5. IF WebGL is unavailable, THEN THE Shop SHALL fall back to 2D renderings with the same story beats.

### Requirement 28: Privacy, licensing and safety

1. THE Shop SHALL take no real payments and SHALL not collect personal data.
2. THE Shop SHALL use Live objects and code-driven effects, self-hosted OFL fonts and code-generated sound. Third-party 3D models, textures or scans MAY be used only under CC0 or a license that allows this use, and each SHALL be listed with source and license in `ASSETS.md`.
3. THE Shop SHALL load no third-party trackers or analytics.
4. THE README and the Devpost description SHALL carry a short content note (fictional war, blood, mild horror). THE Shop itself SHALL not show it before the Reveal.

### Requirement 29: Sound (last phase)

1. THE Shop SHALL be fully playable with sound off, which is the default.
2. WHEN the visitor turns sound on through a visible control, THE Shop SHALL play code-generated ambient and effect sounds (holiday chimes, thunder on the Storm flicker, the ringing phone, the voice).
3. THE sound control SHALL stay visible in both states and remember the choice on the device.

### Requirement 30: Delivery and verification

1. THE repository SHALL run locally with `docker compose up`, serving the Shop and the Echo service, with the Shop reachable at `http://localhost:8080`.
2. THE README SHALL explain what Re:Claim is, how to run it with and without Docker, how to run tests, and the content note.
3. THE project SHALL include automated tests covering: the normal shopping flow (search, category, product detail, cart), the Ghost (hiding, flying, hover flicker, keyboard and touch activation), the Reveal, every Featured product's Consequence, checkout agreement and decline, the ending and the Echo.
4. THE project SHALL include property-based tests for the shop state (for example: the cart is unchanged by the Reveal; only the Ghost can start the Reveal; the cart total always equals the sum of its lines).
5. THE Kiro write-up SHALL document only Kiro usage that actually happened.


### Requirement 31: Live objects instead of images

**User Story:** As a visitor, I want every product to be a real-looking object that lives on the page, so that its change from new to ruined happens in front of me instead of swapping pictures.

#### Acceptance Criteria

1. THE Shop SHALL render every product as a Live object: real-time 3D with physically based materials (metal, glass, leather, paper, fabric, cream), soft lighting and shadows, on a fabric backdrop.
2. THE Reveal SHALL change each Live object in place through its materials and geometry (burning, tearing, rot, dust, cracks, unstitching), not by swapping one picture for another.
3. EACH Live object SHALL idle subtly (light moving across it, a slow turn on hover) and SHALL be the surface on which its Anomalies play.
4. THE Shop SHALL generate its lighting environment in code and SHALL not depend on external CDNs at runtime.
5. IF a Live object cannot reach a convincing real-looking quality within the schedule, THEN THE Shop MAY use an image or image sequence rendered by us for that object, animated with motion and effects, and the README SHALL say which objects use this fallback.
6. IF WebGL is unavailable or the device is too slow, THEN THE Shop SHALL show still renders of the same objects with the story beats kept (Requirement 27.5).

### Requirement 32: More object anomalies

**User Story:** As a visitor, I want other objects in the shop to answer back too, so that the whole shop feels haunted and not only the nine featured items.

Each item states its trigger, its visible movement and its Lasting mark. All follow Requirement 12.3a and 12.3b (one Anomaly on Stage, quiet gaps).

#### Acceptance Criteria

1. **Snow globe (hero):** WHEN the visitor drags or shakes it, snow swirls by day; WHILE in the Haunted state ash swirls instead, and the tiny house's window lights for a moment with a figure in it. Lasting mark: a fine dusting of ash on the hero ledge and on the top edge of the cards below.
2. **Chocolate box:** WHILE in the Haunted state, WHEN the pointer leaves the box after looking at it, one more compartment is empty the next time it is seen, and its "Only N left" badge counts down. Lasting mark: the empty compartments and the badge at "Only 0 left" (false scarcity turned literal).
3. **Music box:** WHEN opened in the Haunted state, the cylinder turns and the dancer spins, then stops facing the visitor. WHEN carted, every moving thing in the shop holds still for one beat. Lasting mark: its lid stays open on its card.
4. **Wishlist heart:** WHILE in the Haunted state, WHEN the visitor taps a product's heart, the heart starts to beat. Lasting mark: the header wishlist icon keeps a slow beat that weakens over time.
5. **Glass ornament:** WHILE in the Haunted state, WHEN the pointer hovers it, its reflection shows the shop behind the visitor with the Ghost standing where the pointer was a moment ago. Lasting mark: a hairline crack across the ornament.
6. **Candle (haunted hero):** WHEN the pointer moves fast near it, the flame bends away as if someone breathed on it. Lasting mark: wax drips that build up with each disturbance.
7. **Teddy bear:** WHEN carted in the Haunted state, a seam opens and stuffing falls like snow toward the bottom of the page. Lasting mark: tufts of stuffing caught on the footer.
8. **Haunted search:** WHILE in the Haunted state, WHEN the visitor searches "home", "mom", "help" or "sorry", a product that was never in the shop appears as the only result (a child's drawing of a house). Lasting mark: it stays in the catalog until the ending.
9. **Tab away:** WHEN the tab is hidden, the title changes to "Your cart misses you" by day and "Come back…" in the Haunted state, and the favicon changes. THE receipt (Requirement 25) SHALL name this pattern.
10. **Exit intent:** WHEN the pointer moves fast toward the top of the window on desktop, the Day shop shows a gentle discount plea once per visit; WHILE in the Haunted state it shows "Don't leave us here." THE receipt SHALL name this pattern. It SHALL never block leaving.

### Requirement 33: Postcard and director mode

1. WHEN the ending completes, THE Shop SHALL offer an optional postcard image of the object the player left behind, rendered from the live scene, which the visitor can download or share. It SHALL contain no personal data.
2. WHERE the URL contains `?director`, THE Shop SHALL show a small panel for recording the demo: reset all state, speed up timers, and jump the Ghost to a chosen Hiding spot. THE panel SHALL never start the Reveal itself; only the Ghost can.
