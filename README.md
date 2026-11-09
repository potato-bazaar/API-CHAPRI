# Chapri Racer

A browser bike-racing game built with Three.js. You ride CR100 two-strokes (RX-style bikes, rebadged) through Mumbai's underbelly: a metro station, Andheri Tunnel, an LED hairpin, the docks, a broken bridge and a salt-pan dirt road, plus lanes, flyovers, markets and Dharavi rooftops. Races have eight riders, plus street fights, jumps, monsoon rain and a comic-book look.

![Graphics: before and after](docs/graphics-before-after.jpg)

## Play

Open `dist/chapri-racer.html` in a desktop or mobile browser. It's a single self-contained file, but it needs an internet connection for the three.js CDN and the Google Fonts. Touch controls appear on phones, and the game plays upright (9:16) as well as sideways: in portrait the HUD restacks, the controls sit in the thumb zone and the camera rides higher and further back. A loading screen with a progress bar and tips shows while the game boots and again while each race builds. On a keyboard:

| Key | Action |
| --- | --- |
| W / ↑ | Throttle |
| S / ↓ | Brake |
| A D / ← → | Lean |
| Space | Drift |
| Shift | Boost |
| Q | Hop (tap) / wheelie (hold) |
| J / L | Hit |
| K | Throw / spit / shoot |
| C | Camera |
| P / Esc | Pause |

## What's in it

- **Mumbai Underground (the main map).** A 2.1 km night run under a storm sky, two laps by default. Each section gets a title card the first time you reach it.
  - **Andheri Metro:** the grid starts under a metro station that straddles the road. A trial-run train shuttles out along the viaduct to a launching gantry and rumbles overhead.
  - **Andheri Tunnel:** sodium light strips that sweep over the bike, jet fans, lane signals, an engine echo, honking traffic you weave through, and a burst water main you ride through (CHHAPAAK!, water on the lens).
  - **Subway Cut and LED Hairpin:** graffiti retaining walls, two overbridges, then a hairpin lined with a scrolling pink and cyan chevron wall.
  - **Dock 7:** container stacks, ship-to-shore cranes with moving trolleys, floodlight towers, black water and a berthed ship.
  - **Adhoora Pul:** the unfinished metro bridge. Hit the tin lip and jump the gap in slow motion (UDAAN!) under a tower crane, or fall in.
  - **Namak Khet:** a salt-pan kachha road with dust, fences, pylons, floodlight poles, ground fog and a broken-down HORN OK PLEASE truck.
  - **Lokhandwala:** market neon and chasing festoon bulbs back to the finish.
  - Shaving past traffic scores a PEEP PEEP! near miss.
- **Rival taunts.** On every track, rivals now and then shout Hinglish lines in speech bubbles when they pass you, when you pass them, or when you hit them.
- **Controls.** Steering answers at once: the bike starts sliding toward the side you press while the heading catches up. On touch, the two arrows act as one pad, so you can slide your thumb across. Tap weight-back (Q) to hop over slicks, glass and potholes; hold it for a wheelie in any gear. A wheelie is also a speed trick (more pull, a higher top speed, less steering).
- **Fights.**
  - Hits freeze for a few frames on contact (hit-stop), with a lens punch, a swing arc of light, impact flashes and sparks.
  - New weapons: the saria (iron rod, heavy hits, metal sparks) and the katta (a country pistol with 4 shots that bursts tyres; at speed a blowout throws the rider down the road).
  - Gutka now also leaves a red slick on the road behind you. Whoever rides through it slides.
  - Takedowns: a crashed bike tumbles and bounces with sparks while the rider rolls down the road on his own. When you cause it (or go down yourself), the camera cuts to a slow-motion takedown shot, then back to the race.
- **Traffic hits, Road Rash style.** Hitting a car or a roadside obstacle costs speed and can throw you off. How bad it is depends on three things: how much faster you were going than the thing you hit, how square you hit it, and how heavy it is (bus > tempo > taxi > auto; carts and drums are lighter).
  - **Clip:** a glancing touch makes the bike stagger and lose about 15–20% speed.
  - **Skid:** a half-on or square hit shoves the bike sideways and yaws it, with tyre smoke, sparks, a scrape and a squeal. The bike drags speed for up to a second (about 25–35% lost) and steering is weaker until it gathers itself. GAADI SE THOKA! SKID!
  - **Fall:** you only go down when it's really your fault. A square hit about 54 km/h faster than the car is roughly a coin flip, and about 72 km/h faster always throws you. Clipping slower traffic only staggers you, but clipping a parked or stopped vehicle at full speed can still put you down (about 1 time in 3).
  - Rivals obey the same rules at a little over half the severity, so they crash into traffic now and then but don't wipe out every lap. Easy softens hits (0.7×), Hard sharpens them (1.15×).
