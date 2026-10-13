/* Flight School badge catalogue — the ONE list the website uses.
   Loaded by flightschool/ (the curriculum), admin/ (approvals and photo
   review) and the course shim. Mirrors the `badges` catalogue in the kiosk's
   config.json (GROUNDSCHOOL-V2-SCOPE.md §3); ids are permanent, kebab-case.

   Tier numbering is the club's: simulator = Tier 0, Meteor = Tier 1.
   2026-10-06: 28 -> 23 badges (Examiner, Shot Planning, Video Systems,
   Airspace, Emergency Procedures folded in; Field Repair = Field Diagnostics).
   2026-10-07: Simulator Flight folded into Proficient Flight (5 sim hours,
   minHours, before a mentor may judge it); Airspace into Event Ops;
   electives became BONUS badges (tier 'el', never counted); est added.
   2026-10-08: 20 counted badges. Each tier's badges END IN A CHECKPOINT
   (checkpoint:true) - the "exam" that moves a pilot up a tier:
     Tiny Whoop (first real Meteor flight)  closes Tier 0 -> Tier 1
     Pavo 20 Pro Flight (new)               closes Tier 1 -> Tier 2
     Event Pilot (new: fly at an event)     closes Tier 2 -> Tier 3
   A checkpoint counts only once every other badge of its tier is earned; it
   shows a check when ready to attempt and turns green when awarded.
   2026-10-07 (display): the site and posters show a tier's other badges as
   the PREREQUISITES of the checkpoint they lead to ("building to Tier 1"),
   and the checkpoint on its own, full width, under the next tier's heading,
   with a tick box per prerequisite and a big check once all are done. Spotter
   moved to Tier 0. Proficient Flight is now called "Sim Flight" (id kept).
   Bench steps end in a PHOTO step: the pilot takes a picture on this site and
   a mentor passes or fails it in the console's Review tab.

   2026-10-10: a witnessed badge may also carry lessons + a quiz (Spotter,
   Event Ops): BOTH are needed - pass the quiz, then a mentor signs it off.
   The quiz alone never earns it (kiosk Apply-QuizResult records the score
   only). Every badge has optional resources (RES below): tips and links.
   Mentor needs deep knowledge of the FAA rules - judged by an officer, no quiz.

   type: 'knowledge'  lessons + quiz at 80 %, earned by the kiosk itself
         'bench'      step checklist, a photo submitted here, a mentor reviews it
         'witnessed'  a mentor watches you do it and signs it off
   minTier:  the tier a pilot must be ON to hold the badge (Mentor: 2)
   minHours: sim hours before a mentor may judge it (Sim Flight: 5)
   checkpoint: closes its tier (see above)
   lessons: the badge's lessons ({id, t, drill}); quiz: the quiz lesson id
   prep:    drill ids a witnessed badge reuses as practice
   steps:   the checklist a bench badge walks through
   standard: what the mentor is watching for */
