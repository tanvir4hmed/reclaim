# Re:Claim creative direction (proposal, 2026-11-15)

Status: proposed by the agent, pending Tanvir's approval. Once approved, the parts we keep move into `.kiro/specs/reclaim/requirements.md`.

## 1. The engine: the more you take, the more the shop wakes

Horror escalates because of the visitor's own actions, not a timer. Every item carted adds to a hidden **Weight**. The shop moves through acts as Weight grows. The visitor can stop at any time, which makes every next click their choice. That choice is where the guilt lives.

| Act | Entered by | What changes |
| --- | --- | --- |
| 0. Open | first load | A perfect, slightly too perfect Christmas shop. Every review 5 stars, every item "Only 1 left". Rare deniable signs. The Ghost hides. |
| 1. After hours | clicking the Ghost | Same shop, after the war. Quiet decay. Bats, dust, still air. Objects wrong but mostly still. |
| 2. Inventory | Weight ≥ 2 | The shop starts to act on its own: a second cursor follows yours, the support chat starts typing, "Recently viewed" fills with things you never viewed. |
| 3. Closing time | Weight ≥ 5 or opening checkout | Lights fail one by one, shelves empty except for what you hold, the hand crawls, the phone rings, the storage descent opens. |
| 4. Final sale | checkout accepted | Tremor, silence, "Your order has been accepted.", return to the opening shop, echo. |

## 2. Psychology we use, and how

- **The uncanny (homely made unhomely):** Christmas means home and family. The same rooms, the same faces, with one thing missing.
- **Complicity:** the shop records what *you* did (typewriter, order history, footprints to your cart). You are never told you did wrong; the objects show it.
- **Barnum-style personalization with zero data collection:** local time, weekday, device type and time zone are read on the device and never stored or sent. "It's 11:42 PM on a Tuesday. You should be asleep." The receipt later says: "We never sent this anywhere. Real shops can."
- **The statue game:** some objects move only when you are not watching (pointer idle for 20 seconds, tab hidden, item scrolled out of view). When you look back, something has shifted.
- **Silence as a weapon:** one moving thing at a time (the Stage rule). The still shop around it is what makes it frightening.
- **Dark patterns turned literal:** every manipulative shop trick becomes the haunting itself, then the receipt names it.

## 3. New products

Each one is an everyday Christmas object with a second meaning. Format: second meaning · trigger → movement → Lasting mark.

**Tier A (strongest, build with the nine featured):**

1. **Advent calendar.** 24 little doors of chocolate; after the war each door is a date. · Open doors in inspection → tiny lit rooms with people inside; door 25 opens from the inside. Cart → every door slams shut one by one, and every open quick view or drawer on the page snaps shut with them. Mark: door 25 stays ajar.
2. **Tin soldier (wind-up).** A toy that marches. · Inspection → it marches to the edge of the table and falls. Cart → a column of soldiers marches along the footer and drops off the edge one by one. Mark: one fallen soldier lies on the footer.
3. **Valve radio.** Plays carols by day. · Haunted inspection → the dial turns by itself, subtitles read a broadcast that lists names. Cart → every product title in the grid becomes a name for three seconds (a roll call), then returns. Mark: one card keeps its name.
4. **Instant camera.** Takes a holiday photo. · Haunted inspection → it flashes (a single safe flash) and the print develops over 10 seconds, showing the shop's aisles with people standing in the empty spaces. Cart → the hero picture slowly develops into the same photo. Mark: the developed print pinned to the hero.
5. **Unopened gift.** "To: Dad". · Haunted → the tag's sender is burned away. Inspection → the ribbon tightens as if the box breathes. Cart → the cart grows heavy: the cart icon sags and the drawer opens tilted. Mark: the sagging cart icon.
6. **Child's mittens (pair).** · Haunted → only one mitten is left. Cart → the other mitten appears somewhere else in the shop, hiding like the Ghost, and must be found. Mark: once found, it sits beside the cart.

**Tier B (if time allows):**

7. **House key** ("for a house that is no longer there"). Cart → the "Secure checkout" padlock badge swings open and stays broken (fake trust badges, named on the receipt).
8. **Gingerbread house.** Haunted → roof caved in, the windows still lit. Snow globe and hero window echo the same house.
9. **Christmas stockings on the hero mantel.** Names stitched on each. Cart any featured item → one stocking's name unstitches and restitches as "You".

## 4. Design that decays with you

- **The UI is a physical object.** By day it is crisp cards and lacquered buttons. After the reveal the same cards are worn paper tags and brass, and the wear sits exactly where people would press.
- **Your attention leaves scorch marks.** Places where your pointer lingered longest slowly darken like a burn on the UI. The shop shows where you looked. It is computed on the device only.
- **Light belongs to the room, not the cursor.** No flashlight cursor (2025 winner SpookBnB did that). The haunted shop is lit by its own candles, lamp and the snow globe. As Weight grows, the cart glows warmer and the room around it gets darker: what you carry is the brightest thing left.
- **Letters that drift.** The same typefaces, but in the Haunted state the kerning and baselines drift by a pixel or two over time, like handwriting from a shaking hand.
- **Too perfect by day.** The day shop is slightly over-polished: identical smiles in the reviews, every rating 5.0, every stock badge "Only 1 left". It feels nice and a little wrong.

## 5. Navigation that turns on you

The navigation keeps working. Only its meaning changes. The browser's Back button and leaving the site always work.

- **Menu:** Gifts → Belongings, Toys → Children's, Sweets → Leftovers, Letters → Unsent, Sale → Final Sale.
- **Breadcrumbs grow:** "Home › Shoes" becomes "Home › Shoes › Found near the station › Size 31 › Never claimed".
- **The storage descent:** in Act 3, "Load more" at the bottom of the grid goes down a floor instead of loading more. Each floor is darker and older, the shelves lower. The last floor holds one item: a label with the visitor's local time on it. That is where they will be kept.
- **"Recently viewed" lies:** it fills with things you never opened, as if someone else is browsing with you.
- **"Customers also bought" → "Previous owners":** small cards with first names and a single year.
- **Reviews:** "Verified buyer" becomes "Verified owner"; the reviews turn into short testimonies. The newest review is dated tomorrow and describes what you are about to do.
- **Social proof:** "14 people are viewing this" becomes "1 person is standing behind you".
- **Sneak into basket:** in Act 2 an item you did not add appears in your cart. Removing it asks "Leave her here?" and only then lets you remove it.
- **Account:** "Signed in as Guest" becomes "You have always been signed in". Order history lists orders placed on future dates.
- **Support chat:** "Holly is typing…" that never finishes, then a message from aisle 3. Preset quick replies only, no free text.
- **Hidden text:** selecting product text in the Haunted state reveals words written in the empty space between lines (the owner's name, a last message).

## 6. Intensity ceiling

We escalate dread, not gore. Blood stays at stains and prints, with no wounds or bodies. The war stays fictional with no real places, flags or events. We never hijack the clipboard or the Back button, never block leaving, and never flash more than three times a second. A Devpost judge, an AWS reviewer and a 15-year-old visitor should all leave disturbed, and none should feel abused.

## 7. Scope honesty

Tier A of the new products plus the nine featured gives fifteen special objects. With live 3D objects that is the upper limit for 19 days. Build order: shop → Ghost → reveal → featured nine → acts and navigation → Tier A → Tier B → sound.
