# Chapri Racer: menu revamp brief

The prompt this revamp was built from. Written before any code changed.

## Role
Act as the lead UI/UX designer and front-end engineer on a shipped mobile racing game. Rebuild everything the player
touches before a race starts: home, mode and map selection, race options, garage, rider and style shop, settings.
The game is a single-page Three.js app; the menus are HTML and CSS over a live 3D scene. Do not touch race gameplay.

## What is wrong today (audit)
1. The home screen carries 14 controls in six visual styles: a start button, a career button, a flying button, three
   small buttons, three city tabs (two of them "coming soon"), a rain toggle, a bike card, a daily panel and a 7-item nav.
   Nothing says which one to press first.
2. Choosing what to play is split over four places: modes and maps in a "Race Setup" pop-up, Police on the home screen,
   Flying behind its own button, Championship in the nav.
3. Maps are thumbnails 6 rem wide with a name. A player cannot tell a 2 km city loop from a 5 km mountain descent, or
   that one has a police van and another has yaks.
4. Garage and store are separate full screens reached by different routes, each with its own "Back".
5. Rider (character) choice is one tab among nine in the store.

## Reference patterns (what good racing menus do)
- Asphalt 8's 2024 rework: declutter the hub so the vehicle is the hero; one "Play" hub for all racing activity;
  shared interaction patterns on every screen; keep habits players already have.
- Forza Horizon / Mario Kart / Gran Turismo: persistent tabs, large map cards, a live or animated look at the course
  before committing, options next to the start button, never more than one primary action per screen.

## Principles
1. **One primary action per screen.** The biggest, brightest thing is what most players want next.
2. **Three taps to race from a cold start:** Play → pick map → Start. One tap if you want the same again.
3. **Show, don't list.** The selected map plays as a live fly-through behind the menu. Facts are icons and chips.
4. **One navigation model.** A dock with five places, on every menu screen. No "Back" buttons between them.
5. **The bike and rider stay on screen.** Panels sit at the edges; the middle belongs to the 3D scene.
6. **Thumb first.** Works one-handed in portrait and landscape; primary actions in the lower half; targets ≥ 44 px.
7. **Nothing lost.** Every existing feature keeps a home: all modes, all options, daily challenges, records, help.

## Information architecture
Dock (always visible in menus): **Home · Garage · PLAY · Style · Ranks**. Settings, help and the daily bonus live in the top bar.

- **Home**: the bike. "Next race" card (map thumbnail, mode, one line of settings) with START and CHANGE.
  Four featured tiles: Safar career, Flying Mode, Himalaya Downhill, Police Express+. Bike card (switch build, level,
  upgrade). Daily challenges.
- **Play**: the whole selection flow on one screen.
  - Mode rail: Quick Race, Gali Rumble, Elimination, Time Trial, Stunt Run, Police Express+, Flying Mode, then Safar and
    Championship (which open their own boards).
  - Map carousel: large cards, swipe or arrow keys; the 3D world behind changes to the map and the camera flies its route.
  - Map sheet: name, what the route is, "what's inside" chips (jumps, tunnel, police van, animals, off-road, lake…),
    length, type, your best lap and finish.
  - Options: laps, rivals, time of day, weather, combat. Options a mode fixes are shown locked, not hidden.
  - START, labelled for the mode.
- **Garage**: unchanged in function; joins the dock.
- **Style**: the wardrobe, opening on the Rider tab so character choice comes first; joins the dock.

## Visual language
Keep the brand: plum night, pink neon, marigold. Change how it is used:
- Marigold is reserved for the primary action and the current selection. Pink is for brand accents, not every border.
- Panels are dark glass with a 1 px light edge instead of a 2 px neon glow, so the neon that remains means something.
- Racing geometry: slanted (−10°) ends on tabs, chips and the start button; Teko italic for headings and numbers.
- Motion with a job: screens slide in, the selected card lifts, the start button has a slow sheen. Respect
  `prefers-reduced-motion`.

## Acceptance
- From a cold start a new player reaches a race in three taps, and the same race again in one.
- Every map shows its fly-through and at least three "what's inside" facts.
- Portrait 390×844 and landscape 844×390: no overlap, no clipped control, no horizontal page scroll.
- All previous features reachable; no console errors; existing saves load.
