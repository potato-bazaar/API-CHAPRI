# Chapri Racer

A browser bike-racing game built with Three.js. You ride CR100 two-strokes (RX-style bikes, rebadged) through Mumbai's underbelly: a metro station, Andheri Tunnel, an LED hairpin, the docks, a broken bridge and a salt-pan dirt road, plus lanes, flyovers, markets and Dharavi rooftops. Races have eight riders, plus street fights, jumps, monsoon rain and a comic-book look.

![Graphics: before and after](docs/graphics-before-after.jpg)

## Play

Open `dist/chapri-racer.html` in a desktop or mobile browser. It's a single self-contained file, but it needs an internet connection for the three.js CDN and the Google Fonts. Touch controls appear on phones. On a keyboard:

| Key | Action |
| --- | --- |
| W / ↑ | Throttle |
| S / ↓ | Brake |
| A D / ← → | Lean |
| Space | Drift |
| Shift | Boost |
| Q | Wheelie |
| J / L | Hit |
| K | Throw |
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
  - Nitro strips on the tarmac give anyone who threads them a kick of speed and boost. Shaving past traffic scores a PEEP PEEP! near miss.
- **Rival taunts.** On every track, rivals now and then shout Hinglish lines in speech bubbles when they pass you, when you pass them, or when you hit them.
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
  - silencers: lambi pipe, twin upswept, or dragon mouth (fire on boost);
  - Mota or racing tyres;
  - crash guard with fog lamps, café cowl, or the full bulky kit;
  - gloss, matte, metal-flake or chrome finish.
- **Music.** Original music generated live with Web Audio, in two styles you pick in Settings:
  - South mass (default): parai and thavil koothu grooves, a nadaswaram hook, brass and guitar stabs, theatre whistles and crowd "HEY!"s, plus a hero-entry theme for the winner.
  - Dhinchak DJ: dhol, tabla and a tumbi riff.
  The intensity follows the race.

![Police Express+](docs/police-express.jpg)

![Bike mods](docs/bike-mods.jpg)

### URL options

| Option | Effect |
| --- | --- |
| `?q=low\|medium\|high` | Force a quality tier |
| `?refl=0` | No road reflections |
| `?post=0` | No glow or comic pass |
| `?comic=0` | Glow without the comic look |
| `?bike=basic` | Built-in primitive bike instead of the GLB |
| `?rider=basic` | Built-in primitive rider instead of the GLB |
| `?autopilot&track=dharavi-lanes&weather=monsoon&time=night&laps=1` | Watch an AI-driven race |
| `?autopilot&mode=police&nobust` | Watch a Police Express+ run that can't end in an arrest |
| `?autopilot&entry=1` | Let an autopilot win play the winner's entry |

## Build

```bash
npm install
npm run build        # src/ + assets/*.glb  ->  dist/chapri-racer.html
```

`tools/build.mjs` concatenates `src/js/*.js` in a fixed order into one ES module and inlines `src/style.css`. It also embeds both GLB models as gzip + base64 into `src/template.html`.

### Source layout (`src/js`)

| File | What it does |
| --- | --- |
| `00_core` | Config, builds, upgrades, mods, save data, stats |
| `05_textures` | Procedural canvas textures |
| `10_tracks`, `15_track` | Track definitions; centreline, widths, elevation, hazards, shortcuts, set pieces, racing line |
| `18_batch`, `20_world`, `21_stage`, `22_underground` | Batched city geometry: roads, buildings, halls, rooftops, railway, sky, lighting, moods; stage pieces (staircase, nala, nakabandi, festive lights); the Mumbai Underground set pieces (metro, tunnel, cut, LED hairpin, docks, broken bridge, salt pans, market neon) |
| `28_bikemodel`, `30_bike`, `32_bikemods` | Bike GLB loading, paint and finishes, rig, visual mods |
| `29_ridermodel`, `31_cloth`, `40_rider` | Skinned rider and IK, shirt cloth, rider physics and AI |
| `45_race`, `46_police`, `47_underground`, `50_combat` | Race flow, scoring, coins, style-move scheduling; stage runtime (barricades, dogs, water) and Police Express+ (cops, busted meter, riflemen); Underground runtime (traffic, nitro, burst main, UDAAN slow-mo, metro rumble, tunnel echo, section cards) and rival taunts; weapons, particles, tyre spray |
| `55_speedfx`, `56_reflect`, `57_comic`, `58_entry` | Speed lines and lens rain; wet-road mirror; glow and comic post pass; the winner's entry cutscene |
| `60_audio`, `62_music` | Engine and SFX synthesis; procedural music |
| `70_hud`, `80_ui`, `85_input`, `90_main` | HUD, menus, garage, input, game loop and camera |

### Asset pipeline (`tools/model`)

- `build-model.mjs`, `rebadge.py`, `paintmask.py`: turn the source bike into the rebadged, paint-masked `assets/rx100.glb` with a rival LOD.
- `build-rider.mjs`, `paint-rider.py`: slim the base character, paint the clothes, and add the hair and flutter attributes. Output is `assets/rider.glb`.

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
- Music and sound effects are generated in the browser and are original.