(function () {
  var TIERS = [
    { id: 't0', n: 0, name: 'Simulator',   gear: 'The five FPV sims in the IC',                     color: 'var(--sky)',    gate: 'Checkpoint: Tiny Whoop · unlocks the Meteor 75 Pro' },
    { id: 't1', n: 1, name: 'Tiny Whoop',  gear: 'Meteor 75 Pro · sub-250 g',                       color: 'var(--violet)', gate: 'Checkpoint: Pavo 20 Pro Flight · unlocks full-size' },
    { id: 't2', n: 2, name: 'Full-size',   gear: 'Pavo 20 Pro · larger drones at Brophy',          color: 'var(--rust)',   gate: 'Checkpoint: Event Pilot' },
    { id: 't3', n: 3, name: 'Event Pilot', gear: 'Any Tier 2 airframe at a school event, with a spotter', color: 'var(--green)', gate: 'The top' },
    { id: 'el', n: -1, name: 'Bonus badges', gear: 'Any order, any time · not counted toward your total', color: 'var(--amber)', gate: '' }
  ];
  var TRACK = { flight: 'Flight', build: 'Build & tech', know: 'Knowledge & safety', crew: 'Crew & leadership' };
  var PHOTO = 'Take a photo of your work with "Submit a photo" below - a mentor reviews it and passes or fails it.';
  /* 2026-10-10 (Micah): every flight checkride is judged IN PERSON, all of
     it in ONE flight, ONE attempt per day. Shown on each flight badge. */
  var ONE_GO = 'In person with a mentor, everything in one flight, one attempt per day.';
  /* 2026-10-11: requirements are boxes. A witnessed badge lists `reqs`; each
     box may link lesson(s) (ticks itself when they are done) and a YouTube
     video (checked live 2026-10-11). Boxes without a lesson are ticked by the
     pilot as practice - the mentor still judges the real thing. A bench step
     may be { t, v } to carry a video. */
  function V(yt, t, by) { return { yt: yt, t: t, by: by }; }
  var VID = {
    orbit:   V('XJDBezfCwyY', 'How To: Orbits', 'headmazta'),
    splitS:  V('gepPp2OyXUQ', 'How To Perfect Split-S', 'headmazta'),
    gaps:    V('c3Rn9CFRdZs', 'Hitting Gaps Tutorial', 'Timmy RC'),
    liftoff: V('Ljw2_856qfc', 'Your First FPV Simulator (Liftoff)', 'Alec Searle'),
    turns:   V('lyo5ffYpOIE', 'How To Turn (Properly & Smoothly)', 'headmazta'),
    smooth:  V('T6dNEdAD5Hg', 'Beginner FPV Problems Stopping You Flying Smooth', 'Brodie Reed'),
    throttle:V('n-W73zzSKd4', 'Taming the throttle on a tiny whoop', 'Joshua Bardwell'),
    los:     V('mPlUHjjlkDY', 'Line of sight: guided hovering', 'VelociDrone'),
    loop:    V('LTl0780qgCE', 'How To Powerloop, An In-Depth Look', 'FPV Academy'),
    trippy:  V('tz_JYJstCU8', 'How Do You Trippy Spin?', 'Infinity Loops'),
    matty:   V('mZVjPSQHm9Y', 'How To: Matty Flip', 'headmazta'),
    tricks:  V('0EqJ9C8KuTQ', '10 FPV Freestyle Tricks - Learn These First', 'Joshua Bardwell'),
    pavo:    V('ssgQqJs1ktY', 'Pavo20 Pro Setup and Review', 'Flying Pudding'),
    whoopIn: V('ULHdR-Eg8_o', 'Smooth indoor tiny whoop flying', 'All Things Nurd'),
    lines:   V('mBSmf8N9ySA', 'Setting up Race Lines', 'FlightClub'),
    faster:  V('Ca9Euq_x7ls', 'Focus on these FPV tips to get faster', 'IQ0 fpv'),
    vo:      V('ONO1fv2LhLI', 'Using a spotter or visual observer', 'Drone U'),
    failsafe:V('Il965t3Yp8g', 'Betaflight Failsafe Tab walkthrough', 'Joshua Bardwell'),
    follow:  V('ASJ-Bvawuo8', '5 Cinematic FPV Drone Moves for Beginners', 'Michael Houghton'),
    cine:    V('MIeE1vnGCXY', '10 Simple Cinematic FPV Tips', 'Michael Houghton'),
    grade:   V('RjsASaqJUqg', 'D-Log M Color Grading Made Easy (DaVinci Resolve)', 'Visionary Filmmaker'),
    trust:   V('MFyfZ6d569s', 'FAA TRUST Recreational Test: everything you need to know', 'Pilot Institute'),
    meteor:  V('984XrFU5bPE', 'Meteor75 Pro beginner setup guide', 'Greg North'),
    motors:  V('PWyqVEkZGWk', 'Set up motors in Betaflight: order, direction, reverse props', 'RCwithAdam'),
    solder:  V('rGUxVsbSl2c', 'Learn How To Solder for FPV', 'Darren Allatt'),
    arm:     V('9iC1tuRBfxk', 'Betaflight won\'t arm: arming status flags', 'Joshua Bardwell'),
    pid:     V('Sq_DFjmvVDE', 'How to fix oscillations', 'UAV Tech'),
    lipo:    V('6JKFhvie9HI', 'Storage charging LiPo batteries', 'Motion RC')
  };

  var B = [
    // ---------------- Tier 0 · Simulator -> checkpoint Tiny Whoop
    { id: 'proficient-flight', tier: 't0', track: 'flight', type: 'witnessed', name: 'Sim Flight', minHours: 5, est: 'about 6 h', rule: ONE_GO,
      do: 'Log 5 sim hours, then fly a checkride in Liftoff.', why: 'Acro muscle memory where crashes are free.',
      reqs: [{ t: '5 hours in the flight sims', d: 'Ground School time does not count', hours: 5 },
             { t: 'Stick basics', d: 'four channels, rate vs angle, hover, throttle', lessons: ['gs-fly-01', 'gs-fly-02', 'gs-fly-03', 'gs-fly-04'], v: VID.liftoff },
             { t: 'A clean orbit around a gate', v: VID.orbit },
             { t: 'A Split-S', lessons: ['gs-trk-02'], v: VID.splitS },
             { t: 'Three gaps without a crash', v: VID.gaps },
             { t: 'A finished race', v: VID.turns }] },
    { id: 'spotter', quiz: 'gs-spt-quiz', tier: 't0', track: 'crew', type: 'witnessed', name: 'Spotter', est: 'about 1 h',
      do: 'Short course and quiz, then spot a real flight. Do it first.', why: 'FPV pilots can’t see around themselves.',
      lessons: [{ id: 'gs-spt-01', t: 'The spotter’s job' }, { id: 'gs-spt-02', t: 'What to call' }],
      reqs: [{ t: 'The spotter’s job', lessons: ['gs-spt-01'] },
             { t: 'What to call', lessons: ['gs-spt-02'] },
             { t: 'Spotter quiz (80 %)', lessons: ['gs-spt-quiz'] },
             { t: 'Check the field before the battery goes in' },
             { t: 'Eyes on the aircraft the whole battery', v: VID.vo },
             { t: 'Call every person and obstacle early' }] },
    { id: 'safe-flight', quiz: 'gs-saf-quiz', tier: 't0', track: 'know', type: 'knowledge', name: 'Safe Flight', est: 'about 20 min',
      do: 'Know and follow the Brophy FPV safe-flight rules.', why: 'The baseline code of conduct for real hardware.',
      lessons: [{ id: 'gs-saf-01', t: "Who's flying, who's watching" }, { id: 'gs-saf-02', t: 'The Brophy FPV rules sheet' }, { id: 'gs-saf-03', t: 'Go / No-Go', drill: true }] },
    { id: 'battery-care', quiz: 'gs-bat-quiz', tier: 't0', track: 'build', type: 'knowledge', name: 'Battery Care', est: 'about 20 min',
      do: 'Charging, storage, puffed packs and disposal.', why: 'LiPos are the biggest real fire risk in the hobby.',
      lessons: [{ id: 'gs-bat-01', t: 'LiPo basics' }, { id: 'gs-bat-02', t: 'Battery math', drill: true }, { id: 'gs-bat-03', t: 'Charging, storage and disposal', v: VID.lipo }, { id: 'gs-bat-04', t: 'When a pack goes bad' }] },
    { id: 'building', tier: 't0', track: 'build', type: 'bench', name: 'Building', est: 'about 3 h',
      do: 'Rebuild a disassembled Meteor 75 Pro.', why: 'Members can fix what they break.',
      steps: [{ t: 'Parts check: frame, FC/ESC, motors, RX, VTX, camera, antenna, props, strap', v: VID.meteor }, 'Motors on - right screw length, nothing touching a winding', 'Plug in the motors', 'Assemble it and put the canopy on', 'Plug in the canopy', 'Test: motors beep, camera turns on', { t: 'Props: each matches its motor\'s spin (props in or out, as set in Betaflight), leading edge first', v: VID.motors }, PHOTO] },
    { id: 'betaflight', tier: 't0', track: 'build', type: 'bench', name: 'Betaflight', est: 'about 1 h',
      do: 'Motors, OSD, rates, arm switch, then bind.', why: 'Most “won’t fly” problems get solved here.',
      steps: ['Props OFF, battery OUT, USB only', 'Connect - the kiosk reads the board', 'Flash the practice config (a lightly messed-up drone)', 'Receiver: protocol', 'Modes: ARM and angle; set the rates', { t: 'Motors: order and direction (props off!)', v: VID.motors }, 'OSD: battery usage and amp draw, positioned', 'Check my work - the kiosk compares with the stock config', 'Bind last (plug/unplug method)', PHOTO],
      note: 'Practised on the club Meteor 75 Pro at the kiosk.' },
    { id: 'line-of-sight', tier: 't0', track: 'flight', type: 'witnessed', name: 'Line of Sight', est: 'about 30 min', rule: ONE_GO,
      do: 'No goggles: fly a whoop in angle mode.', why: 'If video cuts out you can still land.',
      reqs: [{ t: 'Take-off to head height', lessons: ['gs-los-01'], v: VID.los },
             { t: 'A 20-second steady hover', lessons: ['gs-fly-03'], v: VID.throttle },
             { t: 'A lap around a tree', lessons: ['gs-los-02'] },
             { t: 'A smooth landing', lessons: ['gs-los-03'] }] },
    { id: 'tiny-whoop', tier: 't0', track: 'flight', type: 'witnessed', name: 'Tiny Whoop', checkpoint: true, est: 'about 2 h', rule: ONE_GO,
      do: 'Checkpoint into Tier 1: the Meteor 75 Pro in goggles.', why: 'Your first real flight. Pass it and you are Tier 1.',
      reqs: [{ t: 'A controlled take-off', v: VID.throttle },
             { t: 'A figure-eight through two gates', v: VID.turns },
             { t: 'An orbit', v: VID.orbit },
             { t: 'A landing on the pad, no wall contact' }] },

    // ---------------- Tier 1 · Tiny Whoop -> checkpoint Pavo 20 Pro Flight
    { id: 'soldering', tier: 't1', track: 'build', type: 'bench', name: 'Soldering', est: 'about 1.5 h',
      do: 'Solder an ESC and motors, then spin them up.', why: 'Core electronics skill that transfers to robotics.',
      steps: ['Iron at the right temperature, tip tinned', { t: 'Tin the pad, tin the wire, join', v: VID.solder }, 'ESC pads: shiny, no bridges', 'Motor wires: all three, trimmed', 'Spin each motor in Betaflight (props off)', PHOTO] },
    { id: 'electrical-components', quiz: 'gs-elc-quiz', tier: 't1', track: 'know', type: 'knowledge', name: 'Electrical Components', est: 'about 20 min',
      do: 'Choose motors, ESCs, batteries and props that match.', why: 'Why small and big quads need different parts.',
      lessons: [{ id: 'gs-elc-01', t: 'The six parts' }, { id: 'gs-elc-02', t: 'Motors, props and thrust', drill: true }, { id: 'gs-elc-03', t: 'Matching motor, ESC, prop and battery' }, { id: 'gs-elc-04', t: 'Why a 3-inch and a 5-inch differ' }] },
    { id: 'radio-protocol', quiz: 'gs-rad-quiz', tier: 't1', track: 'know', type: 'knowledge', name: 'Radio Protocol', est: 'about 35 min',
      do: 'Control links, video systems, antennas and interference.', why: 'Fewer dropouts, and footage the editor can use.',
      lessons: [{ id: 'gs-rad-01', t: 'Analog against digital' }, { id: 'gs-rad-02', t: 'Bands, channels and racing', drill: true }, { id: 'gs-rad-03', t: 'Antennas and diversity' }, { id: 'gs-rad-04', t: 'Control links: ELRS, Crossfire, binding, failsafe' }, { id: 'gs-rad-05', t: 'Interference at an event' }, { id: 'gs-rad-06', t: 'Digital video: goggles, recording and D-log' }] },
    { id: 'field-repair', tier: 't1', track: 'build', type: 'bench', name: 'Field Diagnostics', est: 'about 45 min',
      do: 'Find and fix three faults a mentor plants.', why: 'Keeps a shoot going instead of ending it.',
      steps: ['A mentor breaks three things without telling you what', 'Radio: find and fix it', { t: 'Betaflight: find and fix it', v: VID.arm }, 'Mechanical or electrical: find and fix it', 'Explain each cause to the mentor', PHOTO] },
    { id: 'freestyle-flight', tier: 't1', track: 'flight', type: 'witnessed', name: 'Freestyle Flight', est: 'about 5 h', rule: ONE_GO,
      do: 'A freestyle checkride in the simulator.', why: 'Advanced control before expensive airframes.',
      reqs: [{ t: 'Smooth, flowing lines', v: VID.smooth },
             { t: 'Three tiny gaps', v: VID.gaps },
             { t: 'A powerloop', lessons: ['gs-trk-03'], v: VID.loop },
             { t: 'A trippy spin', v: VID.trippy },
             { t: 'A Matty flip', lessons: ['gs-trk-04'], v: VID.matty },
             { t: 'A wildcard', d: 'a path or move the mentor picks at random', lessons: ['gs-trk-01'], v: VID.tricks }] },
    { id: 'pavo-flight', tier: 't1', track: 'flight', type: 'witnessed', name: 'Pavo 20 Pro Flight', checkpoint: true, est: 'about 1 h', rule: ONE_GO,
      do: 'Checkpoint into Tier 2: fly the Pavo 20 Pro.', why: 'Your first full-size airframe. Pass it and you are Tier 2.',
      reqs: [{ t: 'Take-off with a spotter', v: VID.pavo },
             { t: 'A figure-eight', v: VID.turns },
             { t: 'An orbit', v: VID.orbit },
             { t: 'Through a gate' },
             { t: 'A clean landing on the pad - no contact' }] },

    // ---------------- Tier 2 · Full-size -> checkpoint Event Pilot
    { id: 'faa-trust', tier: 't2', track: 'know', type: 'bench', name: 'FAA TRUST', est: 'about 30 min',
      do: 'Take the free TRUST test and send a photo of the certificate.', why: 'Federal requirement for recreational flyers.',
      steps: [{ t: 'Take the free TRUST test (link below - about 20 min, cannot be failed)', v: VID.trust }, 'Save the certificate; keep a copy on your phone', 'Submit a photo of it, name readable - a mentor passes or fails it.'] },
    { id: 'event-ops', quiz: 'gs-evt-quiz', tier: 't2', track: 'know', type: 'witnessed', name: 'Event Ops', est: 'about 1.5 h',
      do: 'Course and quiz, then run a real flight-zone setup.', why: 'Flying at a game or rally, and a plan for when it goes wrong.',
      lessons: [{ id: 'gs-asp-01', t: 'Class B, 400 ft and Sky Harbor' }, { id: 'gs-asp-02', t: 'B4UFLY, LAANC and TRUST' }, { id: 'gs-evt-01', t: 'The flight zone' }, { id: 'gs-evt-02', t: 'Briefing bystanders' }, { id: 'gs-evt-03', t: 'Pilot and spotter call-outs' }, { id: 'gs-emg-01', t: 'Failsafe: set it, test it' }, { id: 'gs-emg-02', t: 'Flyaway and lost video' }, { id: 'gs-emg-03', t: 'LiPo fire and injury' }, { id: 'gs-emg-04', t: 'The incident report' }, { id: 'gs-emg-05', t: 'Scenario drill', drill: true }],
      reqs: [{ t: 'Airspace: what the mentor checks', lessons: ['gs-asp-01', 'gs-asp-02'] },
             { t: 'The zone, the brief and the calls', lessons: ['gs-evt-01', 'gs-evt-02', 'gs-evt-03'] },
             { t: 'When it goes wrong', d: 'failsafe, flyaway, fire, the report', lessons: ['gs-emg-01', 'gs-emg-02', 'gs-emg-03', 'gs-emg-04', 'gs-emg-05'], v: VID.failsafe },
             { t: 'Event Ops quiz (80 %)', lessons: ['gs-evt-quiz'] },
             { t: 'A real setup for a mentor', d: 'zone marked and briefed, failsafe tested' }] },
    { id: 'cinematography', tier: 't2', track: 'crew', type: 'witnessed', name: 'Cinematography', est: 'about 3 h',
      do: 'Plan and shoot one usable clip at a real event.', why: 'Shooters for Best of Brophy.',
      reqs: [{ t: 'A shot list agreed with the coach or moderator' },
             { t: 'A follow shot', v: VID.follow },
             { t: 'An orbit', v: VID.orbit },
             { t: 'A reveal', v: VID.cine },
             { t: 'A clip the editor accepts' }] },
    { id: 'indoor-proximity', tier: 't2', track: 'flight', type: 'witnessed', name: 'Indoor Proximity', est: 'about 2 h', rule: ONE_GO,
      do: 'The hallway course without touching a wall.', why: 'Precision in tight spaces, for the rally race.',
      reqs: [{ t: 'The club hallway course on one battery', v: VID.whoopIn },
             { t: 'Zero wall contact', v: VID.throttle }] },
    { id: 'racing', tier: 't2', track: 'flight', type: 'witnessed', name: 'Racing', est: 'about 4 h', rule: ONE_GO,
      do: '3 clean laps of the club course under the posted time.', why: 'Qualifies you for the rally race.',
      reqs: [{ t: 'Clean race lines', v: VID.lines },
             { t: 'Three clean laps in a row' },
             { t: 'Under the posted time, timed by the mentor', v: VID.faster }] },
    { id: 'event-pilot', tier: 't2', track: 'flight', type: 'witnessed', name: 'Event Pilot', checkpoint: true, est: 'one event',
      do: 'Checkpoint into Tier 3: fly at a school event or a race.', why: 'The top of the path: flying for the school.',
      reqs: [{ t: 'Zone set up and briefed' },
             { t: 'A spotter beside you' },
             { t: 'A mentor on site signs it off' }] },

    // ---------------- Bonus badges (tier 'el') - never counted toward the total or the tier
    { id: 'editing', tier: 'el', track: 'crew', type: 'witnessed', name: 'Editing', est: 'about 3 h',
      do: 'Cut and grade a 30–60 s clip from D-log.', why: 'Best of Brophy doesn’t depend on one editor.',
      reqs: [{ t: 'Cut to 30–60 seconds' },
             { t: 'Colour-graded from D-log', v: VID.grade },
             { t: 'Delivered to the editor' }] },
    { id: 'tuning', tier: 'el', track: 'build', type: 'bench', name: 'Tuning', est: 'about 2 h',
      do: 'Fix an oscillation, with before/after footage.', why: 'The skill behind smooth cinematic footage.',
      steps: ['Before footage of the oscillation', { t: 'P, D or filters? (Blackbox or reasoning)', v: VID.pid }, 'One change at a time, test flight', 'After footage, clean', PHOTO] },
    { id: 'fleet-steward', tier: 'el', track: 'crew', type: 'witnessed', name: 'Fleet Steward', est: 'one semester',
      do: 'Run equipment check-in/out for a semester.', why: 'Accountability for school-funded gear.',
      reqs: [{ t: 'Check-in/out sheet, every session' },
             { t: 'A maintenance log' },
             { t: 'A full semester, reviewed by a mentor' }] },
    { id: 'mentor', tier: 'el', track: 'crew', type: 'witnessed', name: 'Mentor', est: 'about a month', minTier: 2,
      do: 'Coach a new member through two badges.', why: 'The club trains its own replacements.',
      reqs: [{ t: 'A Tier 2 pilot' },
             { t: 'Deep knowledge of the FAA rules', d: 'an officer judges it, no quiz', v: VID.trust },
             { t: 'Two badges earned by someone you coached' },
             { t: 'Officer approval', d: 'then you may sign off badges you hold' }] }
  ];

  /* Optional resources for every badge (2026-10-10): { tip } is a flying tip,
     { t, u } a link (checked live 2026-10-10). Never required. */
  var LIFT = { t: 'Liftoff on Steam (the main club sim)', u: 'https://store.steampowered.com/app/410340/' };
  var JB = { t: 'Joshua Bardwell on YouTube - FPV how-tos', u: 'https://www.youtube.com/@JoshuaBardwell' };
  var FAA = { t: 'FAA: recreational flyers', u: 'https://www.faa.gov/uas/recreational_flyers' };
  var LEARN = { t: 'Oscar Liang: learn to fly FPV - tips and practice', u: 'https://oscarliang.com/learn-flying-fpv-multirotors/' };
  var BF = { t: 'Betaflight docs', u: 'https://betaflight.com/docs/wiki' };
  var RES = {
    'proficient-flight': [{ tip: 'Short sessions every day beat one long one - 20 minutes, then a break.' }, { tip: 'Look where you want to go, not at the gate you are passing; your hands follow your eyes.' }, { tip: 'Learn throttle first: a steady height through a turn is most of acro.' }, LIFT, LEARN],
    'spotter': [{ tip: 'Stand next to the pilot, a little behind, where you can see the aircraft and the pilot can hear you.' }, { tip: 'Say what you see in two words or fewer.' }, FAA],
    'safe-flight': [{ tip: 'When you are not sure something is allowed, ask a mentor first.' }, FAA, { t: 'Academy of Model Aeronautics safety code (PDF)', u: 'https://www.modelaircraft.org/sites/default/files/documents/100.pdf' }],
    'battery-care': [{ tip: 'Write the date on a pack when it goes to storage.' }, { tip: 'Land at 3.5 V a cell, not at the beep - packs last much longer.' }, { t: 'Oscar Liang: LiPo battery guide', u: 'https://oscarliang.com/lipo-battery-guide/' }],
    'building': [{ tip: 'Lay the parts out in order on a tray first; tiny screws love carpet.' }, { tip: 'Prop direction: the leading edge - the thicker, rounded edge of each blade - goes first in the direction the motor spins. Diagonal props match; neighbours are mirror images. A prop on backwards makes the quad flip on take-off.' }, { tip: 'Take a photo before you unplug anything - it is your wiring diagram.' }, { t: 'BetaFPV Meteor75 Pro (manual and parts)', u: 'https://betafpv.com/products/meteor75-pro-brushless-whoop-quadcopter' }, { t: 'Oscar Liang: how to build an FPV drone', u: 'https://oscarliang.com/how-to-build-fpv-drone/' }],
    'betaflight': [{ tip: 'Save a backup ("diff all") before you change anything.' }, BF, { t: 'Betaflight in the browser (app.betaflight.com)', u: 'https://app.betaflight.com' }, { t: 'Oscar Liang: Betaflight OSD setup', u: 'https://oscarliang.com/betaflight-osd/' }],
    'line-of-sight': [{ tip: 'Keep the nose pointed away from you at first, so left is left.' }, { tip: 'Small stick moves; a whoop answers fast.' }, { t: 'Oscar Liang: from angle mode to acro', u: 'https://oscarliang.com/tiny-whoop/' }],
    'tiny-whoop': [{ tip: 'Fly the same figure-eight in the sim the day before.' }, { tip: 'If it goes wrong, disarm - a whoop falling is fine.' }, LEARN],
    'soldering': [{ tip: 'Clean, tinned tip; heat the pad and the wire together for 2-3 seconds.' }, { tip: 'A good joint is shiny and shaped like a little volcano.' }, { t: 'Oscar Liang: soldering for FPV drones', u: 'https://oscarliang.com/soldering-guide/' }],
    'electrical-components': [{ tip: 'Start with the battery voltage and prop size; everything else follows.' }, { t: 'Oscar Liang: choosing FPV motors', u: 'https://oscarliang.com/motors/' }, { t: 'Oscar Liang: propellers', u: 'https://oscarliang.com/propellers/' }],
    'radio-protocol': [{ tip: 'Antennas never point straight at the drone - the side of an antenna is where it is strongest.' }, { t: 'ExpressLRS documentation', u: 'https://www.expresslrs.org/' }, { t: 'Oscar Liang: FPV video systems compared', u: 'https://oscarliang.com/fpv-system/' }],
    'field-repair': [{ tip: 'Check the simple things first: battery, props, binding, switch positions.' }, { t: 'Betaflight: arming and why it will not arm', u: 'https://betaflight.com/docs/wiki/guides/current/Arming-Sequence-And-Safety' }, JB],
    'freestyle-flight': [{ tip: 'Learn each trick high and slow in the sim, then lower and faster.' }, { tip: 'Watch the trick at half speed on YouTube and copy the sticks, not the camera.' }, LIFT, JB],
    'pavo-flight': [{ tip: 'The Pavo is heavier than the Meteor - give it more room to stop.' }, { t: 'BetaFPV Pavo20 Pro', u: 'https://betafpv.com/products/pavo20-pro-brushless-whoop-quadcopter' }],
    'faa-trust': [{ t: 'Take the TRUST test (Pilot Institute, free, FAA-approved)', u: 'https://trust.pilotinstitute.com/' }, { t: 'FAA TRUST (the free test)', u: 'https://www.faa.gov/uas/recreational_flyers/knowledge_test_updates' }, FAA],
    'event-ops': [{ tip: 'Walk the zone before the event with the organiser.' }, { t: 'FAA B4UFLY', u: 'https://www.faa.gov/uas/getting_started/b4ufly' }, FAA],
    'cinematography': [{ tip: 'Smooth beats fast: slow throttle changes, wide gentle turns.' }, { t: 'Oscar Liang: making FPV video cinematic', u: 'https://oscarliang.com/cinematic-fpv/' }],
    'indoor-proximity': [{ tip: 'Lower your rates for tight spaces.' }, { tip: 'Fly the hallway course in the sim first.' }],
    'racing': [{ tip: 'Smooth is fast: clean lines beat full throttle.' }, { t: 'MultiGP (drone racing league)', u: 'https://www.multigp.com' }],
    'event-pilot': [{ tip: 'Fly a practice battery at the venue before people arrive.' }, { tip: 'Agree the LAND call with your spotter before take-off.' }],
    'editing': [{ tip: 'Cut on the action; 30 seconds of the best beats 3 minutes of everything.' }, { t: 'DaVinci Resolve (free editor)', u: 'https://www.blackmagicdesign.com/products/davinciresolve' }],
    'tuning': [{ tip: 'Change one thing at a time and fly the same line after each change.' }, { t: 'Betaflight PID tuning guide', u: 'https://betaflight.com/docs/wiki/guides/current/PID-Tuning-Guide' }, { t: 'Oscar Liang: Blackbox', u: 'https://oscarliang.com/blackbox/' }],
    'fleet-steward': [{ tip: 'Check gear in and out every time, even for five minutes.' }],
    'mentor': [{ tip: 'Let the new pilot do it; you only talk.' }, FAA]
  };
  B.forEach(function (b) { b.res = RES[b.id] || []; });

  var LESSON_TITLES = {
    'gs-rul-01': "Who's flying, who's watching", 'gs-rul-02': 'Where you may fly', 'gs-rul-03': 'Go / No-Go',
    'gs-ele-01': 'The six parts', 'gs-ele-02': 'Motors, props and thrust', 'gs-ele-03': 'LiPo batteries', 'gs-ele-04': 'Battery math',
    'gs-vid-01': 'Analog against digital', 'gs-vid-02': 'Bands, channels and racing', 'gs-vid-03': 'Antennas and diversity',
    'gs-fly-01': 'Four channels, two sticks', 'gs-fly-02': 'Rate mode against angle mode', 'gs-fly-03': 'Hover Trainer', 'gs-fly-04': 'Throttle discipline',
    'gs-los-01': 'Which way is left?', 'gs-los-02': 'Gate Run', 'gs-los-03': 'Lost orientation recovery',
    'gs-trk-01': 'Your first flip and roll', 'gs-trk-02': 'The Split-S', 'gs-trk-03': 'The Power Loop', 'gs-trk-04': 'The Matty Flip'
  };

  function slug(name) { return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  window.FS = { TIERS: TIERS, TRACK: TRACK, BADGES: B, LESSON_TITLES: LESSON_TITLES, slug: slug, PASS: 80, SIM_HOURS: 5,
    API: 'https://brophy-fpv-club-api.netlify.app',
    counted: function (b) { return b.tier !== 'el'; },
    /* the other badges of a checkpoint's tier */
    mates: function (b) { return B.filter(function (x) { return x !== b && x.tier === b.tier && !x.checkpoint; }); },
    /* a photo can be submitted for any badge a mentor signs off */
    photoOk: function (b) { return b.type === 'bench' || b.type === 'witnessed'; },
    /* a bench step is a string or { t, v } (2026-10-11) */
    stepText: function (st) { return typeof st === 'string' ? st : (st && st.t) || ''; },
    /* quiz AND a mentor's sign-off (2026-10-10) */
    both: function (b) { return !!b.quiz && b.type !== 'knowledge'; } };
})();
