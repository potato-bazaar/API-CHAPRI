# Chapri Racer

A browser bike-racing game built with Three.js. You ride CR100 two-strokes (RX-style bikes, rebadged) through Mumbai lanes, flyovers, markets and Dharavi rooftops. Races have eight riders, plus street fights, jumps, monsoon rain and a comic-book look.

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

- **Police Express+.** A solo escape mode on its own night stage, **Bhaag Chapri Bhaag**.
  - Finish 2 laps before the BUSTED meter fills. Police bikes with sirens and lathis chase you.
  - Nakabandi checkpoints have full-width barricades. You can jump the big yellow ramps or smash through.
  - Riflemen telegraph each shot with a red laser, so you can swerve to dodge.
  - The stage also has a long staircase to ride up and down, a flooded nala, and stray dogs that dash across.
- **Five tracks.** Mumbai Central, Crawford Market, Dharavi Lanes, Bandstand Rush and Sion Flyover. Hazards include potholes, kichad (mud), triple speed-breakers and kachha shortcut lanes.
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
- **Riders.** Skinned riders with IK posing and a verlet-cloth open shirt over a baniyan. Hair moves in the wind.
- **Boost.** A "⚡ BOOST!" banner, an electric-blue speedometer with a BOOST bar, blue exhaust jets, neon speed lines and radial blur.
- **Garage.** Builds, performance upgrades, 18 paints, and visual mods:
  - silencers: lambi pipe, twin upswept, or dragon mouth (fire on boost);
  - Mota or racing tyres;
  - crash guard with fog lamps, café cowl, or the full bulky kit;
  - gloss, matte, metal-flake or chrome finish.
- **Music.** Original procedural chapri music (Web Audio), with the beat level following the race.

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
| `18_batch`, `20_world`, `21_stage` | Batched city geometry: roads, buildings, halls, rooftops, railway, sky, lighting, moods; stage pieces (staircase, nala, nakabandi, festive lights) |
| `28_bikemodel`, `30_bike`, `32_bikemods` | Bike GLB loading, paint and finishes, rig, visual mods |
| `29_ridermodel`, `31_cloth`, `40_rider` | Skinned rider and IK, shirt cloth, rider physics and AI |
| `45_race`, `46_police`, `50_combat` | Race flow, scoring, coins; stage runtime (barricades, dogs, water) and Police Express+ (cops, busted meter, riflemen); weapons, particles |
| `55_speedfx`, `56_reflect`, `57_comic` | Speed lines and lens rain; wet-road mirror; glow and comic post pass |
| `60_audio`, `62_music` | Engine and SFX synthesis; procedural music |
| `70_hud`, `80_ui`, `85_input`, `90_main` | HUD, menus, garage, input, game loop and camera |

### Asset pipeline (`tools/model`)

- `build-model.mjs`, `rebadge.py`, `paintmask.py`: turn the source bike into the rebadged, paint-masked `assets/rx100.glb` with a rival LOD.
- `build-rider.mjs`, `paint-rider.py`: slim the base character, paint the clothes, and add the hair and flutter attributes. Output is `assets/rider.glb`.

### Headless tests (`tools/t*.mjs`)

These use Playwright Chromium. Run `npx playwright install chromium` once, then run them from the repo root after `npm run build`. Screenshots land in `tools/` and are git-ignored.

```bash
node tools/t17.mjs mumbai-central 1                          # fast-forward a full race, report errors and crashes
node tools/t31.mjs dharavi-lanes 2                           # jumps, rooftop falls, coins and crash spots
node tools/t32.mjs look sion-flyover golden monsoon 10       # in-race screenshot
node tools/t33.mjs                                           # garage close-ups of mod combinations
node tools/t36.mjs                                           # fast-forward a Police Express+ run: escaped or busted
node tools/t37.mjs                                           # Police Express+ screenshots: checkpoint, stairs, water, boost
```

## Credits and licences

- Bike: "RX100 BIKE" by patilaryush on Sketchfab, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). It's rebadged as CR100 / CHAPRI with no Yamaha badging; the centre stand is folded and the texture repainted.
- Riders and hair: Quaternius "Universal Base Characters", CC0.
- [three.js](https://threejs.org) r160, MIT.
- Fonts: Baloo 2 and Teko, SIL Open Font License.
- Music and sound effects are generated in the browser and are original.
