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
     Meteor 75 Pro Certification (id tiny-whoop; first real Meteor flight)  closes Tier 0 -> Tier 1
     (was "Tiny Whoop", then "FPV Certification Test" 2026-10-19; the id is permanent)
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

   2026-10-20 (Micah, after Mr. Burr's and Mr. Reasy's replies): the FPV
   Certification Test is SPLIT in two.
     - FLIGHT CLEARANCE (tier 'cl', its own page ../clearance/) = the "Brophy
       Drone Certification": FAA TRUST, Safe Flight (both moved here), the
       Pilot Agreement (terms on the page; a one-page paper the pilot AND a
       parent sign, photographed and reviewed) and the Drone Portfolio (every
       drone the pilot may fly at Brophy: their own, each with a minute of
       flight video on Google Drive a mentor approves in the console; the
       club's, unlocked by its checkpoint). Never counted, no tier. Clearance
       is still not permission: every campus flight is requested on
       Mr. Burr's Google Form, on the same page, 24 h ahead.
     - Tier 1 = the "Meteor 75 Pro Certification" (id tiny-whoop kept): just
       the drone things - Battery Care, Building, Betaflight, Line of Sight,
       Sim Flight, then the checkpoint flight.
   2026-10-15 (the grant's condition: make getting to the Meteor easy):
   the Tier 0 path is six short parts a new member can do in one community
   period - two quizzes (Safe Flight, Battery Care), a short Building and
   Betaflight session, Line of Sight, then the Tiny Whoop checkpoint - plus
   Sim Flight, whose 5 sim hours are now a SUGGESTION (minHours removed, the
   hours box and "a finished race" dropped from its requirements). Spotter is
   a quiz-only knowledge badge on the Tier 2 path (its witnessed part went).
   Every est was cut to what the thing actually takes (about a minute a page;
   bench and flight checks are short). The Pavo and Event Pilot requirements
   are unchanged on purpose: about an hour of homework each, plus flying.

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
    { id: 't0', n: 0, name: 'Simulator',   gear: 'The five FPV sims in the IC',                     color: 'var(--sky)',    gate: 'Checkpoint: Meteor 75 Pro Certification' },
    { id: 't1', n: 1, name: 'Meteor 75 Pro Certification',  gear: 'Meteor 75 Pro · sub-250 g',                       color: 'var(--violet)', gate: 'Checkpoint: Pavo 20 Pro Flight · unlocks full-size' },
    { id: 't2', n: 2, name: 'Full-size',   gear: 'Pavo 20 Pro · larger drones at Brophy',          color: 'var(--rust)',   gate: 'Checkpoint: Event Pilot' },
    { id: 't3', n: 3, name: 'Event Pilot', gear: 'Any Tier 2 airframe at a school event, with a spotter', color: 'var(--green)', gate: 'The top' },
    { id: 'el', n: -1, name: 'Bonus badges', gear: 'Any order, any time · not counted toward your total', color: 'var(--amber)', gate: '' },
    /* 2026-10-20: Flight Clearance - the Brophy Drone Certification. Shown on
       ../clearance/ (../fly/ redirects there), never a tier,
       never counted. n = -2 keeps it out of every "n >= 0" tier loop. */
    { id: 'cl', n: -2, name: 'Brophy Drone Certification', gear: 'Flight Clearance on the website · four badges, then ask before every flight', color: 'var(--rust)', gate: '' }
  ];
  /* The club's drones (2026-10-20). Each sits in every pilot's Drone
     Portfolio faded out and is unlocked by the checkpoint that certifies it. */
  var CLUB_DRONES = [
    { id: 'club-meteor', name: 'Meteor 75 Pro', specs: 'BetaFPV 75 mm brushless whoop · 1S · about 25 g without battery · sub-250 g', badge: 'tiny-whoop', unlock: 'Meteor 75 Pro Certification (the Tier 1 checkpoint)' },
    { id: 'club-pavo',   name: 'Pavo 20 Pro',   specs: 'BetaFPV 2-inch cinewhoop · 4S · DJI O4 Pro air unit · about 125 g without battery', badge: 'pavo-flight', unlock: 'Pavo 20 Pro Flight (the Tier 2 checkpoint)' }
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
    // ---------------- Tier 0 · Simulator -> checkpoint Meteor 75 Pro Certification (id tiny-whoop)
    // Just the drone things (2026-10-20): Battery Care, Building, Betaflight Intro, Line of Sight,
    // Sim Flight (practice first, 5 h suggested), then the checkpoint flight. Safe Flight is
    // part of Flight Clearance now.
    { id: 'proficient-flight', tier: 't0', track: 'flight', type: 'witnessed', name: 'Sim Flight', est: 'one flight · about 5 h of sim practice first is typical', rule: ONE_GO,
      do: 'Fly a short checkride in Liftoff: an orbit, a Split-S, three gaps.', why: 'Acro muscle memory where crashes are free.',
      note: 'Suggested, not required: about 5 hours in the sims before you try it. Ask a mentor whenever you feel ready.',
      reqs: [{ t: 'Stick basics', d: 'four channels, rate vs angle, hover, throttle', lessons: ['gs-fly-01', 'gs-fly-02', 'gs-fly-03', 'gs-fly-04'], v: VID.liftoff },
             { t: 'A clean orbit around a gate', v: VID.orbit },
             { t: 'A Split-S', lessons: ['gs-trk-02'], v: VID.splitS },
             { t: 'Three gaps without a crash', v: VID.gaps }] },
    { id: 'battery-care', quiz: 'gs-bat-quiz', tier: 't0', track: 'build', type: 'knowledge', name: 'Battery Care', est: 'about 10 min',
      do: 'Charging, storage, puffed packs and disposal.', why: 'LiPos are the biggest real fire risk in the hobby.',
      lessons: [{ id: 'gs-bat-01', t: 'LiPo basics' }, { id: 'gs-bat-02', t: 'Battery math', drill: true }, { id: 'gs-bat-03', t: 'Charging, storage and disposal', v: VID.lipo }, { id: 'gs-bat-04', t: 'When a pack goes bad' }] },
    { id: 'building', tier: 't0', track: 'build', type: 'bench', name: 'Building', est: 'about 15 min',
      do: 'Rebuild a disassembled Meteor 75 Pro.', why: 'Members can fix what they break.',
      steps: [{ t: 'Parts check: frame, FC/ESC, motors, RX, VTX, camera, antenna, props, strap', v: VID.meteor }, 'Motors on - right screw length, nothing touching a winding', 'Plug in the motors', 'Assemble it and put the canopy on', 'Plug in the canopy', 'Test: motors beep, camera turns on', { t: 'Props: each matches its motor\'s spin (props in or out, as set in Betaflight), leading edge first', v: VID.motors }, PHOTO] },
    { id: 'betaflight-intro', tier: 't0', track: 'build', type: 'bench', name: 'Betaflight Intro', est: 'about 5 min',
      do: 'Calibrate the accelerometer and bind the receiver.', why: 'The two things every Meteor needs before its first flight.',
      steps: ['Props OFF, battery OUT, USB only', 'Connect - the kiosk reads the board', 'Setup tab: calibrate the accelerometer, the drone flat and still', 'Bind the receiver (plug/unplug method)', PHOTO],
      note: 'Practised on the club Meteor 75 Pro at the kiosk, right after Building. The rest of Betaflight is a Tier 2 badge (2026-10-20).' },
    { id: 'line-of-sight', tier: 't0', track: 'flight', type: 'witnessed', name: 'Line of Sight', est: 'about 15 min', rule: ONE_GO,
      do: 'No goggles: fly a whoop in angle mode.', why: 'If video cuts out you can still land.',
      reqs: [{ t: 'Take-off to head height', lessons: ['gs-los-01'], v: VID.los },
             { t: 'A 20-second steady hover', lessons: ['gs-fly-03'], v: VID.throttle },
             { t: 'A lap around a tree', lessons: ['gs-los-02'] },
             { t: 'A smooth landing', lessons: ['gs-los-03'] }] },
    { id: 'tiny-whoop', tier: 't0', track: 'flight', type: 'witnessed', name: 'Meteor 75 Pro Certification', checkpoint: true, est: 'one flight · about 15 min', rule: ONE_GO,
      do: 'Checkpoint into Tier 1: the Meteor 75 Pro in goggles.', why: 'Your first real flight. Pass it and you are Tier 1, and the club Meteor joins your Drone Portfolio.',
      reqs: [{ t: 'A controlled take-off', v: VID.throttle },
             { t: 'A figure-eight through two gates', v: VID.turns },
             { t: 'An orbit', v: VID.orbit },
             { t: 'A landing on the pad, no wall contact' }] },

    // ---------------- Tier 1 · Tiny Whoop -> checkpoint Pavo 20 Pro Flight
    { id: 'soldering', tier: 't1', track: 'build', type: 'bench', name: 'Soldering', est: 'about 30 min',
      do: 'Solder an ESC and motors, then spin them up.', why: 'Core electronics skill that transfers to robotics.',
      steps: ['Iron at the right temperature, tip tinned', { t: 'Tin the pad, tin the wire, join', v: VID.solder }, 'ESC pads: shiny, no bridges', 'Motor wires: all three, trimmed', 'Spin each motor in Betaflight (props off)', PHOTO] },
    { id: 'betaflight', tier: 't1', track: 'build', type: 'bench', name: 'Betaflight', est: 'about 10 min',
      do: 'Motors, OSD, rates and the arm switch on a messed-up config.', why: 'Most “won’t fly” problems get solved here.',
      steps: ['Props OFF, battery OUT, USB only - connect, the kiosk reads the board', 'Flash the practice config (a lightly messed-up drone)', 'Receiver protocol; modes: ARM and angle; set the rates', { t: 'Motors: order and direction (props off!)', v: VID.motors }, 'OSD: battery usage and amp draw, positioned', 'Check my work - the kiosk compares with the stock config', PHOTO],
      note: 'On the club Meteor 75 Pro at the kiosk. Betaflight Intro (Tier 1 path) covered the accelerometer and binding.' },
    { id: 'electrical-components', quiz: 'gs-elc-quiz', tier: 't1', track: 'know', type: 'knowledge', name: 'Electrical Components', est: 'about 10 min',
      do: 'Choose motors, ESCs, batteries and props that match.', why: 'Why small and big quads need different parts.',
      lessons: [{ id: 'gs-elc-01', t: 'The six parts' }, { id: 'gs-elc-02', t: 'Motors, props and thrust', drill: true }, { id: 'gs-elc-03', t: 'Matching motor, ESC, prop and battery' }, { id: 'gs-elc-04', t: 'Why a 3-inch and a 5-inch differ' }] },
    { id: 'radio-protocol', quiz: 'gs-rad-quiz', tier: 't1', track: 'know', type: 'knowledge', name: 'Radio Protocol', est: 'about 15 min',
      do: 'Control links, video systems, antennas and interference.', why: 'Fewer dropouts, and footage the editor can use.',
      lessons: [{ id: 'gs-rad-01', t: 'Analog against digital' }, { id: 'gs-rad-02', t: 'Bands, channels and racing', drill: true }, { id: 'gs-rad-03', t: 'Antennas and diversity' }, { id: 'gs-rad-04', t: 'Control links: ELRS, Crossfire, binding, failsafe' }, { id: 'gs-rad-05', t: 'Interference at an event' }, { id: 'gs-rad-06', t: 'Digital video: goggles, recording and D-log' }] },
    { id: 'field-repair', tier: 't1', track: 'build', type: 'bench', name: 'Field Diagnostics', est: 'about 20 min',
      do: 'Find and fix three faults a mentor plants.', why: 'Keeps a shoot going instead of ending it.',
      steps: ['A mentor breaks three things without telling you what', 'Radio: find and fix it', { t: 'Betaflight: find and fix it', v: VID.arm }, 'Mechanical or electrical: find and fix it', 'Explain each cause to the mentor', PHOTO] },
    { id: 'freestyle-flight', tier: 't1', track: 'flight', type: 'witnessed', name: 'Freestyle Flight', est: 'one flight · lots of sim practice first', rule: ONE_GO,
      do: 'A freestyle checkride in the simulator.', why: 'Advanced control before expensive airframes.',
      reqs: [{ t: 'Smooth, flowing lines', v: VID.smooth },
             { t: 'Three tiny gaps', v: VID.gaps },
             { t: 'A powerloop', lessons: ['gs-trk-03'], v: VID.loop },
             { t: 'A trippy spin', v: VID.trippy },
             { t: 'A Matty flip', lessons: ['gs-trk-04'], v: VID.matty },
             { t: 'A wildcard', d: 'a path or move the mentor picks at random', lessons: ['gs-trk-01'], v: VID.tricks }] },
    { id: 'pavo-flight', tier: 't1', track: 'flight', type: 'witnessed', name: 'Pavo 20 Pro Flight', checkpoint: true, est: 'one flight · about 10 min', rule: ONE_GO,
      do: 'Checkpoint into Tier 2: fly the Pavo 20 Pro.', why: 'Your first full-size airframe. Pass it and you are Tier 2.',
      reqs: [{ t: 'Take-off with a spotter', v: VID.pavo },
             { t: 'A figure-eight', v: VID.turns },
             { t: 'An orbit', v: VID.orbit },
             { t: 'Through a gate' },
             { t: 'A clean landing on the pad - no contact' }] },

    // ---------------- Tier 2 · Full-size -> checkpoint Event Pilot
    { id: 'spotter', quiz: 'gs-spt-quiz', tier: 't2', track: 'crew', type: 'knowledge', name: 'Spotter', est: 'about 5 min',
      do: 'Short course and quiz: the spotter’s job and the four calls.', why: 'FPV pilots can’t see around themselves; at an event a spotter stands beside every pilot.',
      lessons: [{ id: 'gs-spt-01', t: 'The spotter’s job' }, { id: 'gs-spt-02', t: 'What to call' }] },
    { id: 'event-ops', quiz: 'gs-evt-quiz', tier: 't2', track: 'know', type: 'witnessed', name: 'Event Ops', est: 'about 40 min',
      do: 'Course and quiz, then run a real flight-zone setup.', why: 'Flying at a game or rally, and a plan for when it goes wrong.',
      lessons: [{ id: 'gs-asp-01', t: 'Class B, 400 ft and Sky Harbor' }, { id: 'gs-asp-02', t: 'B4UFLY, LAANC and TRUST' }, { id: 'gs-evt-01', t: 'The flight zone' }, { id: 'gs-evt-02', t: 'Briefing bystanders' }, { id: 'gs-evt-03', t: 'Pilot and spotter call-outs' }, { id: 'gs-emg-01', t: 'Failsafe: set it, test it' }, { id: 'gs-emg-02', t: 'Flyaway and lost video' }, { id: 'gs-emg-03', t: 'LiPo fire and injury' }, { id: 'gs-emg-04', t: 'The incident report' }, { id: 'gs-emg-05', t: 'Scenario drill', drill: true }],
      reqs: [{ t: 'Airspace: what the mentor checks', lessons: ['gs-asp-01', 'gs-asp-02'] },
             { t: 'The zone, the brief and the calls', lessons: ['gs-evt-01', 'gs-evt-02', 'gs-evt-03'] },
             { t: 'When it goes wrong', d: 'failsafe, flyaway, fire, the report', lessons: ['gs-emg-01', 'gs-emg-02', 'gs-emg-03', 'gs-emg-04', 'gs-emg-05'], v: VID.failsafe },
             { t: 'Event Ops quiz (80 %)', lessons: ['gs-evt-quiz'] },
             { t: 'A real setup for a mentor', d: 'zone marked and briefed, failsafe tested' }] },
    { id: 'cinematography', tier: 't2', track: 'crew', type: 'witnessed', name: 'Cinematography', est: 'one event',
      do: 'Plan and shoot one usable clip at a real event.', why: 'Shooters for Best of Brophy.',
      reqs: [{ t: 'A shot list agreed with the coach or moderator' },
             { t: 'A follow shot', v: VID.follow },
             { t: 'An orbit', v: VID.orbit },
             { t: 'A reveal', v: VID.cine },
             { t: 'A clip the editor accepts' }] },
    { id: 'indoor-proximity', tier: 't2', track: 'flight', type: 'witnessed', name: 'Indoor Proximity', est: 'one flight · about 10 min', rule: ONE_GO,
      do: 'The hallway course without touching a wall.', why: 'Precision in tight spaces, for the rally race.',
      reqs: [{ t: 'The club hallway course on one battery', v: VID.whoopIn },
             { t: 'Zero wall contact', v: VID.throttle }] },
    { id: 'racing', tier: 't2', track: 'flight', type: 'witnessed', name: 'Racing', est: 'one flight · about 10 min', rule: ONE_GO,
      do: '3 clean laps of the club course under the posted time.', why: 'Qualifies you for the rally race.',
      reqs: [{ t: 'Clean race lines', v: VID.lines },
             { t: 'Three clean laps in a row' },
             { t: 'Under the posted time, timed by the mentor', v: VID.faster }] },
    { id: 'event-pilot', tier: 't2', track: 'flight', type: 'witnessed', name: 'Event Pilot', checkpoint: true, est: 'one event',
      do: 'Checkpoint into Tier 3: fly at a school event or a race.', why: 'The top of the path: flying for the school.',
      reqs: [{ t: 'Zone set up and briefed' },
             { t: 'A spotter beside you' },
             { t: 'A mentor on site signs it off' }] },

    // ---------------- Flight Clearance (tier 'cl', 2026-10-20) - the Brophy Drone Certification.
    // Four parts on ../clearance/; never a tier, never counted. Order here is the page order.
    { id: 'faa-trust', tier: 'cl', track: 'know', type: 'bench', name: 'FAA TRUST', est: 'about 20 min',
      do: 'Take the free TRUST test and send a photo of the certificate.', why: 'Federal requirement for every recreational flyer, before the first real flight.',
      steps: [{ t: 'Take the free TRUST test (link below - about 20 min, cannot be failed)', v: VID.trust }, 'Submit a photo or PDF of the certificate, name readable'] },
    { id: 'safe-flight', quiz: 'gs-saf-quiz', tier: 'cl', track: 'know', type: 'knowledge', name: 'Safe Flight', est: 'about 10 min',
      do: 'Know and follow the Brophy FPV safe-flight rules.', why: 'The baseline code of conduct for real hardware.',
      lessons: [{ id: 'gs-saf-01', t: "Who's flying, who's watching" }, { id: 'gs-saf-02', t: 'The Brophy FPV rules sheet' }, { id: 'gs-saf-03', t: 'Go / No-Go', drill: true }] },
    { id: 'pilot-agreement', tier: 'cl', track: 'know', type: 'bench', kind: 'paper', name: 'Pilot Agreement', est: 'about 10 min, plus a parent',
      do: 'Read the terms, print the signing paper, sign it with a parent, send a photo of it.',
      why: 'A simple, clear reminder that you are flying expensive equipment and are responsible for how you use it - signed by you and a parent or guardian, as Mr. Reasy and Mr. Burr asked.',
      steps: ['Read the terms', 'Print the signing paper (one page) and sign it with a parent or guardian', 'Submit a photo of the signed paper'] },
    { id: 'drone-portfolio', tier: 'cl', track: 'flight', type: 'bench', kind: 'drone', name: 'Drone Portfolio', est: 'a minute of video per drone',
      do: 'Your personal portfolio of drones we know you can fly safely, so you can have permission to fly them at Brophy. Club drones are added upon checkpoint completion.',
      why: 'Clearance is per aircraft, for every pilot - DJI, FPV, anything: the club knows what you fly and has seen you fly it safely.',
      steps: ['Record about a minute: take off, fly, land safely', 'Upload it to Google Drive, shared as "Anyone with the link"', 'Add the drone: name, specs, a picture and the link'] },

    // ---------------- Bonus badges (tier 'el') - never counted toward the total or the tier
    { id: 'editing', tier: 'el', track: 'crew', type: 'witnessed', name: 'Editing', est: 'about 1 h',
      do: 'Cut and grade a 30–60 s clip from D-log.', why: 'Best of Brophy doesn’t depend on one editor.',
      reqs: [{ t: 'Cut to 30–60 seconds' },
             { t: 'Colour-graded from D-log', v: VID.grade },
             { t: 'Delivered to the editor' }] },
    { id: 'tuning', tier: 'el', track: 'build', type: 'bench', name: 'Tuning', est: 'about 30 min',
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
    'betaflight-intro': [{ tip: 'Calibrate on a flat table, drone still - the goggles horizon depends on it.' }, { t: 'BetaFPV: binding the Meteor', u: 'https://support.betafpv.com/hc/en-us' }],
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
    'pilot-agreement': [{ tip: 'Kept simple on purpose: a reminder of responsibility that you and a parent sign, not a legal contract.' }],
    'drone-portfolio': [{ tip: 'Film from the ground with a phone: take-off, a minute of flying, a landing on the pad.' }, { tip: 'In Drive: Share > General access > Anyone with the link. The page checks the link before you send it.' }, { t: 'Google Drive: share a file with a link', u: 'https://support.google.com/drive/answer/2494822' }],
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

  window.FS = { TIERS: TIERS, TRACK: TRACK, BADGES: B, LESSON_TITLES: LESSON_TITLES, CLUB_DRONES: CLUB_DRONES, slug: slug, PASS: 80, SIM_HOURS: 5 /* suggested, not a gate (2026-10-15) */,
    API: 'https://brophy-fpv-club-api.netlify.app',
    /* bonus and clearance badges are never counted toward a pilot's total (2026-10-20) */
    counted: function (b) { return b.tier !== 'el' && b.tier !== 'cl'; },
    /* the Flight Clearance parts, in page order */
    clearance: function () { return B.filter(function (b) { return b.tier === 'cl'; }); },
    /* the other badges of a checkpoint's tier */
    mates: function (b) { return B.filter(function (x) { return x !== b && x.tier === b.tier && !x.checkpoint; }); },
    /* a photo can be submitted for any badge a mentor signs off */
    photoOk: function (b) { return b.type === 'bench' || b.type === 'witnessed'; },
    /* a bench step is a string or { t, v } (2026-10-11) */
    stepText: function (st) { return typeof st === 'string' ? st : (st && st.t) || ''; },
    /* quiz AND a mentor's sign-off (2026-10-10) */
    both: function (b) { return !!b.quiz && b.type !== 'knowledge'; } };
})();
