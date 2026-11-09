// ───────────────────────── TRACK DEFINITIONS ─────────────────────────
// Each track: authored centre-line control points (x,z metres before scaling),
// a cyclic width profile, optional elevation keys and bumps. The spline is the
// single source of truth for road extrusion, AI lines, checkpoints and minimap.
const TRACKS = [
  {
    // the main map: one night run through every kind of Mumbai underworld. Sections are fractions of the lap.
    id: 'mumbai-underground', name: 'Mumbai Underground', short: 'Underground', main: true,
    theme: 'city', target: 2100, lapTarget: '95–110 s', time: 'night', laps: 2,
    blurb: 'Under the metro, through Andheri Tunnel, down the underpass, across the docks, over the broken bridge and out on the salt-pan kachha road.',
    pts: [[0,0],[150,0],[260,10],[380,50],[470,120],[520,210],[540,300],[548,380],[545,440],[515,468],[480,455],[465,410],[455,350],[440,290],[395,240],[310,222],[40,232],[-30,250],[-100,300],[-180,290],[-230,230],[-220,150],[-160,100],[-100,70],[-78,34],[-42,6]],
    widths: [[0,13],[0.07,13],[0.09,11],[0.29,11],[0.31,12],[0.355,12],[0.375,14],[0.425,14],[0.445,12],[0.56,12],[0.575,11],[0.68,11],[0.7,10],[0.89,10],[0.915,10.5],[0.975,12.5]],
    triples: [], shortcuts: 0, kickers: 0, potholes: 5, bigPotholes: 3, mud: 3,
    bumps: [{ f: 0.955, h: 0.2, len: 2.5, type: 'breaker' }],
    underground: { metro: [0.985, 0.078], tunnel: [0.087, 0.294], cut: [0.3, 0.432], chevron: [0.362, 0.43], docks: [0.44, 0.566], bridge: [0.579, 0.678], kachha: [0.692, 0.9], market: [0.905, 0.985] },
  },
  {
    id: 'mumbai-central', name: 'Mumbai Central Circuit', short: 'Mumbai Central',
    theme: 'city', target: 1750, lapTarget: '60–75 s', time: 'golden',
    blurb: 'Wide city roads under the flyover, chai stalls and the old station dome.',
    pts: [[0,0],[120,0],[220,-5],[290,30],[310,100],[270,150],[200,150],[160,185],[170,250],[130,300],[50,300],[-20,260],[-30,190],[-90,160],[-160,170],[-210,120],[-200,50],[-130,10]],
    widths: [[0,14],[0.16,14],[0.22,12],[0.36,12],[0.42,10.5],[0.52,10.5],[0.58,12.5],[0.8,12.5],[0.86,14]],
    triples: [0.3, 0.88], shortcuts: 2, hall: 'parking', kickers: 2, kickOver: 'autos', potholes: 9, bigPotholes: 3, mud: 3,
    bumps: [{ f: 0.47, h: 0.22, len: 3, type: 'breaker' }, { f: 0.705, h: 0.22, len: 3, type: 'breaker' }],
    flyover: { from: 0.07, to: 0.19, side: -1 },
    landmark: { f: 0.05, side: 1, dist: 260 },
  },
  {
    id: 'crawford-market', name: 'Crawford Market Circuit', short: 'Crawford Market',
    theme: 'market', target: 1500, lapTarget: '75–90 s', time: 'morning',
    blurb: 'Market lanes lined with stalls, handcarts and crates. Squeeze through the gaps.',
    pts: [[0,0],[90,0],[130,10],[140,50],[140,120],[120,150],[60,155],[40,180],[40,240],[10,260],[-60,260],[-90,230],[-90,160],[-60,130],[-70,90],[-110,70],[-120,20],[-80,-5]],
    widths: [[0,11],[0.2,11],[0.26,9],[0.45,9],[0.5,11],[0.7,11],[0.75,8.5],[0.9,8.5],[0.95,11]],
    triples: [0.6], shortcuts: 1, hall: 'market', kickers: 2, kickOver: 'carts', potholes: 8, bigPotholes: 3, mud: 4,
    bumps: [{ f: 0.33, h: 0.2, len: 3, type: 'breaker' }],
    obstacles: true,
    landmark: { f: 0.55, side: -1, dist: 180, kind: 'clocktower' },
  },
  {
    id: 'dharavi-lanes', name: 'Dharavi Lanes Circuit', short: 'Dharavi Lanes',
    theme: 'basti', target: 1300, lapTarget: '60–75 s', time: 'golden',
    blurb: 'Basti lanes, sharp 90° corners, kachha shortcuts, tin roofs and a nullah bridge jump.',
    pts: [[0,0],[60,0],[70,6],[72,20],[72,60],[78,70],[110,72],[118,80],[118,120],[110,128],[60,128],[52,136],[52,170],[44,178],[0,178],[-8,170],[-8,130],[-16,122],[-50,122],[-58,114],[-58,60],[-50,52],[-20,52],[-12,44],[-12,8],[-6,1]],
    widths: [[0,9],[0.1,9],[0.13,7.5],[0.3,7.5],[0.34,8.5],[0.5,8.5],[0.54,6.8],[0.62,6.8],[0.66,8],[0.85,8],[0.9,9]],
    triples: [0.2], shortcuts: 2, roof: true, kickers: 1, kickOver: 'drums', potholes: 8, bigPotholes: 4, mud: 5,
    bumps: [{ f: 0.44, h: 0.9, len: 7, type: 'bridge' }, { f: 0.77, h: 0.2, len: 2.5, type: 'breaker' }],
    landmark: { f: 0.3, side: 1, dist: 150, kind: 'tank' },
  },
  {
    id: 'bandstand-rush', name: 'Bandstand Rush', short: 'Bandstand Rush',
    theme: 'sea', target: 1950, lapTarget: '60–70 s', time: 'night',
    blurb: 'The wide seafront road at night. Top speed, slipstream and boost timing.',
    pts: [[0,0],[0,200],[10,320],[40,400],[90,430],[140,410],[160,350],[150,250],[120,200],[110,120],[130,60],[110,0],[70,-40],[20,-40]],
    widths: [[0,15],[0.3,15],[0.36,13],[0.75,13],[0.8,14],[0.95,15]],
    triples: [0.55], shortcuts: 1, kickers: 3, kickOver: 'autos', potholes: 6, bigPotholes: 2, mud: 2,
    sea: { x: -32 },
    landmark: { f: 0.2, side: -1, dist: 420, kind: 'sealink' },
  },
  {
    id: 'sion-flyover', name: 'Sion Flyover Circuit', short: 'Sion Flyover',
    theme: 'flyover', target: 1850, lapTarget: '65–80 s', time: 'golden',
    blurb: 'Up onto the flyover, flat out across the deck and a big jump off the crest.',
    pts: [[0,0],[200,0],[300,20],[340,80],[320,150],[250,170],[150,150],[60,180],[0,240],[-80,230],[-120,170],[-100,90],[-60,30]],
    widths: [[0,13],[0.4,13],[0.46,11],[0.75,11],[0.8,13]],
    triples: [0.42], shortcuts: 1, rail: true, kickers: 2, kickOver: 'autos', potholes: 7, bigPotholes: 3, mud: 2,
    elev: [[0,0],[0.03,0],[0.09,7.5],[0.27,7.5],[0.31,0],[1,0]],
    bumps: [{ f: 0.6, h: 1.0, len: 8, type: 'ramp' }, { f: 0.85, h: 0.22, len: 3, type: 'breaker' }],
    landmark: { f: 0.65, side: 1, dist: 300, kind: 'towers' },
  },
  {
    // the Police Express+ stage: night nakabandi across the old city. special = not part of the Championship
    id: 'bhaag-chapri', name: 'Bhaag Chapri Bhaag', short: 'Bhaag Chapri Bhaag', special: true, police: true,
    theme: 'city', target: 2400, lapTarget: '100–120 s', time: 'night', festive: true,
    blurb: 'Night nakabandi across the old city: police checkpoints, a long seedhi ride, a flooded nala and stray dogs.',
    pts: [[0,0],[200,0],[280,30],[300,110],[290,230],[240,280],[150,290],[80,330],[60,420],[-20,450],[-120,430],[-170,360],[-160,260],[-200,190],[-190,90],[-120,20]],
    widths: [[0,12],[0.3,12],[0.36,11],[0.6,11],[0.66,12]],
    triples: [], shortcuts: 1, stairs: true, nala: true, nakas: 4, dogs: 7, potholes: 6, bigPotholes: 1, mud: 0,
    landmark: { f: 0.4, side: -1, dist: 260, kind: 'towers' },
  },
  {
    // Lonavala Ghat Escape: one long run, start to finish, no laps. Down the pine ghat, round the lake, through the red
    // canyon on a kachha road and up the far hill to the fort. Every control point is [x, z, height]; the last few points
    // only close the loop (nobody rides them). special = not part of the Championship; chase = a police van is after you.
    id: 'lonavala-ghat', name: 'Lonavala Ghat Escape', short: 'Ghat Escape', special: true, chase: true,
    theme: 'hills', target: 7480, km: 4.8, lapTarget: '2:40–3:20', time: 'morning', laps: 1,
    blurb: 'One way, no laps: down the pine ghat, round the lake, through the red canyon and up to the fort. Police van peeche hai.',
    pts: [[0,0,380],[120,0,368],[240,6,352],[300,40,342],[290,90,334],[230,105,326],[110,100,308],[40,110,298],[0,150,290],[30,195,282],[110,205,270],[240,200,250],[340,215,234],[410,270,218],[440,350,202],
      [450,440,186],[460,530,175],[500,620,171],[580,690,171],[680,705,171],[780,670,172],
      [880,620,170],[980,610,162],[1070,660,152],[1150,740,140],[1250,770,130],[1350,730,122],[1410,640,114],[1400,540,110],[1340,470,108],
      [1300,390,116],[1330,310,130],[1400,260,144],[1420,200,156],[1370,160,166],[1280,170,180],[1200,140,194],[1170,70,206],[1190,0,216],[1230,-60,222],[1260,-130,222],
      [1200,-230,226],[900,-300,270],[500,-300,330],[100,-260,370],[-180,-160,380],[-220,-40,380],[-120,0,380]],
    widths: [[0,11]],
    p2p: { finish: 39, zones: { pine: [0, 14.5], lake: [14.5, 20.6], desert: [20.6, 29.6], climb: [29.6, 40.6] }, lake: { x: 640, z: 520, r: 150, y: 168.4 },
      bumps: [{ at: 10.2, h: 1.6, len: 26, type: 'ramp' }, { at: 21.5, h: 2.2, len: 34, type: 'ramp' }, { at: 23.4, h: 1.1, len: 9, type: 'ramp' }, { at: 25.2, h: 2.6, len: 38, type: 'ramp' }, { at: 26.8, h: 1.2, len: 9, type: 'ramp' }, { at: 28.3, h: 1.8, len: 24, type: 'ramp' }] },
    triples: [], shortcuts: 0, kickers: 5, kickOver: 'rocks', potholes: 5, bigPotholes: 2, mud: 4,
  },
];
// the Championship runs every circuit (not the special stages)
const CUP_TRACKS = TRACKS.filter(t => !t.special);