- **A real race.** Rivals no longer ride stock bikes while you upgrade:
  - each rival rides a bike matched to yours (top speed 95–101% of yours, near-equal grip, brakes and lean), so upgrading alone won't win you races;
  - rivals more than 25 m behind you push harder (up to +7% on Normal, +11% on Hard; none on Easy) and ease off a little if they get far ahead;
  - Hard rivals barely make mistakes; Easy rivals make plenty.
- **Toofan Bhai, the super racer.** On Normal and Hard the eighth rider is Toofan Bhai: a maxed bike (145 km/h top end, full acceleration, grip and brakes) in a gold tank and chrome finish, the black Raat cape, racing tyres, the full kit and an expansion chamber. He never makes mistakes, uses boost on every straight and hunts you down if he falls behind. On Normal he's held to about 3% above your top speed, on Hard 8%, so a clean race can still beat him. The grid calls him out at the start ("TOOFAN BHAI IS ON THE GRID") and passing him gets "TOOFAN KO PEECHE CHHODA!". Beating him to the line pays **+400 coins**. On Easy his slot goes to Tinu, a clean rider who never fights, on a bike matched to yours like the others.
- **Sting boost.** Boost comes from glowing Sting cans on the road; the rider chugs one and tosses it. Boosting floods the screen neon cyan and pink, tints the sky light violet, throws electric sparks and arcs off the silencer and leaves light trails.
- **Nitro gates.** Every track has nitro strips under a neon gate with a tall light beacon, so you can line up from far away.
- **Direction guide.** A chevron ribbon on the road follows the racing line: green to go, amber to lift, red to brake. A card at the top shows the next sharp corner or hairpin and the distance and side of the next nitro. It can be turned off in Settings.
- **Traffic.** Autos, kaali-peeli taxis, BEST buses and tempos on every track except Dharavi's lanes. Set Off, Light or Jam in Settings.
- **Street life.** Pani puri and bhel carts, vada pav and chai tapris, ganne-ka-ras crushers, roadside shrines, BEST bus stops, plants and white-and-red painted tree trunks, each stall lit by its own bulb. There are no people.
- **Roads (learned from Auto Rush).** Roads are about 30% wider than their key widths (Dharavi's gali stays tighter), with a lane line on every lane, darker fine-grain asphalt with wheel paths, oil drips and patch repairs, and puddles. Monsoon roads are soaked and rippled; night roads are damp, so the puddles pick up the neon; day roads are dry. A grass verge with trees and bushes (a paved forecourt at the market) keeps the buildings back from the road.
- **Boost ring and speed tag.** A segmented ring on the road around your bike is your boost meter: it fills from the back on both sides and pulses when full; while you boost it steps aside for the electricity. Boosting is speed-force electricity, like the Flash running: neon cyan and pink lightning crackles over the rider and bike and streams out behind along the path you rode, zig-zagging and re-striking every few frames and spitting sparks; the BOOST! banner shows the charge draining. Your position and speed float next to your rider.
- **Rain.** Denser, longer streaks, splash crowns landing on the road around you, and a lavender-grey overcast sky.
- **Times of day.** Morning has a hard white sun, a blue sky, crisp shadows and street lamps off; golden hour has a low orange sun and a warm grade; night has the violet neon grade. The Underground keeps its storm sky and lightning for night and monsoon only.
- **Chapri wardrobe (Store).** Tabs for Tops, Chaddi, Jeans, Body, Hair, Helmet, Shades and Cape; tap an item to try it on (the camera turns to show it: the back for the waistband and capes, the face for shades), buy it with coins.
  - Tops: the shirts, plus jackets (denim, olive bomber, neon windcheater, leopard print), a baniyan in white, black or pink, or no shirt at all.
  - Chaddi: the waistband showing above the jeans, with the brand printed on it (`UW_BRAND` in `src/js/00_core.js`), leopard, a pink pantie band with bows, or lace. With a shirt on, the back of the shirt is cropped so the band shows.
  - Jeans: blue, black, acid wash, white, red, olive cargo. Body: slim, fit, muscular, gym bhai (arms, chest, back, traps and thighs grow; a bare torso gets pecs and abs).
  - Capes: long capes (about 1.55 m) in our own designs, not superhero logos:
    - **Raat:** black, scalloped hem, pink lining, glowing edges.
    - **Hero:** red, gold trim, Chapri crown crest.
    - **Neon:** purple, scalloped hem, cyan glowing edges.
    - **Raja:** gold brocade, maroon lining, crown crest.

    Each cape is a verlet cloth pinned across the shoulder blades. At speed it streams straight back (about 13° below horizontal at 95 km/h) with a flapping wave that runs down to the hem. Stopped, it drapes over the seat and tail, and it billows in a breeze on the menu.
  - Rivals wear the wardrobe too: baniyans, a bare-chested gym bhai, waistbands on show.
- **Dogesh, the Diwali rider.** A second rider model, picked on the Store's **Rider** tab (free, saved with your look). Built from the Character Creator model `Suhamodel.obj`.
  - **His look:**
    - long hair swept back to the shoulders, which streams in the wind;
    - his own beard, black wayfarers and gold hoop earrings;
    - a saffron silk kurta with gold butis, an embroidered neckline, buttons and a zari hem;
    - a white churidar ruched at the ankles, and white sneakers with gold;
    - an **emerald brocade long jacket** (gold lattice, red-and-gold butas, gold zari on the cuffs, the Nehru collar and every edge).
  - **The jacket's skirt is cloth.** It hangs to the knees and is pinned at the yoke and down the side seams to the waist. It drapes over the seat and thighs when parked, streams back over the seat like a flag at speed, and hangs open when he walks.
  - **Same skeleton as the classic chapri**, so every riding pose, gesture, crash and the winner's entry work as they are. Helmet and cape still apply. His wayfarers replace the shades, and the gold chain and watch stay on. The Tops, Chaddi, Jeans, Body, Hair and Shades tabs say they only dress the classic chapri.
  - **Fix found on the way:** since the smoothness pass, racing rigs had been welding the open shirt's cloth panels into one static mesh before they moved, so the shirt vanished in races. Shirt and jacket panels are now left out of the weld (and kept in the road mirror).
- **Ink outlines and contact shadows.** Every rider and bike near the camera gets a clean black ink outline (a back-face shell pushed out along the normals, sized by distance so it stays about 3 px thick, and skinned so it bends with the rider). Every bike has a soft contact shadow on the road, day or night, that shrinks when it's airborne. Phones render at up to 2× pixel density (the governor steps down to 60% if frames run long).
- **Look.** A colour grade that lifts night shadows into violet and pushes saturation, brighter night lighting and more street lamps, neon rim lights and an underglow on your bike, and thick two-stroke smoke with backfire flames.
- **Police Express+.** A solo escape mode on its own night stage, **Bhaag Chapri Bhaag**.
  - Finish 2 laps before the BUSTED meter fills. Police bikes with sirens and lathis chase you.
  - Nakabandi checkpoints have full-width barricades. You can jump the big yellow ramps or smash through.
  - Riflemen telegraph each shot with a red laser, so you can swerve to dodge.
  - The stage also has a long staircase to ride up and down, a flooded nala, and stray dogs that dash across.
- **Five more tracks.** Mumbai Central, Crawford Market, Dharavi Lanes, Bandstand Rush and Sion Flyover. Hazards include potholes, kichad (mud), triple speed-breakers and kachha shortcut lanes. The Championship runs all six.
- **Set pieces:**
  - plank ramps over autos and carts, with coin arcs;
  - ride-through market and parking halls;
  - a Dharavi rooftop run with gaps to jump;
  - a local train crossing under the Sion flyover.
- **Monsoon rain.** Turn it on with the home-screen button or in Race Setup. The road becomes a rippled mirror, grip drops and bikes slide.
- **Graphics:**
  - planar wet-road reflections and glow on lamps and neon (Medium and High quality);
  - the comic-book post effect: ink outlines, halftone and pop-up sound words;
  - time-of-day moods.
- **Ride feel.**
  - Road-relative steering assist: left/right sets where the bike points off the road, and it follows the curve when you let go. It can be turned off in Settings.
  - Walls are glancing hits with sparks, bikes lean on each other instead of sticking, and breakers become small hops at speed.
  - A spring-rigged chase camera that swings into turns, slides on lane changes and dips on landings and gear shifts.
  - Motion-blurred wheels, monsoon tyre spray, wind-blown drops on the lens, and tyre scrub / squeal / wet-hiss sounds.
- **Rider swagger.** On calm straights the rider smokes, combs his pompadour, twirls his moustache, dips his shades, scratches his head or throws a two-finger salute. He looks back after overtakes, and shakes a fist at whoever hits him. The Rider smokes switch in Settings turns smoking off.
- **Winner's entry.** Win a race (or escape the police) and the bike power-slides to the kerb in slow motion. The rider kills the engine, swings off, lights up behind a cupped hand and walks at the camera while FIRST! slams in. Tap to skip.
- **Riders.** Skinned riders with IK posing and a verlet-cloth open shirt over a baniyan. The default rider has an athletic build, a sculpted brown pompadour, gold aviators, stubble, gold chains and a watch, and a tropical hibiscus shirt. Hair moves in the wind. The home screen uses studio rim lights, and the profile picture is a live portrait of your rider.
- **Boost.** A "⚡ BOOST!" banner, an electric-blue speedometer with a BOOST bar, blue exhaust jets, neon speed lines and radial blur.
- **Garage.** Builds, performance upgrades, 18 paints, and visual mods:
  - silencers: free flow (welded cut pipe), lambi pipe, twin upswept, expansion chamber (heat-blued belly), or dragon mouth (fire on boost). Each one sounds different (see **Engine sound**). In the garage, tapping a silencer plays a rev demo with the camera on the pipe, even before you buy it, and the bike wears it while the buy prompt is open. **▶ Rev** replays the fitted one;
  - Mota or racing tyres;
  - crash guard with fog lamps, café cowl, or the full bulky kit;
  - gloss, matte, metal-flake or chrome finish.
- **Music.** Three styles, picked in Settings:
  - Chapri OST (default): the game's own songs. "Chapri" plays on the menu and results, "Bike Chase" (Telugu) in races and "Siren Motif" in Police Express+. Each song loops with a crossfade. The race song starts muffled for the countdown and opens up on GO; boost and the final lap add bass. Boost kicks, takedowns and the final-lap riser land on top as sub-bass booms, whistles and a "HEY!", with the song dipping for a beat so they punch through.
  - South mass: live-synth parai and thavil koothu grooves, a nadaswaram hook, brass and guitar stabs, theatre whistles and crowd "HEY!"s.
  - Dhinchak DJ: live-synth dhol, tabla and a tumbi riff.
  The winner's hero-entry theme is always live synth.
- **First-race coach.** A new player's first race shows one prompt at a time, and the matching touch button pulses. Keyboard players see the key instead. The prompts:
  - gas on the green light;
  - lean;
  - brake before a real corner;
  - keep the needle in the powerband;
  - boost (the coach tops up the kick meter);
  - MAAR once fights switch on.

  Each step ticks off when the player does it, or moves on after a few seconds. It's skippable, runs once per save, and **Help → Coach me in my next race** brings it back. Saves that already have races skip it. `?coach` forces it for testing.
- **Share your race.** **Share** on the results screen makes a 1080×1920 card: a close hero shot of your rider, position, track, time, best lap, top speed, coins and overtakes. It opens the phone's share sheet (WhatsApp, Instagram…) where the browser supports sharing files, and always offers **Save image**.
- **Engine sound.** The two-stroke is played as a train of exhaust pulses, one per revolution (about 25 a second at idle, about 150 at the limiter), not a steady tone.
  - Each pulse is a short burst made in code, with no audio files: a sharp blow-down click, a short body thump, formants from about 450 Hz to 2.5 kHz, a metallic ring around 3.5–4.5 kHz (thin pipe and cylinder fins), and a raspy gas hiss.
  - The aim is the RX100 riders describe: 98 cc, 11 hp at 7,500 rpm, a note "similar to that of a dirt bike", "ktrrrr trrrr", a "Grand Prix sound". It should be crisp and loud, not a muffled hum. Stock sits at about 2.9 kHz average brightness at full throttle.
  - Idle is the RX "heartbeat": lub, dub, breathe, breathe. A strong firing, a softer one hard on its heels, then two skipped cycles, about seven beats a second.
  - The silencer sets those resonances, its loudness and its saturation:
    - **Stock:** muffled crisp beat.
    - **Free Flow:** hard, loud and crackly.
    - **Lambi Pipe:** deep bass.
    - **Twin Upswept:** loudest, with the beat alternating left and right.
    - **Expansion Chamber:** quieter low down, then a motocross scream from 5,400 rpm.
    - **Dragon Mouth:** raspy, with pops.
  - At light throttle the engine 4-strokes (every other firing goes weak), which gives the RX "ring-ding-ding".
  - Snapping the throttle shut at high revs makes the louder pipes crackle and pop.
  - The nearest rival is heard through their own silencer, with Doppler shift.
  - **Takeover hit:** this is the stab-and-pull from the first seconds of the reference ride (`chapri-throttle-takeover.mp3`): the throttle snapped open at about 5,000 rpm and the revs flare up through a shift.
    - It's rendered once per silencer from the same engine code and plays at the green light, when you rev on the start line, and whenever you reopen the throttle after a lift.
    - The live engine dips under it and slides back in as it ends. Lifting off cuts it.
    - So every throttle stab sounds like that clip, even in top gear where your speed holds the revs nearly still.
  - **Throttle takeover:** the engine is the loudest thing in the mix.
    - At full throttle it sits about 15 dB over the song.
    - Each stab of the throttle punches in harder and brighter for a moment.
    - The song dips about 7 dB while you're on the gas (and when you rev on the start line, or during the garage rev demo), then comes back when you lift.
    - The engine bus cuts the sub-rumble that phone speakers can't play and lifts the 2–3 kHz bite they can.
    - A limiter after the compressor keeps the louder mix from clipping.
- **Smoothness.** A race frame on a phone-sized screen costs about 30% less than before the November audit:
  - the wet-road mirror only draws layer 1 (the world, all lights, and bike/rider parts bigger than about 20 cm), not ink outlines, particles, glows or tiny parts;
  - each racing rig welds its fixed parts that share a material into one mesh;
  - rival outlines skip parts under 9 cm;
  - the HUD only writes to the page when a value changes;
  - 120/144 Hz screens draw every other refresh (60–72 fps), so phones don't heat up and throttle. `?nocap` turns this off.
  - **Sharpness on phones.** The quality governor sheds cost before sharpness, in steps:
    1. Slightly softer.
    2. Road mirror off.
    3. Softer again.
    4. The floor.

    It never renders below 1.35 device pixels per screen point. It used to go as low as 0.75× on Low, which looked blocky and grainy. Low renders at 1.5×. Medium's mirror runs at 42% resolution. On phone-sized screens the comic print texture (halftone dots, Ben-Day sparkle, posterising) is kept to a third of its strength, so it doesn't read as grain. The auto-quality benchmark runs again once for saves judged by older, slower builds.

![Police Express+](docs/police-express.jpg)

![Bike mods](docs/bike-mods.jpg)

### URL options

| Option | Effect |
| --- | --- |
| `?q=low\|medium\|high` | Force a quality tier |
| `?refl=0` | No road reflections |
| `?post=0` | No glow or comic pass |
| `?comic=0` | Glow without the comic look |
| `?nocap` | No 60 fps cap on 120/144 Hz screens |
| `?coach` | Show the first-race coach even on a save that has raced |
| `?bike=basic` | Built-in primitive bike instead of the GLB |
| `?rider=basic` | Built-in primitive rider instead of the GLB |
| `?model=dogesh` | Ride as Dogesh whatever the save says |
| `?autopilot&track=dharavi-lanes&weather=monsoon&time=night&laps=1` | Watch an AI-driven race |
| `?autopilot&mode=police&nobust` | Watch a Police Express+ run that can't end in an arrest |
| `?autopilot&entry=1` | Let an autopilot win play the winner's entry |

## Build

```bash
npm install
npm run build        # src/ + assets/  ->  dist/chapri-racer.html (one file, songs inside) and dist/web/ (index.html + music/*.mp3, streams the songs)
```

`tools/build.mjs` concatenates `src/js/*.js` in a fixed order into one ES module and inlines `src/style.css`. It also embeds both GLB models as gzip + base64 into `src/template.html`.

### Source layout (`src/js`)

| File | What it does |
| --- | --- |
| `00_core` | Config, builds, upgrades, mods, save data, stats |
| `05_textures` | Procedural canvas textures |
| `10_tracks`, `15_track` | Track definitions; centreline, widths, elevation, hazards, shortcuts, set pieces, racing line |
| `18_batch`, `20_world`, `21_stage`, `22_underground`, `23_street` | Batched city geometry: roads, buildings, halls, rooftops, railway, sky, lighting, moods; stage pieces (staircase, nala, nakabandi, festive lights); the Mumbai Underground set pieces (metro, tunnel, cut, LED hairpin, docks, broken bridge, salt pans, market neon); stalls, shrines, bus stops and nitro gates on every track |
| `28_bikemodel`, `30_bike`, `32_bikemods` | Bike GLB loading, paint and finishes, rig, visual mods |
| `29_ridermodel`, `31_cloth`, `40_rider` | Skinned rider and IK, shirt cloth, rider physics and AI |
| `45_race`, `46_police`, `47_underground`, `48_street`, `50_combat` | Race flow, scoring, coins, style-move scheduling; stage runtime (barricades, dogs, water) and Police Express+ (cops, busted meter, riflemen); Underground runtime (burst main, UDAAN slow-mo, metro rumble, tunnel echo, section cards) and rival taunts; traffic, nitro, the direction guide and the boost look on every track; weapons, gutka slicks, the katta, wrecks, particles, tyre spray |
| `55_speedfx`, `56_reflect`, `57_comic`, `58_entry` | Speed lines and lens rain; wet-road mirror; glow and comic post pass; the winner's entry cutscene |
| `60_audio`, `62_music` | Engine and SFX synthesis; procedural music |
| `70_hud`, `80_ui`, `85_input`, `90_main` | HUD, menus, garage, input, game loop and camera |

### Asset pipeline (`tools/model`)

- `build-model.mjs`, `rebadge.py`, `paintmask.py`: turn the source bike into the rebadged, paint-masked `assets/rx100.glb` with a rival LOD.
- `build-rider.mjs`, `paint-rider.py`: slim the base character, paint the clothes, and add the hair and flutter attributes. Output is `assets/rider.glb`.
- `build-dogesh.mjs` (with `objload.mjs`) turns `assets/dogesh_src/Suhamodel.obj.gz` into `assets/dogesh.glb`, about 574 KB, meshopt-compressed (the game sets three's `MeshoptDecoder` for it). The steps:
  1. Warp the model onto the rider skeleton's T-pose: per-joint offsets, blended along the bones.
  2. Copy skin weights from the rider body by nearest surface, matched by side, then smooth them.
  3. Bake one 1024² atlas (skin, face, eyes, kurta, churidar, shoes) from 3D positions.
  4. Generate the jacket sleeves, yoke and Nehru collar, and the long-hair ribbons.

  The export had no body under the clothes, so the outfit is built from its T-shirt, jeans and sneakers.

### Headless tests (`tools/t*.mjs`)

These use Playwright Chromium. Run `npx playwright install chromium` once, then run them from the repo root after `npm run build`. Screenshots land in `tools/` and are git-ignored.

```bash
node tools/t17.mjs mumbai-underground 2                      # fast-forward a full race, report errors and crashes
node tools/t31.mjs dharavi-lanes 2                           # jumps, rooftop falls, coins and crash spots
node tools/t32.mjs look sion-flyover golden monsoon 10       # in-race screenshot
node tools/t33.mjs                                           # garage close-ups of mod combinations
node tools/t36.mjs                                           # fast-forward a Police Express+ run: escaped or busted
node tools/t37.mjs                                           # Police Express+ screenshots: checkpoint, stairs, water, boost
node tools/t40.mjs                                           # feel audit: keyboard steering vs AI, contacts, wobble, camera jerk
```

## Credits and licences

- Bike: "RX100 BIKE" by patilaryush on Sketchfab, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It's rebadged as CR100 / CHAPRI with no Yamaha badging; the centre stand is folded and the texture repainted.
- Riders and hair: Quaternius "Universal Base Characters", CC0.
- [three.js](https://threejs.org) r160, MIT.
- Fonts: Baloo 2 and Teko, SIL Open Font License.
- Songs ("Chapri", "Bike Chase", "Siren Motif"): made by Greg D'Souza for the game, in `assets/music/` (loudness-normalised to -16 LUFS).
- The live-synth music and all sound effects are generated in the browser and are original.
