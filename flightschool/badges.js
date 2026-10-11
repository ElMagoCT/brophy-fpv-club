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

  var B = [
    // ---------------- Tier 0 · Simulator -> checkpoint Tiny Whoop
    { id: 'proficient-flight', tier: 't0', track: 'flight', type: 'witnessed', name: 'Sim Flight', minHours: 5, est: 'about 6 h',
      do: 'Log 5 hours in the simulator, then fly a checkride for a mentor: an orbit, a Split-S, gaps, and a finished race.', why: 'Acro muscle memory where crashes cost nothing, then proof of real control. Sim-only, so it can gate the first real flight.',
      prep: ['gs-fly-01', 'gs-fly-02', 'gs-fly-03', 'gs-fly-04'],
      standard: 'Only once the kiosk shows 5 h across the five flight sims (Ground School time does not count). Then a mentor watches you in Liftoff: a clean orbit around a gate, a Split-S, three gaps without a crash, and a finished race.' },
    { id: 'spotter', quiz: 'gs-spt-quiz', tier: 't0', track: 'crew', type: 'witnessed', name: 'Spotter', est: 'about 1 h',
      do: 'Do the short Spotter course and pass its quiz, then spot a real flight for a mentor: check the field, keep eyes on the aircraft and call hazards. Do it before anything else - you will spot for others long before you fly.', why: 'FPV pilots can’t see around themselves.',
      lessons: [{ id: 'gs-spt-01', t: 'The spotter’s job' }, { id: 'gs-spt-02', t: 'What to call' }],
      standard: 'Quiz passed first (80 %). Then spot a real flight for a mentor: check the field before the battery goes in, keep eyes on the aircraft the whole battery, and call every person and obstacle before the pilot needs to know. The mentor checks the airspace; you check the field.' },
    { id: 'safe-flight', quiz: 'gs-saf-quiz', tier: 't0', track: 'know', type: 'knowledge', name: 'Safe Flight', est: 'about 20 min',
      do: 'Know and follow the Brophy FPV safe-flight rules.', why: 'The baseline code of conduct for real hardware.',
      lessons: [{ id: 'gs-saf-01', t: "Who's flying, who's watching" }, { id: 'gs-saf-02', t: 'The Brophy FPV rules sheet' }, { id: 'gs-saf-03', t: 'Go / No-Go', drill: true }] },
    { id: 'battery-care', quiz: 'gs-bat-quiz', tier: 't0', track: 'build', type: 'knowledge', name: 'Battery Care', est: 'about 20 min',
      do: 'Balance-charge, store at storage voltage, spot a puffed pack, explain disposal.', why: 'LiPos are the biggest real fire risk in the hobby.',
      lessons: [{ id: 'gs-bat-01', t: 'LiPo basics' }, { id: 'gs-bat-02', t: 'Battery math', drill: true }, { id: 'gs-bat-03', t: 'Charging, storage and disposal' }, { id: 'gs-bat-04', t: 'When a pack goes bad' }] },
    { id: 'building', tier: 't0', track: 'build', type: 'bench', name: 'Building', est: 'about 3 h',
      do: 'Rebuild a disassembled Meteor 75 Pro, with every prop on the right way round.', why: 'Members can fix what they break.',
      steps: ['Parts checklist: frame, FC/ESC stack, motors, RX, VTX, camera, antenna, props, strap', 'Motors on — right screw length, no screw touching a winding', 'Plug in the motors', 'Assemble it and put the canopy on', 'Plug in the canopy', 'Test: the motors beep and the camera turns on', 'Props on the right way: each prop matches the way its motor spins (props in or props out, as Betaflight is set), leading edge first, two pairs of mirror-image props on opposite corners', PHOTO] },
    { id: 'betaflight', tier: 't0', track: 'build', type: 'bench', name: 'Betaflight', est: 'about 1 h',
      do: 'Set motor direction and order, finish the OSD (battery usage and amp draw, positioned), set rates and the arm switch, and bind.', why: 'Most “won’t fly” problems get solved here.',
      steps: ['Props OFF, battery OUT, USB only', 'Connect — the kiosk reads the board and firmware', 'Flash the practice config: a lightly messed-up drone, missing the things you need to set', 'Receiver: protocol', 'Modes: ARM and angle on the switches; set the rates', 'Motors: order and direction (props off!)', 'OSD: add battery usage and amp draw, and position them', 'Check my work — the kiosk diffs against the stock config', 'Bind last, with the plug/unplug method', PHOTO],
      note: 'Practised on the club Meteor 75 Pro at the kiosk, which checks the result against a stock config.' },
    { id: 'line-of-sight', tier: 't0', track: 'flight', type: 'witnessed', name: 'Line of Sight', est: 'about 30 min',
      do: 'Without goggles: take off, hover and land a whoop in angle mode. Level flying only, supervised.', why: 'If video cuts out, the pilot can still level out and land - and it builds throttle control.',
      prep: ['gs-los-01', 'gs-los-02', 'gs-los-03'],
      standard: 'A mentor stands beside you: a controlled take-off to head height, a 20-second hover without drifting much, a lap around a tree, and a smooth landing.' },
    { id: 'tiny-whoop', tier: 't0', track: 'flight', type: 'witnessed', name: 'Tiny Whoop', checkpoint: true, est: 'about 2 h',
      do: 'Checkpoint into Tier 1: your first real flight. Once every prerequisite is ticked, fly the Meteor 75 Pro in goggles for a mentor.', why: 'First real flight, on a sub-250 g drone that can’t do much damage. Pass it and you are a Tier 1 pilot.',
      standard: 'In goggles on the Meteor: take-off, a figure-eight through two gates, an orbit, and a landing on the pad, no wall contact.' },

    // ---------------- Tier 1 · Tiny Whoop -> checkpoint Pavo 20 Pro Flight
    { id: 'soldering', tier: 't1', track: 'build', type: 'bench', name: 'Soldering', est: 'about 1.5 h',
      do: 'Solder an ESC and motors, then spin the motors in Betaflight.', why: 'Core electronics skill that transfers to robotics.',
      steps: ['Iron at the right temperature, tip tinned', 'Tin the pad, tin the wire, join', 'ESC pads: shiny, no bridges', 'Motor wires: all three, trimmed', 'Spin each motor in Betaflight (props off)', PHOTO] },
    { id: 'electrical-components', quiz: 'gs-elc-quiz', tier: 't1', track: 'know', type: 'knowledge', name: 'Electrical Components', est: 'about 20 min',
      do: 'Test on choosing motors, ESCs, batteries and props for a given drone.', why: 'Why a 3-inch and a 5-inch need different parts.',
      lessons: [{ id: 'gs-elc-01', t: 'The six parts' }, { id: 'gs-elc-02', t: 'Motors, props and thrust', drill: true }, { id: 'gs-elc-03', t: 'Matching motor, ESC, prop and battery' }, { id: 'gs-elc-04', t: 'Why a 3-inch and a 5-inch differ' }] },
    { id: 'radio-protocol', quiz: 'gs-rad-quiz', tier: 't1', track: 'know', type: 'knowledge', name: 'Radio Protocol', est: 'about 35 min',
      do: 'Test on ELRS, analog and digital video, control links, range, antennas and interference, and a little of what light is.', why: 'Prevents dropouts and interference at events, and gives the editor footage they can use.',
      lessons: [{ id: 'gs-rad-01', t: 'Analog against digital' }, { id: 'gs-rad-02', t: 'Bands, channels and racing', drill: true }, { id: 'gs-rad-03', t: 'Antennas and diversity' }, { id: 'gs-rad-04', t: 'Control links: ELRS, Crossfire, binding, failsafe' }, { id: 'gs-rad-05', t: 'Interference at an event' }, { id: 'gs-rad-06', t: 'Digital video: goggles, recording and D-log' }] },
    { id: 'field-repair', tier: 't1', track: 'build', type: 'bench', name: 'Field Diagnostics', est: 'about 45 min',
      do: 'A mentor breaks three things - one on the radio, one in Betaflight, one mechanical or electrical - and you find and fix each one.', why: 'Keeps a shoot going instead of ending it.',
      steps: ['A mentor breaks three things without telling you what', 'Radio: find and fix the fault on the remote', 'Betaflight: find and fix the fault in the configuration', 'Mechanical or electrical: find and fix the fault on the aircraft', 'Explain each cause to the mentor', PHOTO] },
    { id: 'freestyle-flight', tier: 't1', track: 'flight', type: 'witnessed', name: 'Freestyle Flight', est: 'about 5 h',
      do: 'In the simulator: powerloop, trippy spin, tiny gaps, Matty flip.', why: 'Advanced control before flying expensive airframes.',
      prep: ['gs-trk-01', 'gs-trk-02', 'gs-trk-03', 'gs-trk-04'],
      standard: 'A mentor watches you in the simulator: a powerloop, a trippy spin, a Matty flip and three tiny gaps in one run.' },
    { id: 'pavo-flight', tier: 't1', track: 'flight', type: 'witnessed', name: 'Pavo 20 Pro Flight', checkpoint: true, est: 'about 1 h',
      do: 'Checkpoint into Tier 2: once every prerequisite is ticked, fly the Pavo 20 Pro for a mentor.', why: 'Your first full-size airframe. Pass it and you are a Tier 2 pilot.',
      standard: 'With a spotter and a mentor watching: take-off, a figure-eight, an orbit, a pass through a gate and a clean landing on the pad - no contact.' },

    // ---------------- Tier 2 · Full-size -> checkpoint Event Pilot
    { id: 'faa-trust', tier: 't2', track: 'know', type: 'bench', name: 'FAA TRUST', est: 'about 30 min',
      do: 'Take the free FAA TRUST test online (~20 min, cannot be failed), then submit a photo of your certificate.', why: 'Federal requirement for recreational flyers. Official.',
      steps: ['Take the free TRUST test (Pilot Institute link under Optional resources - about 20 minutes, it cannot be failed)', 'Save your certificate (PDF or screenshot) - keep a copy on your phone', 'Submit a photo of the certificate with your name readable - a mentor reviews it and passes or fails it.'] },
    { id: 'event-ops', quiz: 'gs-evt-quiz', tier: 't2', track: 'know', type: 'witnessed', name: 'Event Ops', est: 'about 1.5 h',
      do: 'Pass the Event Ops quiz, then show a mentor at a real setup: set up a flight zone, brief bystanders, keep flights away from crowds; demonstrate failsafe setup, flyaway response, LiPo fire procedure and incident reporting.',
      standard: 'Quiz passed first (80 %). Then at a real setup a mentor watches you mark and brief the zone, set and test failsafe, and talk through a flyaway and a LiPo fire. The mentor checks the airspace and permission.', why: 'Ground work before flying at a game or rally - starting with whether you may fly there at all (Brophy is just outside Sky Harbor’s Class B; a few blocks south is inside it) - and a plan for when something goes wrong.',
      lessons: [{ id: 'gs-asp-01', t: 'Class B, 400 ft and Sky Harbor' }, { id: 'gs-asp-02', t: 'B4UFLY, LAANC and TRUST' }, { id: 'gs-evt-01', t: 'The flight zone' }, { id: 'gs-evt-02', t: 'Briefing bystanders' }, { id: 'gs-evt-03', t: 'Pilot and spotter call-outs' }, { id: 'gs-emg-01', t: 'Failsafe: set it, test it' }, { id: 'gs-emg-02', t: 'Flyaway and lost video' }, { id: 'gs-emg-03', t: 'LiPo fire and injury' }, { id: 'gs-emg-04', t: 'The incident report' }, { id: 'gs-emg-05', t: 'Scenario drill', drill: true }] },
    { id: 'cinematography', tier: 't2', track: 'crew', type: 'witnessed', name: 'Cinematography', est: 'about 3 h',
      do: 'Write a shot list for a real event with a coach or moderator; frame a follow shot, an orbit and a reveal; deliver one usable clip.', why: 'Turns pilots into shooters for Best of Brophy who can work with other organizations professionally. Filming.',
      standard: 'A written shot list agreed with the coach or moderator and used on the day, and one clip with a follow, an orbit and a reveal that the editor accepts without re-shooting.' },
    { id: 'indoor-proximity', tier: 't2', track: 'flight', type: 'witnessed', name: 'Indoor Proximity', est: 'about 2 h',
      do: 'Fly a whoop through a hallway or doorway course without touching walls.', why: 'Precision in tight spaces — what an indoor rally race demands. Racing.',
      standard: 'The club hallway course, one battery, zero wall contact, a mentor counting.' },
    { id: 'racing', tier: 't2', track: 'flight', type: 'witnessed', name: 'Racing', est: 'about 4 h',
      do: '3 clean laps of the club course under a target time.', why: 'Gate discipline under pressure; qualifies a pilot for the rally race. Racing.',
      standard: 'Three consecutive clean laps under the posted target time, timed by a mentor.' },
    { id: 'event-pilot', tier: 't2', track: 'flight', type: 'witnessed', name: 'Event Pilot', checkpoint: true, est: 'one event',
      do: 'Checkpoint into Tier 3: fly at a real school event or a race, with a spotter, under a mentor. You earn it by flying there - once every prerequisite is ticked.', why: 'The top of the path: flying for the school, in front of people.',
      standard: 'At a real school event or race: the airspace checked, the zone set up and briefed, a spotter beside you, a mentor on site. The mentor signs it off afterwards.' },

    // ---------------- Bonus badges (tier 'el') - never counted toward the total or the tier
    { id: 'editing', tier: 'el', track: 'crew', type: 'witnessed', name: 'Editing', est: 'about 3 h',
      do: 'Cut and colour-grade a 30–60 second clip from D-log footage.', why: 'Best of Brophy doesn’t depend on one editor.',
      standard: 'A finished 30–60 s clip from D-log, graded, delivered to the editor.' },
    { id: 'tuning', tier: 'el', track: 'build', type: 'bench', name: 'Tuning', est: 'about 2 h',
      do: 'Fix an oscillation with PID or filter changes, with before/after footage.', why: 'The skill behind smooth cinematic footage.',
      steps: ['Before footage showing the oscillation', 'Blackbox or reasoning: P, D or filters?', 'One change at a time, test flight', 'After footage, clean', PHOTO] },
    { id: 'fleet-steward', tier: 'el', track: 'crew', type: 'witnessed', name: 'Fleet Steward', est: 'one semester',
      do: 'Run equipment check-in/out and a maintenance log for one semester.', why: 'Accountability for school-funded gear.',
      standard: 'A semester of the check-in/out sheet and maintenance log, reviewed by a mentor.' },
    { id: 'mentor', tier: 'el', track: 'crew', type: 'witnessed', name: 'Mentor', est: 'about a month', minTier: 2,
      do: 'Be a Tier 2 pilot with deep knowledge of the FAA rules, then coach a new member through their first two badges. A mentor who holds a badge may sign it off for others, with officer approval.', why: 'The program trains its own replacements, and defines who may sign badges off. Mentors watch for anything that would break the law, so club rules can stay simple.',
      standard: 'Tier 2 pilots only: every Tier 0 and Tier 1 badge earned. Deep knowledge of the FAA rules for recreational flying (most mentors hold a licence) - an officer judges it, no quiz. Then two badges earned by someone you coached, confirmed by them and an officer. With an officer’s approval, a mentor signs off the badges they hold and is given the instructor password.' }
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
    API: 'https://brophy-uav-api.netlify.app',
    counted: function (b) { return b.tier !== 'el'; },
    /* the other badges of a checkpoint's tier */
    mates: function (b) { return B.filter(function (x) { return x !== b && x.tier === b.tier && !x.checkpoint; }); },
    /* a photo can be submitted for any badge a mentor signs off */
    photoOk: function (b) { return b.type === 'bench' || b.type === 'witnessed'; },
    /* quiz AND a mentor's sign-off (2026-10-10) */
    both: function (b) { return !!b.quiz && b.type !== 'knowledge'; } };
})();
