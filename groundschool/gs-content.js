/* ===========================================================================
   FPV GROUND SCHOOL - CONTENT
   ---------------------------------------------------------------------------
   Data only. No behaviour. Three exports:

     GS_MODULES  one module per knowledge badge (five since 2026-10-06: Emergency Procedures folded into Event Ops, Video Systems into Radio Protocol; Airspace into Safe Flight, then on 2026-10-07 into Event Ops), plus FLY for the flight drills (Flight School v2, 2026-10-04; was seven modules before
                 M6 Checkride on purpose - the checkride stays last on screen)
     GS_COURSE   the twenty-two lessons, in order
     GS_QUIZ     the checkride question pool (M1-M5 only - tricks are not
                 gating knowledge and stay out of the checkride)

   THE LESSON IDS IN HERE MUST MATCH config.json EXACTLY, and both must stay
   frozen forever. A student's record is keyed by lesson id. Renaming a title
   is free; changing an id orphans every student's record of that lesson.
   Removing a lesson from config.json stops it appearing but does NOT delete
   anyone's progress - that is deliberate, and the same rule as a retired sim.

   Card copy is held to roughly 100 words per card on purpose. A turn on this
   machine is fifteen minutes and Ground School is competing with five flight
   simulators for it. If it reads like a textbook, nobody finishes it.
   =========================================================================== */

/* ---------------------------------------------------------------------------
   Sketch-idiom artwork. Ink strokes on cream, rust for the thing being
   pointed at, dashed for anything imaginary. Sized by viewBox, scaled by CSS.
   --------------------------------------------------------------------------- */
var GS_ART = {

  /* four motors seen from above, numbered, with spin directions */
  quadTop: '<svg viewBox="0 0 300 300">' +
    '<g stroke="var(--ink)" stroke-width="2.6" fill="none">' +
      '<path d="M96 96 L204 204 M204 96 L96 204"/>' +
      '<rect x="126" y="126" width="48" height="48" rx="3" fill="var(--paper-2)"/>' +
    '</g>' +
    '<g fill="none" stroke="var(--ink)" stroke-width="2">' +
      '<circle cx="88" cy="88" r="30"/><circle cx="212" cy="88" r="30"/>' +
      '<circle cx="88" cy="212" r="30"/><circle cx="212" cy="212" r="30"/>' +
    '</g>' +
    '<g fill="var(--rust)" font-family="var(--font-mono)" font-size="15">' +
      '<text x="205" y="222" text-anchor="middle">1</text>' +
      '<text x="205" y="98"  text-anchor="middle">2</text>' +
      '<text x="81"  y="222" text-anchor="middle">3</text>' +
      '<text x="81"  y="98"  text-anchor="middle">4</text>' +
    '</g>' +
    '<g stroke="var(--rust)" stroke-width="1.8" fill="none" opacity=".85">' +
      /* CW arrows on the 2/3 diagonal, CCW on the 1/4 diagonal */
      '<path d="M212 62 A26 26 0 0 1 238 88"/><path d="M232 80 L238 88 L230 93"/>' +
      '<path d="M88 238 A26 26 0 0 1 62 212"/><path d="M68 220 L62 212 L70 207"/>' +
      '<path d="M88 62 A26 26 0 0 0 62 88"/><path d="M68 80 L62 88 L70 93"/>' +
      '<path d="M212 238 A26 26 0 0 0 238 212"/><path d="M232 220 L238 212 L230 207"/>' +
    '</g>' +
    '<path d="M150 126 L150 60" stroke="var(--rust)" stroke-width="2.4" stroke-dasharray="6 4"/>' +
    '<path d="M142 72 L150 58 L158 72" fill="none" stroke="var(--rust)" stroke-width="2.4"/>' +
    '<text x="150" y="46" text-anchor="middle" font-family="var(--font-mono)" font-size="13" fill="var(--rust)" letter-spacing="2">NOSE</text>' +
    '</svg>',

  /* the two sticks, mode 2, labelled */
  sticksMode2: '<svg viewBox="0 0 320 190">' +
    '<g fill="none" stroke="var(--ink)" stroke-width="2.2">' +
      '<rect x="14" y="26" width="292" height="140" rx="8" fill="var(--paper-2)"/>' +
      '<circle cx="88" cy="98" r="40"/><circle cx="232" cy="98" r="40"/>' +
    '</g>' +
    '<g stroke="rgba(31,51,80,.35)" stroke-width="1.2">' +
      '<path d="M88 62 L88 134 M52 98 L124 98 M232 62 L232 134 M196 98 L268 98"/>' +
    '</g>' +
    '<circle cx="88" cy="98" r="9" fill="var(--rust)"/><circle cx="232" cy="98" r="9" fill="var(--rust)"/>' +
    '<g font-family="var(--font-mono)" font-size="10.5" fill="var(--ink-soft)" letter-spacing="1.4">' +
      '<text x="88" y="52" text-anchor="middle">THROTTLE</text>' +
      '<text x="88" y="158" text-anchor="middle">THROTTLE</text>' +
      '<text x="34" y="102">YAW</text><text x="128" y="102">YAW</text>' +
      '<text x="232" y="52" text-anchor="middle">PITCH</text>' +
      '<text x="232" y="158" text-anchor="middle">PITCH</text>' +
      '<text x="178" y="102">ROLL</text><text x="272" y="102">ROLL</text>' +
    '</g>' +
    '<text x="88" y="182" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--rust)">left stick</text>' +
    '<text x="232" y="182" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--rust)">right stick</text>' +
    '</svg>',

  /* a LiPo pack with its cells and the balance lead */
  lipo: '<svg viewBox="0 0 300 200">' +
    '<rect x="30" y="46" width="212" height="112" rx="6" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2.6"/>' +
    '<g stroke="var(--ink)" stroke-width="1.6" opacity=".55">' +
      '<path d="M83 46 L83 158 M136 46 L136 158 M189 46 L189 158"/>' +
    '</g>' +
    '<g font-family="var(--font-mono)" font-size="15" fill="var(--rust)" text-anchor="middle">' +
      '<text x="56" y="108">3.7</text><text x="109" y="108">3.7</text>' +
      '<text x="162" y="108">3.7</text><text x="215" y="108">3.7</text>' +
    '</g>' +
    '<g font-family="var(--font-mono)" font-size="9" fill="var(--ink-soft)" text-anchor="middle">' +
      '<text x="56" y="126">CELL 1</text><text x="109" y="126">CELL 2</text>' +
      '<text x="162" y="126">CELL 3</text><text x="215" y="126">CELL 4</text>' +
    '</g>' +
    '<g stroke="var(--rust)" stroke-width="2.4" fill="none">' +
      '<path d="M242 78 L272 78 L272 92"/><path d="M242 126 L272 126 L272 112"/>' +
    '</g>' +
    '<g stroke="var(--ink)" stroke-width="1.5" fill="none" opacity=".7">' +
      '<path d="M30 70 L8 70 M30 80 L8 80 M30 90 L8 90 M30 100 L8 100 M30 110 L8 110"/>' +
    '</g>' +
    '<text x="2" y="42" font-family="var(--font-hand)" font-size="12" fill="var(--ink-soft)">balance</text>' +
    '<text x="136" y="34" text-anchor="middle" font-family="var(--font-mono)" font-size="13" fill="var(--ink)" letter-spacing="2.4">4S = 14.8 V NOMINAL</text>' +
    '<text x="136" y="180" text-anchor="middle" font-family="var(--font-hand)" font-size="16" fill="var(--rust)">four cells, in series</text>' +
    '</svg>',

  /* the video chain: quad -> air -> goggles */
  videoChain: '<svg viewBox="0 0 320 180">' +
    '<g fill="none" stroke="var(--ink)" stroke-width="2.2">' +
      '<rect x="16" y="62" width="72" height="52" rx="4" fill="var(--paper-2)"/>' +
      '<path d="M52 62 L52 34"/><circle cx="52" cy="27" r="8"/>' +
      '<rect x="228" y="60" width="76" height="46" rx="7" fill="var(--paper-2)"/>' +
      '<path d="M266 60 L266 34"/><circle cx="266" cy="27" r="8"/>' +
      '<circle cx="248" cy="83" r="11"/><circle cx="284" cy="83" r="11"/>' +
    '</g>' +
    '<g stroke="var(--rust)" stroke-width="1.7" fill="none" opacity=".9">' +
      '<path d="M64 34 Q104 12 144 34 Q184 56 224 34"/>' +
      '<path d="M64 44 Q104 22 144 44 Q184 66 224 44" opacity=".5"/>' +
    '</g>' +
    '<text x="144" y="16" text-anchor="middle" font-family="var(--font-mono)" font-size="12" fill="var(--rust)" letter-spacing="2.2">5.8 GHz</text>' +
    '<text x="52" y="132" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.4">VTX</text>' +
    '<text x="266" y="126" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.4">GOGGLES</text>' +
    '<text x="160" y="166" text-anchor="middle" font-family="var(--font-hand)" font-size="16" fill="var(--ink-soft)">one-way. nothing comes back.</text>' +
    '</svg>',

  /* omni vs patch coverage */
  antennas: '<svg viewBox="0 0 320 200">' +
    '<g transform="translate(78,120)">' +
      '<circle cx="0" cy="0" r="42" fill="rgba(28,85,120,.14)" stroke="var(--sky)" stroke-width="1.8" stroke-dasharray="5 4"/>' +
      '<path d="M0 0 L0 -34" stroke="var(--ink)" stroke-width="2.4"/>' +
      '<circle cx="0" cy="-38" r="6" fill="none" stroke="var(--ink)" stroke-width="2"/>' +
      '<text x="0" y="62" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--sky)" letter-spacing="1.6">OMNI</text>' +
      '<text x="0" y="78" text-anchor="middle" font-family="var(--font-hand)" font-size="13" fill="var(--ink-soft)">all round, not far</text>' +
    '</g>' +
    '<g transform="translate(232,120)">' +
      '<path d="M0 0 L-52 -68 A86 86 0 0 1 52 -68 Z" fill="rgba(143,61,18,.14)" stroke="var(--rust)" stroke-width="1.8" stroke-dasharray="5 4"/>' +
      '<rect x="-13" y="-12" width="26" height="12" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2.2"/>' +
      '<text x="0" y="62" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--rust)" letter-spacing="1.6">PATCH</text>' +
      '<text x="0" y="78" text-anchor="middle" font-family="var(--font-hand)" font-size="13" fill="var(--ink-soft)">far, but only there</text>' +
    '</g>' +
    '<text x="160" y="22" text-anchor="middle" font-family="var(--font-mono)" font-size="11.5" fill="var(--ink)" letter-spacing="2.2">DIVERSITY RUNS BOTH AT ONCE</text>' +
    '</svg>',

  /* the 400 ft shelf */
  ceiling: '<svg viewBox="0 0 320 200">' +
    '<path d="M8 168 L312 168" stroke="var(--ink)" stroke-width="2.4"/>' +
    '<g stroke="var(--line-hard)" stroke-width="1.2">' +
      '<path d="M14 168 l-6 9 M44 168 l-6 9 M74 168 l-6 9 M104 168 l-6 9 M134 168 l-6 9 M164 168 l-6 9 M194 168 l-6 9 M224 168 l-6 9 M254 168 l-6 9 M284 168 l-6 9 M312 168 l-6 9"/>' +
    '</g>' +
    '<path d="M8 62 L312 62" stroke="var(--rust)" stroke-width="2.4" stroke-dasharray="9 6"/>' +
    '<text x="12" y="52" font-family="var(--font-mono)" font-size="13" fill="var(--rust)" letter-spacing="2.4">400 FT AGL - CEILING</text>' +
    '<g stroke="var(--ink-soft)" stroke-width="1.6" fill="none">' +
      '<path d="M28 168 L28 62"/><path d="M23 70 L28 60 L33 70"/><path d="M23 160 L28 170 L33 160"/>' +
    '</g>' +
    '<g transform="translate(150,116)" stroke="var(--ink)" stroke-width="2.2" fill="none">' +
      '<path d="M-16 0 L16 0"/><path d="M-22 -7 L-10 -7 M10 -7 L22 -7"/>' +
      '<path d="M-16 0 L-16 -6 M16 0 L16 -6"/>' +
    '</g>' +
    '<g transform="translate(252,90)" opacity=".8">' +
      '<path d="M-18 0 L18 0 M0 -9 L0 9 M12 -5 L12 5" stroke="var(--sky)" stroke-width="2.2" fill="none"/>' +
    '</g>' +
    '<text x="252" y="76" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--sky)">give way. always.</text>' +
    '<text x="160" y="192" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">and never over people</text>' +
    '</svg>',

  /* the six parts, exploded */
  sixParts: '<svg viewBox="0 0 300 250">' +
    '<g fill="none" stroke="var(--ink)" stroke-width="2.2">' +
      '<path d="M60 176 L150 226 L240 176" stroke-dasharray="4 4" opacity=".45"/>' +
      '<rect x="96" y="40" width="108" height="26" rx="4" fill="var(--paper-2)"/>' +
      '<rect x="112" y="90" width="76" height="22" rx="3" fill="var(--paper-2)"/>' +
      '<rect x="112" y="130" width="76" height="20" rx="3" fill="var(--paper-2)"/>' +
      '<path d="M76 186 L224 186 M76 186 L150 216 L224 186"/>' +
      '<circle cx="76" cy="186" r="13"/><circle cx="224" cy="186" r="13"/>' +
    '</g>' +
    '<g font-family="var(--font-mono)" font-size="10.5" fill="var(--rust)" letter-spacing="1.4">' +
      '<text x="212" y="57">BATTERY</text>' +
      '<text x="196" y="105">FC</text>' +
      '<text x="196" y="145">ESC</text>' +
      '<text x="240" y="206">MOTOR</text>' +
      '<text x="26" y="206">FRAME</text>' +
    '</g>' +
    '<g stroke="var(--ink)" stroke-width="2" fill="none">' +
      '<path d="M150 150 L150 168"/><path d="M60 152 L60 130 L112 130" stroke-dasharray="3 3" opacity=".5"/>' +
      '<path d="M52 120 L52 100"/><circle cx="52" cy="94" r="6"/>' +
      '<rect x="36" y="120" width="32" height="14" rx="2" fill="var(--paper-2)"/>' +
    '</g>' +
    '<text x="10" y="150" font-family="var(--font-mono)" font-size="10.5" fill="var(--rust)" letter-spacing="1.4">RX</text>' +
    '<text x="150" y="244" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">six parts. that is the whole aircraft.</text>' +
    '</svg>',

  /* nose-in reversal */
  noseIn: '<svg viewBox="0 0 300 220">' +
    '<circle cx="150" cy="196" r="9" fill="var(--ink)"/>' +
    '<text x="150" y="216" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.6">YOU</text>' +
    '<g transform="translate(86,86)">' +
      '<g stroke="var(--ink)" stroke-width="2.4" fill="none"><path d="M-13 -13 L13 13 M13 -13 L-13 13"/></g>' +
      '<circle cx="-13" cy="-13" r="6" fill="none" stroke="var(--ink-soft)" stroke-width="1.6"/>' +
      '<circle cx="13" cy="-13" r="6" fill="none" stroke="var(--ink-soft)" stroke-width="1.6"/>' +
      '<circle cx="-13" cy="13" r="6" fill="var(--green)"/><circle cx="13" cy="13" r="6" fill="var(--green)"/>' +
      '<path d="M0 -12 L-6 -26 L6 -26 Z" fill="var(--green)"/>' +
      '<text x="0" y="-36" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" fill="var(--green)" letter-spacing="1.2">NOSE AWAY</text>' +
      '<path d="M20 4 L46 4" stroke="var(--green)" stroke-width="2.2"/><path d="M40 -2 L46 4 L40 10" fill="none" stroke="var(--green)" stroke-width="2.2"/>' +
      '<text x="33" y="24" text-anchor="middle" font-family="var(--font-hand)" font-size="13" fill="var(--green)">push right,</text>' +
      '<text x="33" y="38" text-anchor="middle" font-family="var(--font-hand)" font-size="13" fill="var(--green)">goes right</text>' +
    '</g>' +
    '<g transform="translate(214,86)">' +
      '<g stroke="var(--ink)" stroke-width="2.4" fill="none"><path d="M-13 -13 L13 13 M13 -13 L-13 13"/></g>' +
      '<circle cx="-13" cy="-13" r="6" fill="none" stroke="var(--ink-soft)" stroke-width="1.6"/>' +
      '<circle cx="13" cy="-13" r="6" fill="none" stroke="var(--ink-soft)" stroke-width="1.6"/>' +
      '<circle cx="-13" cy="13" r="6" fill="var(--rust)"/><circle cx="13" cy="13" r="6" fill="var(--rust)"/>' +
      '<path d="M0 12 L-6 26 L6 26 Z" fill="var(--rust)"/>' +
      '<text x="0" y="-30" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" fill="var(--rust)" letter-spacing="1.2">NOSE IN</text>' +
      '<path d="M-20 4 L-46 4" stroke="var(--rust)" stroke-width="2.2"/><path d="M-40 -2 L-46 4 L-40 10" fill="none" stroke="var(--rust)" stroke-width="2.2"/>' +
      '<text x="-30" y="26" text-anchor="middle" font-family="var(--font-hand)" font-size="13" fill="var(--rust)">push right,</text>' +
      '<text x="-30" y="40" text-anchor="middle" font-family="var(--font-hand)" font-size="13" fill="var(--rust)">goes LEFT</text>' +
    '</g>' +
    '</svg>',

  /* the two jobs on a flight line (the timer went 2026-10-10) */
  threeJobs: '<svg viewBox="0 0 320 210">' +
    '<g stroke="var(--ink)" stroke-width="2" fill="none">' +
      '<path d="M14 168 L306 168"/>' +
    '</g>' +
    '<g stroke="var(--line-hard)" stroke-width="1.1">' +
      '<path d="M22 168 l-6 9 M62 168 l-6 9 M102 168 l-6 9 M142 168 l-6 9 M182 168 l-6 9 M222 168 l-6 9 M262 168 l-6 9 M302 168 l-6 9"/>' +
    '</g>' +
    /* pilot */
    '<g transform="translate(100,140)">' +
      '<circle cx="0" cy="-30" r="9" fill="var(--rust)"/>' +
      '<path d="M0 -21 L0 0 M-11 -12 L11 -12 M0 0 L-8 22 M0 0 L8 22" stroke="var(--rust)" stroke-width="2.6" fill="none"/>' +
      '<rect x="-13" y="-16" width="26" height="9" rx="2" fill="var(--paper-2)" stroke="var(--rust)" stroke-width="1.8"/>' +
      '<text x="0" y="42" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" fill="var(--rust)" letter-spacing="1.4">PILOT</text>' +
    '</g>' +
    /* spotter, eyes up */
    '<g transform="translate(190,140)">' +
      '<circle cx="0" cy="-30" r="9" fill="none" stroke="var(--ink)" stroke-width="2.2"/>' +
      '<path d="M0 -21 L0 0 M-11 -14 L9 -22 M0 0 L-8 22 M0 0 L8 22" stroke="var(--ink)" stroke-width="2.6" fill="none"/>' +
      '<path d="M12 -30 L38 -46" stroke="var(--sky)" stroke-width="1.6" stroke-dasharray="4 3"/>' +
      '<text x="0" y="42" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" fill="var(--ink)" letter-spacing="1.4">SPOTTER</text>' +
    '</g>' +
    /* the aircraft, out front */
    '<g transform="translate(268,58)" stroke="var(--ink)" stroke-width="2" fill="none">' +
      '<path d="M-14 0 L14 0"/><path d="M-19 -6 L-9 -6 M9 -6 L19 -6"/>' +
      '<path d="M-14 0 L-14 -5 M14 0 L14 -5"/>' +
    '</g>' +
    '<text x="160" y="26" text-anchor="middle" font-family="var(--font-mono)" font-size="11.5" fill="var(--ink)" letter-spacing="2.2">TWO JOBS, EVERY FLIGHT</text>' +
    '<text x="160" y="200" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">nobody walks out until DISARMED is called</text>' +
    '</svg>',

  /* the four calls, as a strip */
  callouts: '<svg viewBox="0 0 320 170">' +
    '<g font-family="var(--font-mono)" font-size="12" letter-spacing="2">' +
      '<rect x="16" y="20" width="288" height="26" fill="none" stroke="var(--rust)" stroke-width="1.8"/>' +
      '<text x="26" y="38" fill="var(--rust)">ARMING</text>' +
      '<text x="300" y="38" text-anchor="end" font-family="var(--font-hand)" font-size="14" fill="var(--ink-soft)">before the props spin</text>' +
      '<rect x="16" y="54" width="288" height="26" fill="none" stroke="var(--amber)" stroke-width="1.8"/>' +
      '<text x="26" y="72" fill="var(--amber)">TAKEOFF</text>' +
      '<text x="300" y="72" text-anchor="end" font-family="var(--font-hand)" font-size="14" fill="var(--ink-soft)">leaving the ground</text>' +
      '<rect x="16" y="88" width="288" height="26" fill="none" stroke="var(--amber)" stroke-width="1.8"/>' +
      '<text x="26" y="106" fill="var(--amber)">LANDING</text>' +
      '<text x="300" y="106" text-anchor="end" font-family="var(--font-hand)" font-size="14" fill="var(--ink-soft)">before you descend</text>' +
      '<rect x="16" y="122" width="288" height="26" fill="var(--green)" stroke="var(--green)" stroke-width="1.8"/>' +
      '<text x="26" y="140" fill="#fff">DISARMED</text>' +
      '<text x="300" y="140" text-anchor="end" font-family="var(--font-hand)" font-size="14" fill="#fff">props stopped. walk.</text>' +
    '</g>' +
    '</svg>',

  /* props off the bench */
  propsOff: '<svg viewBox="0 0 300 180">' +
    '<rect x="20" y="112" width="260" height="12" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2"/>' +
    '<path d="M40 124 L40 158 M260 124 L260 158" stroke="var(--ink)" stroke-width="2"/>' +
    /* quad body on the bench, no props */
    '<g transform="translate(150,96)">' +
      '<path d="M-30 0 L30 0 M-30 -8 L-30 0 M30 -8 L30 0" stroke="var(--ink)" stroke-width="3" fill="none"/>' +
      '<rect x="-13" y="-7" width="26" height="10" rx="2" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2"/>' +
      '<circle cx="-30" cy="-11" r="4.5" fill="none" stroke="var(--ink-soft)" stroke-width="1.8"/>' +
      '<circle cx="30" cy="-11" r="4.5" fill="none" stroke="var(--ink-soft)" stroke-width="1.8"/>' +
    '</g>' +
    /* the two props, set aside, circled */
    '<g transform="translate(66,52)">' +
      '<ellipse cx="0" cy="0" rx="22" ry="5" fill="var(--rust)" opacity=".85"/>' +
      '<ellipse cx="0" cy="0" rx="5" ry="22" fill="var(--rust-soft)" opacity=".7"/>' +
      '<circle cx="0" cy="0" r="26" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 4"/>' +
    '</g>' +
    '<g transform="translate(234,52)">' +
      '<ellipse cx="0" cy="0" rx="22" ry="5" fill="var(--rust)" opacity=".85"/>' +
      '<ellipse cx="0" cy="0" rx="5" ry="22" fill="var(--rust-soft)" opacity=".7"/>' +
      '<circle cx="0" cy="0" r="26" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 4"/>' +
    '</g>' +
    '<text x="150" y="24" text-anchor="middle" font-family="var(--font-mono)" font-size="11.5" fill="var(--green)" letter-spacing="2">PROPS OFF. EVERY TIME.</text>' +
    '<text x="150" y="174" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">a quad with props on is a loaded tool</text>' +
    '</svg>',

  /* LiPo safety: bag, hard surface, never unattended */
  lipoSafety: '<svg viewBox="0 0 320 180">' +
    '<rect x="30" y="70" width="110" height="66" rx="5" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2.4"/>' +
    '<path d="M30 86 L140 86" stroke="var(--ink)" stroke-width="1.6" stroke-dasharray="4 3"/>' +
    '<text x="85" y="80" text-anchor="middle" font-family="var(--font-mono)" font-size="8.5" fill="var(--ink-soft)" letter-spacing="1">FIRE BAG</text>' +
    '<rect x="52" y="98" width="30" height="18" rx="2" fill="var(--green)" opacity=".75"/>' +
    '<rect x="90" y="98" width="30" height="18" rx="2" fill="var(--green)" opacity=".75"/>' +
    '<path d="M20 136 L300 136" stroke="var(--ink)" stroke-width="2.4"/>' +
    '<g stroke="var(--line-hard)" stroke-width="1.1">' +
      '<path d="M28 136 l-6 9 M68 136 l-6 9 M108 136 l-6 9 M148 136 l-6 9 M188 136 l-6 9 M228 136 l-6 9 M268 136 l-6 9 M298 136 l-6 9"/>' +
    '</g>' +
    /* the puffed one, quarantined */
    '<g transform="translate(220,104)">' +
      '<path d="M-30 -16 Q0 -30 30 -16 Q36 0 30 16 Q0 30 -30 16 Q-36 0 -30 -16 Z" fill="rgba(143,61,18,.18)" stroke="var(--rust)" stroke-width="2.4"/>' +
      '<path d="M-16 -10 L16 10 M16 -10 L-16 10" stroke="var(--rust)" stroke-width="2.6"/>' +
    '</g>' +
    '<text x="220" y="146" text-anchor="middle" font-family="var(--font-mono)" font-size="9.5" fill="var(--rust)" letter-spacing="1.4">PUFFED = DONE</text>' +
    '<text x="160" y="26" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink)" letter-spacing="2">HARD SURFACE. IN A BAG. NEVER ALONE.</text>' +
    '<text x="160" y="48" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--rust)">water will not put this out. it makes its own oxygen.</text>' +
    '</svg>',

  /* the three go/no-go piles */
  goNoGo: '<svg viewBox="0 0 320 180">' +
    '<g stroke-width="2.2" fill="none">' +
      '<rect x="14" y="46" width="90" height="92" stroke="var(--green)"/>' +
      '<rect x="115" y="46" width="90" height="92" stroke="var(--amber)"/>' +
      '<rect x="216" y="46" width="90" height="92" stroke="var(--rust)"/>' +
    '</g>' +
    '<g font-family="var(--font-mono)" font-size="12" letter-spacing="1.6" text-anchor="middle">' +
      '<text x="59"  y="70" fill="var(--green)">FLY</text>' +
      '<text x="160" y="70" fill="var(--amber)">NOT YET</text>' +
      '<text x="261" y="70" fill="var(--rust)">NO FLY</text>' +
    '</g>' +
    '<g font-family="var(--font-hand)" font-size="13" fill="var(--ink-soft)" text-anchor="middle">' +
      '<text x="59"  y="96">nothing to</text><text x="59"  y="112">change</text>' +
      '<text x="160" y="96">one thing</text><text x="160" y="112">changes first</text>' +
      '<text x="261" y="96">not today,</text><text x="261" y="112">no workaround</text>' +
    '</g>' +
    '<g stroke="var(--ink)" stroke-width="1.6" fill="none" opacity=".55">' +
      '<path d="M160 20 L59 42 M160 20 L160 42 M160 20 L261 42"/>' +
    '</g>' +
    '<circle cx="160" cy="16" r="6" fill="var(--ink)"/>' +
    '<text x="160" y="170" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--rust)">the mistake is not sorting at all</text>' +
    '</svg>',

  /* how the motors make each movement */
  mixTable: '<svg viewBox="0 0 320 200">' +
    '<g font-family="var(--font-mono)" font-size="10" letter-spacing="1.2">' +
      '<text x="16" y="26" fill="var(--ink-soft)">MOVEMENT</text>' +
      '<text x="176" y="26" fill="var(--ink-soft)">WHICH MOTORS SPEED UP</text>' +
    '</g>' +
    '<path d="M14 32 L306 32" stroke="var(--ink)" stroke-width="1.6"/>' +
    '<g font-family="var(--font-body)" font-size="13" font-weight="500" fill="var(--ink)">' +
      '<text x="16" y="56">Climb</text><text x="16" y="88">Roll right</text>' +
      '<text x="16" y="120">Pitch forward</text><text x="16" y="152">Yaw right</text>' +
    '</g>' +
    '<g font-family="var(--font-hand)" font-size="15" fill="var(--rust)">' +
      '<text x="176" y="56">all four</text>' +
      '<text x="176" y="88">the two on the LEFT</text>' +
      '<text x="176" y="120">the two at the BACK</text>' +
      '<text x="176" y="152">the CCW diagonal pair</text>' +
    '</g>' +
    '<g stroke="rgba(31,51,80,.22)" stroke-width="1">' +
      '<path d="M14 66 L306 66 M14 98 L306 98 M14 130 L306 130"/>' +
    '</g>' +
    '<text x="160" y="182" text-anchor="middle" font-family="var(--font-hand)" font-size="14.5" fill="var(--ink-soft)">roll and pitch are about which SIDE. yaw is about spin.</text>' +
    '</svg>',

  /* analog degrades, digital falls off a cliff */
  failCurves: '<svg viewBox="0 0 320 200">' +
    '<g stroke="var(--ink)" stroke-width="1.8" fill="none">' +
      '<path d="M40 26 L40 160 L300 160"/>' +
    '</g>' +
    '<text x="34" y="22" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--ink-soft)">GOOD</text>' +
    '<text x="34" y="164" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--ink-soft)">GONE</text>' +
    '<text x="170" y="184" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.6">DISTANCE &rarr;</text>' +
    /* analog: a long slope */
    '<path d="M40 34 L120 48 L190 84 L250 128 L296 156" fill="none" stroke="var(--sky)" stroke-width="2.8"/>' +
    '<text x="120" y="42" font-family="var(--font-mono)" font-size="10" fill="var(--sky)" letter-spacing="1.2">ANALOG</text>' +
    /* digital: flat then a cliff */
    '<path d="M40 32 L206 32 L214 158 L296 158" fill="none" stroke="var(--rust)" stroke-width="2.8"/>' +
    '<text x="120" y="26" font-family="var(--font-mono)" font-size="10" fill="var(--rust)" letter-spacing="1.2">DIGITAL</text>' +
    '<path d="M214 96 L246 96" stroke="var(--rust)" stroke-width="1.4" stroke-dasharray="3 3"/>' +
    '<text x="250" y="100" font-family="var(--font-hand)" font-size="14" fill="var(--rust)">no warning</text>' +
    '<text x="150" y="120" font-family="var(--font-hand)" font-size="14" fill="var(--sky)">static = your gauge</text>' +
    '</svg>',

  /* raceband spacing against a packed band */
  raceband: '<svg viewBox="0 0 320 180">' +
    '<text x="16" y="28" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.4">A PACKED BAND - CHANNELS TOO CLOSE</text>' +
    '<path d="M16 56 L304 56" stroke="var(--ink)" stroke-width="1.6"/>' +
    '<g fill="var(--rust)">' +
      '<rect x="40" y="40" width="4" height="16"/><rect x="62" y="40" width="4" height="16"/>' +
      '<rect x="84" y="40" width="4" height="16"/><rect x="106" y="40" width="4" height="16"/>' +
      '<rect x="128" y="40" width="4" height="16"/><rect x="150" y="40" width="4" height="16"/>' +
      '<rect x="172" y="40" width="4" height="16"/><rect x="194" y="40" width="4" height="16"/>' +
    '</g>' +
    '<g fill="rgba(143,61,18,.22)">' +
      '<rect x="30" y="38" width="24" height="20"/><rect x="52" y="38" width="24" height="20"/>' +
      '<rect x="74" y="38" width="24" height="20"/><rect x="96" y="38" width="24" height="20"/>' +
    '</g>' +
    '<text x="230" y="52" font-family="var(--font-hand)" font-size="14" fill="var(--rust)">they bleed</text>' +
    '<text x="16" y="102" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.4">RACEBAND - SPREAD OUT ON PURPOSE</text>' +
    '<path d="M16 130 L304 130" stroke="var(--ink)" stroke-width="1.6"/>' +
    '<g fill="var(--green)">' +
      '<rect x="40" y="114" width="4" height="16"/><rect x="106" y="114" width="4" height="16"/>' +
      '<rect x="172" y="114" width="4" height="16"/><rect x="238" y="114" width="4" height="16"/>' +
    '</g>' +
    '<g font-family="var(--font-mono)" font-size="8.5" fill="var(--green)" text-anchor="middle">' +
      '<text x="42" y="146">R1</text><text x="108" y="146">R3</text>' +
      '<text x="174" y="146">R5</text><text x="240" y="146">R7</text>' +
    '</g>' +
    '<text x="160" y="170" text-anchor="middle" font-family="var(--font-hand)" font-size="14.5" fill="var(--ink-soft)">leave a gap and four of you can fly at once</text>' +
    '</svg>',

  /* the throttle sawtooth against a smooth trace */
  throttleTrace: '<svg viewBox="0 0 320 180">' +
    '<path d="M30 24 L30 150 L300 150" stroke="var(--ink)" stroke-width="1.8" fill="none"/>' +
    /* the beginner sawtooth */
    '<path d="M34 132 L52 40 L70 132 L88 44 L106 132 L124 38 L142 132 L160 46" ' +
      'fill="none" stroke="var(--rust)" stroke-width="2.4"/>' +
    '<text x="40" y="34" font-family="var(--font-mono)" font-size="9.5" fill="var(--rust)" letter-spacing="1.2">BANG-BANG</text>' +
    /* the smooth one */
    '<path d="M172 96 Q196 78 214 88 Q236 100 256 84 Q276 70 296 80" ' +
      'fill="none" stroke="var(--green)" stroke-width="2.8"/>' +
    '<text x="196" y="60" font-family="var(--font-mono)" font-size="9.5" fill="var(--green)" letter-spacing="1.2">SMOOTH</text>' +
    '<path d="M166 24 L166 150" stroke="rgba(31,51,80,.30)" stroke-width="1.2" stroke-dasharray="4 4"/>' +
    '<text x="18" y="90" text-anchor="end" font-family="var(--font-mono)" font-size="9" fill="var(--ink-soft)" transform="rotate(-90 18 90)">THROTTLE</text>' +
    '<text x="160" y="172" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">small and early beats big and late</text>' +
    '</svg>',

  /* the two sums, written out */
  batteryMath: '<svg viewBox="0 0 320 200">' +
    '<rect x="14" y="20" width="292" height="70" fill="none" stroke="var(--ink)" stroke-width="1.8"/>' +
    '<text x="26" y="40" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.6">HOW MUCH CAN IT GIVE</text>' +
    '<text x="26" y="66" font-family="var(--font-mono)" font-size="15" fill="var(--ink)">mAh</text>' +
    '<text x="70" y="66" font-family="var(--font-mono)" font-size="15" fill="var(--ink-soft)">/ 1000 &times;</text>' +
    '<text x="152" y="66" font-family="var(--font-mono)" font-size="15" fill="var(--ink)">C</text>' +
    '<text x="176" y="66" font-family="var(--font-mono)" font-size="15" fill="var(--ink-soft)">=</text>' +
    '<text x="200" y="66" font-family="var(--font-mono)" font-size="15" fill="var(--rust)">amps</text>' +
    '<text x="26" y="82" font-family="var(--font-hand)" font-size="13" fill="var(--ink-soft)">1500 / 1000 &times; 100C = 150 A</text>' +
    '<rect x="14" y="102" width="292" height="70" fill="none" stroke="var(--ink)" stroke-width="1.8"/>' +
    '<text x="26" y="122" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.6">HOW LONG WILL IT FLY</text>' +
    '<text x="26" y="148" font-family="var(--font-mono)" font-size="15" fill="var(--ink)">80%</text>' +
    '<text x="66" y="148" font-family="var(--font-mono)" font-size="15" fill="var(--ink-soft)">of Ah / amps &times; 60 =</text>' +
    '<text x="242" y="148" font-family="var(--font-mono)" font-size="15" fill="var(--rust)">minutes</text>' +
    '<text x="26" y="164" font-family="var(--font-hand)" font-size="13" fill="var(--ink-soft)">land with a reserve. never run a pack flat.</text>' +
    '<text x="160" y="192" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--rust)">two sums you will do forever</text>' +
    '</svg>',

  /* the hover box and small corrections */
  hoverBox: '<svg viewBox="0 0 320 200">' +
    '<rect x="70" y="52" width="180" height="60" fill="rgba(143,61,18,.10)" stroke="var(--rust)" stroke-width="1.8" stroke-dasharray="5 4"/>' +
    '<text x="76" y="46" font-family="var(--font-mono)" font-size="9.5" fill="var(--rust)" letter-spacing="1.4">HOLD IT IN HERE</text>' +
    '<line x1="70" y1="82" x2="250" y2="82" stroke="var(--rust)" stroke-width=".9" stroke-dasharray="2 5"/>' +
    /* aircraft */
    '<g transform="translate(160,86)">' +
      '<rect x="-11" y="-2" width="22" height="4" rx="1.4" fill="var(--ink)"/>' +
      '<line x1="-19" y1="-7" x2="-5" y2="-7" stroke="var(--rust)" stroke-width="2.4"/>' +
      '<line x1="5" y1="-7" x2="19" y2="-7" stroke="var(--rust)" stroke-width="2.4"/>' +
      '<line x1="-13" y1="-2" x2="-13" y2="-6" stroke="var(--ink)" stroke-width="1.5"/>' +
      '<line x1="13" y1="-2" x2="13" y2="-6" stroke="var(--ink)" stroke-width="1.5"/>' +
    '</g>' +
    /* the small correction arrows, all round it */
    '<g stroke="var(--green)" stroke-width="1.6" fill="none" opacity=".9">' +
      '<path d="M160 62 L160 72"/><path d="M156 68 L160 72 L164 68"/>' +
      '<path d="M160 108 L160 98"/><path d="M156 102 L160 98 L164 102"/>' +
      '<path d="M132 86 L142 86"/><path d="M138 82 L142 86 L138 90"/>' +
      '<path d="M188 86 L178 86"/><path d="M182 82 L178 86 L182 90"/>' +
    '</g>' +
    '<text x="252" y="90" font-family="var(--font-hand)" font-size="14" fill="var(--green)">tiny. constant.</text>' +
    '<line x1="16" y1="156" x2="304" y2="156" stroke="var(--ink)" stroke-width="2"/>' +
    '<g stroke="var(--line-hard)" stroke-width="1">' +
      '<path d="M24 156 l-5 8 M64 156 l-5 8 M104 156 l-5 8 M144 156 l-5 8 M184 156 l-5 8 M224 156 l-5 8 M264 156 l-5 8 M300 156 l-5 8"/>' +
    '</g>' +
    '<text x="160" y="186" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">a hover is kept, not set</text>' +
    '</svg>',

  /* the gate course, seen from where you stand */
  gateCourse: '<svg viewBox="0 0 320 210">' +
    '<g stroke="rgba(31,51,80,.12)" stroke-width=".8">' +
      '<path d="M20 24 H300 M20 60 H300 M20 96 H300 M20 132 H300 M20 168 H300 M20 24 V168 M76 24 V168 M132 24 V168 M188 24 V168 M244 24 V168 M300 24 V168"/>' +
    '</g>' +
    '<g stroke="var(--accent, var(--sky))" stroke-width="3.4">' +
      '<line x1="62" y1="120" x2="62" y2="146"/>' +
      '<line x1="62" y1="46"  x2="62" y2="72"/>' +
      '<line x1="150" y1="34" x2="176" y2="34"/>' +
      '<line x1="252" y1="76" x2="252" y2="102"/>' +
      '<line x1="184" y1="140" x2="210" y2="140"/>' +
      '<line x1="112" y1="92" x2="138" y2="92"/>' +
    '</g>' +
    '<g font-family="var(--font-mono)" font-size="9" fill="var(--sky)" font-weight="700">' +
      '<text x="48" y="137">1</text><text x="48" y="63">2</text>' +
      '<text x="160" y="26">3</text><text x="260" y="92">4</text>' +
      '<text x="194" y="156">5</text><text x="120" y="84">6</text>' +
    '</g>' +
    '<path d="M62 132 L62 60 L160 40 L250 88 L196 138 L124 96" fill="none" stroke="var(--rust)" stroke-width="1.4" stroke-dasharray="4 3" opacity=".85"/>' +
    /* the nose-in leg, called out */
    '<g transform="translate(124,96)">' +
      '<circle cx="0" cy="0" r="13" fill="none" stroke="var(--rust)" stroke-width="1.2" stroke-dasharray="2 3"/>' +
      '<path d="M0 6 L-4 16 L4 16 Z" fill="var(--rust)"/>' +
    '</g>' +
    '<text x="140" y="118" font-family="var(--font-hand)" font-size="13" fill="var(--rust)">nose back at you</text>' +
    '<g transform="translate(160,186)">' +
      '<circle cx="0" cy="0" r="6" fill="var(--ink)"/>' +
      '<path d="M-15 -7 A 15 15 0 0 1 15 -7" fill="none" stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 3" opacity=".5"/>' +
    '</g>' +
    '<text x="174" y="190" font-family="var(--font-mono)" font-size="9" fill="var(--ink-soft)" letter-spacing="1.2">YOU</text>' +
    '</svg>',

  /* how the checkride is scored */
  checkride: '<svg viewBox="0 0 320 170">' +
    '<text x="16" y="26" font-family="var(--font-mono)" font-size="10" fill="var(--ink-soft)" letter-spacing="1.6">100 POINTS, THREE PARTS</text>' +
    '<rect x="16" y="38" width="230" height="26" fill="var(--sky)" opacity=".85"/>' +
    '<rect x="248" y="38" width="29" height="26" fill="var(--rust)" opacity=".85"/>' +
    '<rect x="279" y="38" width="25" height="26" fill="var(--amber)" opacity=".85"/>' +
    '<g font-family="var(--font-mono)" font-size="10" fill="#fff">' +
      '<text x="26" y="56">16 QUESTIONS &middot; 80</text>' +
      '<text x="252" y="56">10</text><text x="283" y="56">10</text>' +
    '</g>' +
    '<g font-family="var(--font-hand)" font-size="13" fill="var(--ink-soft)">' +
      '<text x="16" y="84">every module, three or more each</text>' +
      '<text x="16" y="104">20-second hover hold &middot; 10 points</text>' +
      '<text x="16" y="122">five orientation rounds &middot; 10 points</text>' +
    '</g>' +
    '<path d="M16 134 L304 134" stroke="var(--ink)" stroke-width="1.4"/>' +
    '<path d="M246 30 L246 142" stroke="var(--green)" stroke-width="2.4"/>' +
    '<text x="252" y="88" font-family="var(--font-mono)" font-size="11" fill="var(--green)" letter-spacing="1.4">80 = PASS</text>' +
    '<text x="16" y="152" font-family="var(--font-hand)" font-size="14" fill="var(--rust)">you cannot pass this on reading alone</text>' +
    '</svg>',

  /* RHCP against LHCP */
  polarity: '<svg viewBox="0 0 320 180">' +
    '<g transform="translate(84,86)">' +
      '<path d="M-40 0 Q-30 -18 -20 0 Q-10 18 0 0 Q10 -18 20 0 Q30 18 40 0" fill="none" stroke="var(--green)" stroke-width="2.6"/>' +
      '<path d="M-40 8 Q-30 -10 -20 8 Q-10 26 0 8 Q10 -10 20 8 Q30 26 40 8" fill="none" stroke="var(--green)" stroke-width="2.6" opacity=".45"/>' +
      '<text x="0" y="-38" text-anchor="middle" font-family="var(--font-mono)" font-size="10.5" fill="var(--green)" letter-spacing="1.4">RHCP &rarr; RHCP</text>' +
      '<text x="0" y="46" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--green)">matched. full signal.</text>' +
    '</g>' +
    '<g transform="translate(236,86)">' +
      '<path d="M-40 0 Q-30 -18 -20 0 Q-10 18 0 0 Q10 -18 20 0 Q30 18 40 0" fill="none" stroke="var(--rust)" stroke-width="2.6"/>' +
      '<path d="M-40 8 Q-30 26 -20 8 Q-10 -10 0 8 Q10 26 20 8 Q30 -10 40 8" fill="none" stroke="var(--rust)" stroke-width="2.6" opacity=".45"/>' +
      '<text x="0" y="-38" text-anchor="middle" font-family="var(--font-mono)" font-size="10.5" fill="var(--rust)" letter-spacing="1.4">RHCP &rarr; LHCP</text>' +
      '<text x="0" y="46" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--rust)">most of it thrown away</text>' +
      '<path d="M-14 22 L14 22" stroke="var(--rust)" stroke-width="2"/>' +
    '</g>' +
    '<text x="160" y="24" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink)" letter-spacing="2">THE CORKSCREW HAS A HANDEDNESS</text>' +
    '<text x="160" y="170" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">match both ends. always.</text>' +
    '</svg>',

  /* what blocks a 5.8 GHz link */
  linkBlockers: '<svg viewBox="0 0 320 190">' +
    '<line x1="14" y1="158" x2="306" y2="158" stroke="var(--ink)" stroke-width="2"/>' +
    /* you, with your back turned */
    '<g transform="translate(46,132)">' +
      '<circle cx="0" cy="-22" r="8" fill="var(--ink)"/>' +
      '<path d="M0 -14 L0 6 M-9 -8 L9 -8 M0 6 L-7 26 M0 6 L7 26" stroke="var(--ink)" stroke-width="2.4" fill="none"/>' +
    '</g>' +
    /* blocked low path, through a fence and a tree */
    '<path d="M58 122 L250 128" stroke="var(--rust)" stroke-width="2" stroke-dasharray="5 4"/>' +
    '<g stroke="var(--ink-soft)" stroke-width="1.5">' +
      '<path d="M136 158 L136 108 M148 158 L148 108 M130 116 L154 116 M130 132 L154 132"/>' +
    '</g>' +
    '<text x="142" y="102" text-anchor="middle" font-family="var(--font-mono)" font-size="8" fill="var(--ink-soft)">FENCE</text>' +
    '<g><path d="M196 130 L186 156 L206 156 Z" fill="rgba(45,106,62,.5)"/><rect x="194" y="150" width="4" height="10" fill="var(--ink-soft)"/></g>' +
    '<path d="M150 118 L146 126 M156 122 L152 130" stroke="var(--rust)" stroke-width="2"/>' +
    /* clear high path */
    '<path d="M58 116 Q160 52 258 96" fill="none" stroke="var(--green)" stroke-width="2.4"/>' +
    '<text x="160" y="52" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--green)">go up and it clears</text>' +
    '<g transform="translate(262,96)" stroke="var(--green)" stroke-width="2" fill="none">' +
      '<path d="M-11 0 L11 0"/><path d="M-15 -5 L-7 -5 M7 -5 L15 -5"/>' +
    '</g>' +
    '<g transform="translate(254,128)" stroke="var(--rust)" stroke-width="2" fill="none">' +
      '<path d="M-11 0 L11 0"/><path d="M-15 -5 L-7 -5 M7 -5 L15 -5"/>' +
    '</g>' +
    '<text x="160" y="182" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--rust)">your own body counts too - turn around</text>' +
    '</svg>',

  /* antenna first, battery second */
  vtxAntenna: '<svg viewBox="0 0 320 180">' +
    '<g transform="translate(82,96)">' +
      '<rect x="-26" y="-16" width="52" height="34" rx="3" fill="var(--paper-2)" stroke="var(--ink)" stroke-width="2.2"/>' +
      '<path d="M0 -16 L0 -44" stroke="var(--ink)" stroke-width="2.4"/>' +
      '<circle cx="0" cy="-50" r="7" fill="none" stroke="var(--green)" stroke-width="2.4"/>' +
      '<text x="0" y="40" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--green)" letter-spacing="1.4">ANTENNA ON</text>' +
      '<text x="0" y="58" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--green)">then plug in</text>' +
    '</g>' +
    '<g transform="translate(238,96)">' +
      '<rect x="-26" y="-16" width="52" height="34" rx="3" fill="rgba(143,61,18,.14)" stroke="var(--rust)" stroke-width="2.2"/>' +
      '<path d="M0 -16 L0 -30" stroke="var(--rust)" stroke-width="2.4" stroke-dasharray="3 3"/>' +
      '<path d="M-10 -40 L10 -20 M10 -40 L-10 -20" stroke="var(--rust)" stroke-width="2.6"/>' +
      '<path d="M-18 -6 L-10 2 M18 -6 L10 2 M0 8 L0 18" stroke="var(--rust)" stroke-width="2"/>' +
      '<text x="0" y="40" text-anchor="middle" font-family="var(--font-mono)" font-size="10" fill="var(--rust)" letter-spacing="1.4">NO ANTENNA</text>' +
      '<text x="0" y="58" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--rust)">cooked in seconds</text>' +
    '</g>' +
    '<text x="160" y="26" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--ink)" letter-spacing="2">ANTENNA FIRST. BATTERY SECOND.</text>' +
    '</svg>',

  /* the four recovery steps */
  recoverSteps: '<svg viewBox="0 0 320 190">' +
    '<g font-family="var(--font-mono)" font-size="11.5" letter-spacing="2">' +
      '<rect x="16" y="24" width="288" height="30" fill="none" stroke="var(--ink)" stroke-width="1.8"/>' +
      '<text x="28" y="44" fill="var(--rust)">1  LEVEL</text>' +
      '<text x="296" y="44" text-anchor="end" font-family="var(--font-hand)" font-size="14" fill="var(--ink-soft)">centre pitch and roll</text>' +
      '<rect x="16" y="62" width="288" height="30" fill="none" stroke="var(--ink)" stroke-width="1.8"/>' +
      '<text x="28" y="82" fill="var(--rust)">2  HOLD</text>' +
      '<text x="296" y="82" text-anchor="end" font-family="var(--font-hand)" font-size="14" fill="var(--ink-soft)">altitude is thinking time</text>' +
      '<rect x="16" y="100" width="288" height="30" fill="none" stroke="var(--ink)" stroke-width="1.8"/>' +
      '<text x="28" y="120" fill="var(--rust)">3  YAW</text>' +
      '<text x="296" y="120" text-anchor="end" font-family="var(--font-hand)" font-size="14" fill="var(--ink-soft)">until the nose points away</text>' +
      '<rect x="16" y="138" width="288" height="30" fill="var(--green)" stroke="var(--green)" stroke-width="1.8"/>' +
      '<text x="28" y="158" fill="#fff">4  GO</text>' +
      '<text x="296" y="158" text-anchor="end" font-family="var(--font-hand)" font-size="14" fill="#fff">only now do you move</text>' +
    '</g>' +
    '</svg>',

  /* rate vs angle */
  rateAngle: '<svg viewBox="0 0 320 180">' +
    '<g transform="translate(80,60)">' +
      '<path d="M-46 0 L46 0" stroke="rgba(31,51,80,.30)" stroke-width="1.4" stroke-dasharray="4 4"/>' +
      '<g transform="rotate(-24)"><path d="M-30 0 L30 0" stroke="var(--ink)" stroke-width="3"/>' +
      '<path d="M-30 0 L-30 -7 M30 0 L30 -7" stroke="var(--ink)" stroke-width="2.4"/></g>' +
      '<path d="M34 22 A38 38 0 0 0 -34 22" fill="none" stroke="var(--green)" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<path d="M-28 16 L-34 24 L-26 27" fill="none" stroke="var(--green)" stroke-width="2"/>' +
      '<text x="0" y="54" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--green)" letter-spacing="1.6">ANGLE</text>' +
      '<text x="0" y="72" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--ink-soft)">let go &rarr; it levels</text>' +
    '</g>' +
    '<g transform="translate(238,60)">' +
      '<path d="M-46 0 L46 0" stroke="rgba(31,51,80,.30)" stroke-width="1.4" stroke-dasharray="4 4"/>' +
      '<g transform="rotate(-58)"><path d="M-30 0 L30 0" stroke="var(--ink)" stroke-width="3"/>' +
      '<path d="M-30 0 L-30 -7 M30 0 L30 -7" stroke="var(--ink)" stroke-width="2.4"/></g>' +
      '<text x="0" y="54" text-anchor="middle" font-family="var(--font-mono)" font-size="11" fill="var(--rust)" letter-spacing="1.6">RATE</text>' +
      '<text x="0" y="72" text-anchor="middle" font-family="var(--font-hand)" font-size="14" fill="var(--ink-soft)">let go &rarr; it stays</text>' +
    '</g>' +
    '<text x="160" y="150" text-anchor="middle" font-family="var(--font-hand)" font-size="16" fill="var(--rust)">the stick asks for an angle, or for a speed.</text>' +
    '<text x="160" y="170" text-anchor="middle" font-family="var(--font-hand)" font-size="16" fill="var(--rust)">that is the whole difference.</text>' +
    '</svg>',

  /* ---- M7 trick figures. Side views, left to right, phases labelled ---- */

  /* flip: punch, snap while the throttle is low, catch */
  trickFlip: '<svg viewBox="0 0 320 200">' +
    '<path d="M14 158 L306 158" stroke="var(--ink)" stroke-width="2"/>' +
    '<g stroke="var(--line-hard)" stroke-width="1.1">' +
      '<path d="M24 158 l-6 9 M74 158 l-6 9 M124 158 l-6 9 M174 158 l-6 9 M224 158 l-6 9 M274 158 l-6 9"/>' +
    '</g>' +
    /* 1 punch: level quad, big up arrow */
    '<g transform="translate(62,96)">' +
      '<path d="M-14 0 L14 0 M-19 -6 L-9 -6 M9 -6 L19 -6 M-14 0 L-14 -5 M14 0 L14 -5" stroke="var(--ink)" stroke-width="2.2" fill="none"/>' +
      '<path d="M0 -14 L0 -44" stroke="var(--green)" stroke-width="2.6"/>' +
      '<path d="M-6 -36 L0 -46 L6 -36" fill="none" stroke="var(--green)" stroke-width="2.6"/>' +
      '<text x="0" y="26" text-anchor="middle" font-family="var(--font-mono)" font-size="10.5" fill="var(--green)" letter-spacing="1.6">1 PUNCH</text>' +
    '</g>' +
    /* 2 snap: rotated quad, circular arrow, throttle low */
    '<g transform="translate(160,66)">' +
      '<g transform="rotate(-145)"><path d="M-14 0 L14 0 M-19 -6 L-9 -6 M9 -6 L19 -6" stroke="var(--ink)" stroke-width="2.2" fill="none"/></g>' +
      '<path d="M22 -12 A 26 26 0 1 1 -24 -8" fill="none" stroke="var(--rust)" stroke-width="2.2"/>' +
      '<path d="M-30 -14 L-24 -6 L-16 -12" fill="none" stroke="var(--rust)" stroke-width="2.2"/>' +
      '<text x="0" y="46" text-anchor="middle" font-family="var(--font-mono)" font-size="10.5" fill="var(--rust)" letter-spacing="1.6">2 SNAP</text>' +
      '<text x="0" y="62" text-anchor="middle" font-family="var(--font-hand)" font-size="13" fill="var(--rust)">throttle LOW here</text>' +
    '</g>' +
    /* 3 catch: level again, small up arrow */
    '<g transform="translate(258,96)">' +
      '<path d="M-14 0 L14 0 M-19 -6 L-9 -6 M9 -6 L19 -6 M-14 0 L-14 -5 M14 0 L14 -5" stroke="var(--ink)" stroke-width="2.2" fill="none"/>' +
      '<path d="M0 -14 L0 -32" stroke="var(--green)" stroke-width="2.4"/>' +
      '<path d="M-5 -26 L0 -34 L5 -26" fill="none" stroke="var(--green)" stroke-width="2.4"/>' +
      '<text x="0" y="26" text-anchor="middle" font-family="var(--font-mono)" font-size="10.5" fill="var(--green)" letter-spacing="1.6">3 CATCH</text>' +
    '</g>' +
    '<text x="160" y="188" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">three beats. the middle one has no thrust in it.</text>' +
    '</svg>',

  /* power loop: the four phases round an object */
  trickPowerLoop: '<svg viewBox="0 0 320 210">' +
    '<path d="M14 172 L306 172" stroke="var(--ink)" stroke-width="2"/>' +
    '<g stroke="var(--line-hard)" stroke-width="1.1">' +
      '<path d="M24 172 l-6 9 M74 172 l-6 9 M124 172 l-6 9 M174 172 l-6 9 M224 172 l-6 9 M274 172 l-6 9"/>' +
    '</g>' +
    /* the object being looped */
    '<g stroke="var(--ink)" stroke-width="2" fill="none">' +
      '<path d="M160 172 L160 132"/>' +
      '<path d="M160 132 L146 148 M160 132 L174 148 M160 142 L150 154 M160 142 L170 154" opacity=".7"/>' +
    '</g>' +
    /* the loop, dashed */
    '<circle cx="160" cy="96" r="58" fill="none" stroke="var(--rust)" stroke-width="2" stroke-dasharray="7 5"/>' +
    /* entry arrow */
    '<path d="M34 154 L96 150" stroke="var(--sky)" stroke-width="2.2"/>' +
    '<path d="M88 145 L97 150 L88 155" fill="none" stroke="var(--sky)" stroke-width="2.2"/>' +
    /* phase labels round the circle */
    '<g font-family="var(--font-mono)" font-size="10" letter-spacing="1.4">' +
      '<text x="52" y="140" fill="var(--sky)">1 APPROACH</text>' +
      '<text x="232" y="120" fill="var(--green)">2 PUNCH</text>' +
      '<text x="128" y="26" fill="var(--amber)">3 FLOAT</text>' +
      '<text x="34" y="92" fill="var(--rust)">4 CATCH</text>' +
    '</g>' +
    '<text x="238" y="136" font-family="var(--font-hand)" font-size="13" fill="var(--green)">full throttle, pull back</text>' +
    '<text x="128" y="42" font-family="var(--font-hand)" font-size="13" fill="var(--amber)">throttle OFF, upside down</text>' +
    '<text x="160" y="200" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">punch before the tree, not at it</text>' +
    '</svg>',

  /* split-s: half-roll to inverted, pull through, leave the other way and lower */
  trickSplitS: '<svg viewBox="0 0 320 210">' +
    '<path d="M14 178 L306 178" stroke="var(--ink)" stroke-width="2"/>' +
    /* entry, high, left to right */
    '<path d="M28 52 L168 52" stroke="var(--sky)" stroke-width="2.4"/>' +
    '<path d="M160 47 L169 52 L160 57" fill="none" stroke="var(--sky)" stroke-width="2.4"/>' +
    '<text x="40" y="42" font-family="var(--font-mono)" font-size="10" fill="var(--sky)" letter-spacing="1.4">1 LEVEL, HIGH</text>' +
    /* the half-roll marker */
    '<g transform="translate(196,52)">' +
      '<path d="M-13 -11 A 17 17 0 1 1 -13 11" fill="none" stroke="var(--rust)" stroke-width="2"/>' +
      '<path d="M-19 5 L-12 12 L-6 5" fill="none" stroke="var(--rust)" stroke-width="2"/>' +
      '<text x="4" y="-20" font-family="var(--font-mono)" font-size="10" fill="var(--rust)" letter-spacing="1.4">2 HALF-ROLL</text>' +
      '<text x="6" y="-6" font-family="var(--font-hand)" font-size="13" fill="var(--rust)">now inverted</text>' +
    '</g>' +
    /* the pull-through: half circle down */
    '<path d="M196 66 A 46 46 0 0 1 196 148" fill="none" stroke="var(--amber)" stroke-width="2.4" stroke-dasharray="7 5"/>' +
    '<text x="252" y="110" font-family="var(--font-mono)" font-size="10" fill="var(--amber)" letter-spacing="1.4">3 PULL</text>' +
    '<text x="252" y="126" font-family="var(--font-hand)" font-size="13" fill="var(--amber)">through the bottom</text>' +
    /* exit, low, right to left */
    '<path d="M188 148 L60 148" stroke="var(--green)" stroke-width="2.4"/>' +
    '<path d="M68 143 L59 148 L68 153" fill="none" stroke="var(--green)" stroke-width="2.4"/>' +
    '<text x="64" y="140" font-family="var(--font-mono)" font-size="10" fill="var(--green)" letter-spacing="1.4">4 OUT - OTHER WAY, LOWER</text>' +
    /* the height it costs */
    '<g stroke="var(--ink-soft)" stroke-width="1.4" fill="none">' +
      '<path d="M30 60 L30 140" stroke-dasharray="3 3"/><path d="M26 66 L30 58 L34 66 M26 134 L30 142 L34 134"/>' +
    '</g>' +
    '<text x="160" y="200" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">a U-turn that spends height. enter with height to spend.</text>' +
    '</svg>',

  /* matty flip: backwards over the object, nose on it the whole way */
  trickMatty: '<svg viewBox="0 0 320 210">' +
    '<path d="M14 172 L306 172" stroke="var(--ink)" stroke-width="2"/>' +
    /* the object */
    '<g stroke="var(--ink)" stroke-width="2" fill="none">' +
      '<path d="M160 172 L160 122"/>' +
      '<path d="M160 122 L144 140 M160 122 L176 140 M160 134 L148 148 M160 134 L172 148" opacity=".7"/>' +
    '</g>' +
    /* the backwards arc over it */
    '<path d="M62 150 Q70 60 160 52 Q250 60 258 150" fill="none" stroke="var(--rust)" stroke-width="2.2" stroke-dasharray="7 5"/>' +
    '<path d="M252 140 L258 151 L264 140" fill="none" stroke="var(--rust)" stroke-width="2.2"/>' +
    /* nose ticks along the arc, all pointing at the treetop */
    '<g stroke="var(--green)" stroke-width="2" fill="none">' +
      '<path d="M76 108 L106 116"/><path d="M132 62 L150 84"/>' +
      '<path d="M188 62 L172 84"/><path d="M244 108 L214 116"/>' +
    '</g>' +
    '<g fill="var(--green)">' +
      '<circle cx="106" cy="116" r="3"/><circle cx="150" cy="84" r="3"/>' +
      '<circle cx="172" cy="84" r="3"/><circle cx="214" cy="116" r="3"/>' +
    '</g>' +
    '<text x="160" y="30" text-anchor="middle" font-family="var(--font-mono)" font-size="10.5" fill="var(--rust)" letter-spacing="1.6">OVER THE TOP - BACKWARDS</text>' +
    '<text x="66" y="90" font-family="var(--font-hand)" font-size="13" fill="var(--green)">nose stays</text>' +
    '<text x="66" y="105" font-family="var(--font-hand)" font-size="13" fill="var(--green)">on the tree</text>' +
    '<text x="160" y="200" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--ink-soft)">a power loop flown in reverse, eyes on the prize</text>' +
    '</svg>',

  /* crawl, walk, run: where a trick gets learned */
  trickLadder: '<svg viewBox="0 0 320 200">' +
    '<g stroke="var(--ink)" stroke-width="2.2" fill="var(--paper-2)">' +
      '<rect x="20"  y="140" width="84" height="26"/>' +
      '<rect x="118" y="102" width="84" height="64"/>' +
      '<rect x="216" y="64"  width="84" height="102"/>' +
    '</g>' +
    '<g font-family="var(--font-mono)" font-size="10.5" letter-spacing="1.4" text-anchor="middle">' +
      '<text x="62"  y="157" fill="var(--ink)">1 THE SIM</text>' +
      '<text x="160" y="119" fill="var(--ink)">2 OPEN GRASS</text>' +
      '<text x="258" y="81"  fill="var(--ink)">3 THE SPOT</text>' +
    '</g>' +
    '<g font-family="var(--font-hand)" font-size="13" fill="var(--ink-soft)" text-anchor="middle">' +
      '<text x="62"  y="176" font-size="12">crash for free</text>' +
      '<text x="160" y="136" font-size="12"><tspan x="160">three</tspan><tspan x="160" dy="13">mistakes high</tspan></text>' +
      '<text x="258" y="98" font-size="12"><tspan x="258">only once</tspan><tspan x="258" dy="13">it is boring</tspan></text>' +
    '</g>' +
    '<g stroke="var(--green)" stroke-width="2" fill="none">' +
      '<path d="M104 132 L118 122"/><path d="M108 122 L119 121 L114 132" opacity="0"/>' +
      '<path d="M202 94 L216 84"/>' +
    '</g>' +
    '<text x="160" y="30" text-anchor="middle" font-family="var(--font-mono)" font-size="11.5" fill="var(--ink)" letter-spacing="2.2">TEN CLEAN IN A ROW, THEN MOVE UP</text>' +
    '<text x="160" y="196" text-anchor="middle" font-family="var(--font-hand)" font-size="15" fill="var(--rust)">the sim is not the warm-up. it is the classroom.</text>' +
    '</svg>'
};

/* ---------------------------------------------------------------------------
   MODULES
   --------------------------------------------------------------------------- */
var GS_MODULES = [
  /* One module per knowledge badge (Flight School v2, 2026-10-04). code is the
     lesson-id stem; badge is the catalogue id in config.json / badges.js.
     FLY has no badge: it holds the drills the witnessed flight badges use. */
  { code:'SAF', badge:'safe-flight',           tier:0, name:'Safe Flight',           mins:16,
    blurb:'Who flies, who watches, the four calls, the rules sheet by the sims, and the go / no-go call. Pass the quiz, earn the badge.' },
  { code:'SPT', badge:'spotter',               tier:0, name:'Spotter',               mins:10, signoff:true,
    blurb:'The spotter\'s job, the check before the battery goes in, and what to call. Pass the quiz, then spot a real flight for a mentor.' },
  { code:'BAT', badge:'battery-care',          tier:0, name:'Battery Care',          mins:14,
    blurb:'The part that hurts people: voltages, the math, charging and storage, and what to do when a pack goes bad.' },
  { code:'ELC', badge:'electrical-components', tier:1, name:'Electrical Components', mins:14,
    blurb:'Six parts, how thrust and yaw happen, and how to pick a motor, ESC, prop and pack that agree with each other.' },
  { code:'RAD', badge:'radio-protocol',        tier:1, name:'Radio Protocol',        mins:29,
    blurb:'Radio is light you cannot see; why analog turns to snow and digital falls off a cliff, Raceband, antennas, the control link, failsafe, a gym full of phones, and setting up a digital video system to record.' },
  { code:'EVT', badge:'event-ops',             tier:2, name:'Event Ops',             mins:39, signoff:true,
    blurb:'What the mentor checks before an outdoor flight - where Sky Harbor\'s Class B starts (Brophy is just outside it), B4UFLY, LAANC and TRUST - then the flight zone, the brief, the calls and the handover, then what to do when it goes wrong. Pass the quiz, then show a mentor at a real setup.' },
  { code:'FLY', badge:null,                    tier:0, name:'Flight prep',           mins:41,
    blurb:'Sticks, hover, orientation and the tricks: the drills mentors expect you to have done before Sim Flight, Line of Sight and Freestyle Flight. No quiz - those badges are watched, not tested.' }
];

/* ---------------------------------------------------------------------------
   THE TWENTY-TWO LESSONS
   kind: 'read' | 'drill' | 'quiz'   (a read lesson may also carry a check)
   --------------------------------------------------------------------------- */
var GS_COURSE = [

/* ============================ M1 - GROUND RULES ========================== */
{
  id:'gs-saf-01', mod:'SAF', ord:10, title:"Who's flying, who's watching", mins:3, kind:'read',
  cards:[
    { h:'Two jobs, every flight', tab:'Two jobs',
      p:['On this kiosk you practise the pilot\'s job. In the club you will spot far more often than you fly - and a good spotter is the reason nothing goes wrong.'],
      facts:[
        { n:'PILOT',   l:'flies. only flies' },
        { n:'SPOTTER', l:'eyes on the aircraft', c:'sky' }
      ],
      art:'threeJobs', cap:'one flies. one watches.' },
    { h:'Say it out loud', tab:'The four calls',
      p:['Four calls, every flight. They are for your spotter - you always need one to fly - and for everyone around you. Nobody walks out to the aircraft until they have <b>heard</b> DISARMED.'],
      steps:[
        { t:'Arming',   d:'before the props spin' },
        { t:'Takeoff',  d:'as you leave the ground' },
        { t:'Landing',  d:'before you descend' },
        { t:'Disarmed', d:'props stopped. now you may walk' }
      ],
      art:'callouts', cap:'four words. say all of them.',
      note:'If you are not sure whether someone is flying, ask. Out loud. Every time.' },
    { h:'Props off at the Brophy bench', tab:'Props off',
      p:['A quad on a bench with props fitted is dangerous. One wrong button or one wrong click in Betaflight and you, or someone else, gets really hurt.'],
      cols:{ tone:'dd', ha:'Props come off when', hb:'Not an excuse',
        a:['The battery is plugged in','Arming inside','Spinning motors in Betaflight'],
        b:['"I\'ll be quick"','"It\'s only a setting"','"It isn\'t armed"'] },
      exceptions:['A tiny whoop can keep its props on as long as you are holding it down','Anything bigger can too, if someone with the Mentor badge is supervising and the drone is held or strapped down'],
      art:'propsOff', cap:'off the aircraft, not just idle' },
    { h:'Where the people are',
      p:['<b>Default flight rules.</b> If somebody walks into the flying area, you <b>land</b>. You do not fly around them, and you do not hover and wait to see what they do.'],
      cols:{ tone:'dd', ha:'Always', hb:'Never',
        a:['Where your spotter can see it','Within a one-minute walk','Land the moment someone wanders in'],
        b:['Over people','Over a road','Over 400 ft'] },
      exceptions:['The people have given their consent','A mentor has given you special permission'],
      art:'ceiling', cap:'400 ft, in sight, and out of everybody\'s way' },
    { h:'The battery lives on the ground', tab:'Battery on the ground',
      p:['Packs travel in a fire-resistant bag, charge on a hard surface with nothing stacked on top, and are <b>never</b> left charging unattended.'],
      tip:'A pack that has been in a crash should be <b>watched for half an hour</b> before it goes near a charger. Damaged cells can catch fire minutes after the impact - often after being put in a bag.',
      art:'lipoSafety', cap:'bag on fire.' }
  ]
},
{
  id:'gs-asp-01', mod:'EVT', ord:3, title:'Class B, 400 ft and Sky Harbor', mins:3, kind:'read',
  cards:[
    { h:'Two ways to be legal',
      p:['Money is not what decides which one you are. <b>Purpose</b> is - a video for the club or a shot for a class project counts, paid or not.'],
      cols:{ tone:'vs', ha:'Recreational', hb:'Part 107',
        a:['Purely for your own enjoyment','Pass the free TRUST test once','Keep proof of it on you'],
        b:['Any flight with a purpose for somebody else','A real certificate, a real exam','Even if nobody is paying'] } },
    { h:'TRUST takes twenty minutes', tab:'TRUST',
      p:['Do it before your first flight, save the PDF, and keep a copy on your phone. If someone official asks and you have not got it, that is the whole conversation.'],
      facts:[
        { n:'FREE', l:'online, ~20 min', c:'green' },
        { n:'0',    l:'ways to fail it - it re-teaches you' },
        { n:'∞', l:'never expires', c:'sky' }
      ] },
    { h:'Register the aircraft',
      p:['A 5-inch freestyle quad is well over the line. A tiny whoop is well under it.'],
      facts:[
        { n:'250 g', l:'registration threshold', c:'rust' },
        { n:'FAA',   l:'is who you register with' },
        { n:'OUTSIDE', l:'number readable without tools' }
      ],
      tip:'Not sure which side of 250 g you are on? Weigh it - <b>with the battery in</b>. The threshold is take-off weight, not the bare frame.' },
    { h:'The hard numbers',
      p:['In goggles you cannot see the aircraft yourself, so the <b>spotter is required</b>, not a nice extra. That is the rule that makes goggle flying legal at all.'],
      facts:[
        { n:'400 ft', l:'the ceiling', c:'rust' },
        { n:'VLOS',   l:'your own eyes on it' },
        { n:'GIVE WAY', l:'to every crewed aircraft', c:'amber' }
      ],
      art:'ceiling', cap:'the shelf you fly under' },
    { h:'The field gets looked up. Every time.', tab:'Look it up',
      p:['Airspace is not something you memorise, it is something you <b>check</b>. At club flights a <b>mentor</b> does this check - mentors need deep knowledge of the FAA rules - but you should know what they are looking at. Near a big airport the ceiling can be zero feet - which means no, not "be careful".'],
      steps:[
        { t:'Open',  d:'B4UFLY or a LAANC app' },
        { t:'Pin',   d:'exactly where you are standing' },
        { t:'Read',  d:'what it says today, not last week' },
        { t:'Authorise', d:'controlled airspace, before take-off' }
      ],
      note:'Do not assume our field is clear because it was clear last week. Temporary restrictions appear for stadium events, VIP visits and fires.' }
  ],
  check:[
    { q:'You are filming a promo video for the club. Nobody is paying you. Recreational, or Part 107?',
      opts:['Recreational - no money changed hands','Part 107 - the flight has a purpose for someone else','Neither, club flying is exempt','Recreational, as long as you are under 400 ft'],
      a:1, why:'Recreational means flying purely for your own enjoyment. The moment the flight exists to produce something for somebody else it is Part 107, whether or not anyone gets paid.' },
    { q:'You are at the field in goggles with a friend standing next to you. Who has to be watching the aircraft?',
      opts:['Nobody, the goggles are your view','You, by lifting the goggles now and then','Your friend, and it is a requirement','Whoever is closest to it'],
      a:2, why:'Goggles mean you cannot maintain visual line of sight yourself, so a visual observer is required - not optional. That is what makes flying in goggles legal.' },
    { q:'B4UFLY shows your field inside controlled airspace with a ceiling of 0 ft. What can you do today?',
      opts:['Fly below 100 ft to be safe','Fly, but stay in sight of the car','Not fly there - there is no altitude available','Fly and file the paperwork afterwards'],
      a:2, why:'A 0 ft grid means no authorisation is available for that square. There is no low-and-careful version of it. Different field, or a different day.' }
  ]
},
{
  id:'gs-saf-03', mod:'SAF', ord:30, title:'Go / No-Go', mins:3, kind:'drill', drill:'goNoGo',
  cards:[
    { h:'Two answers: fly, or not yet', tab:'Two piles',
      p:['NOT YET is the pile people get wrong, because it is not only about broken parts. Swapping a nicked prop is "not yet". So is waiting for somebody to walk off the field. Any wind is "not yet". None of these has to end your session; they stop you launching this second.'],
      facts:[
        { n:'FLY',     l:'nothing to change - go' },
        { n:'NOT YET', l:'one thing changes first' }
      ],
      tip:'The real mistake is not putting something in the wrong pile. It is <b>not sorting at all</b> - flying anyway, because the pack is charged and everyone is waiting.',
      art:'goNoGo', cap:'two piles. everything lands in one.' }
  ]
},
{
  id:'gs-elc-01', mod:'ELC', ord:10, title:'The six parts', mins:3, kind:'read',
  cards:[
    { h:'Six parts. That is the whole aircraft.', tab:'Six parts',
      p:['A racing quad has fewer parts than a bicycle. Learn what each one does and what it looks like when it fails, and you can diagnose most problems on the bench without a laptop.'],
      facts:[
        { n:'FRAME',   l:'holds it, takes the crash' },
        { n:'MOTORS',  l:'four, brushless' },
        { n:'ESC',     l:'power to each motor' },
        { n:'FC',      l:'the brain', c:'sky' },
        { n:'RX',      l:'hears your radio' },
        { n:'BATTERY', l:'the dangerous one', c:'rust' }
      ],
      art:'sixParts', cap:'and the arms are meant to break first' },
    { h:'Frame and motors',
      p:['The <b>frame</b> is carbon plates that hold everything and absorb the crash. Arms snap on purpose - they are cheap, and they break instead of the expensive parts.',
         'Four <b>brushless motors</b>, numbered 1 to 4 by the flight controller.'],
      tip:'A motor too hot to hold right after landing has a bent shaft, a dry bearing, or something wound round it. <b>Warm is normal; too-hot-to-hold is not</b> - and it only gets worse.' },
    { h:'ESCs and the flight controller', tab:'ESCs and FC',
      p:['An <b>ESC</b> per motor, or one 4-in-1 board. It turns "spin this fast" into three-phase power. When one fails it smells like burnt plastic and usually takes the motor with it.',
         'The <b>flight controller</b> is the brain: a gyro, an accelerometer, and Betaflight. It reads your sticks, reads how the aircraft is actually moving, and corrects all four motors <b>hundreds of times a second</b> to close the gap.'] },
    { h:'Receiver and battery',
      p:['The <b>receiver</b> listens for your transmitter. When it stops hearing anything, <b>failsafe</b> runs: whatever that drone is set up to do when it loses you. Most small quads are set to cut the motors and come down - a quad that keeps flying with nobody controlling it is far worse.',
         'The <b>battery</b> is a LiPo pack. It is the part you replace most often and the only part that can burn your house down. Next lesson.'],
      note:'Six parts, one laptop, and a set of hex drivers. That is the entire toolkit.' }
  ]
},
{
  id:'gs-elc-02', mod:'ELC', ord:20, title:'Motors, props and thrust', mins:3, kind:'drill', drill:'motors',
  cards:[
    { h:'Diagonals spin together',
      p:['Look down at the aircraft. The two motors on <b>one diagonal</b> spin one way; the two on the other diagonal spin the opposite way.',
         'That is not a detail - it is the reason the aircraft does not spin on its own. Each spinning prop tries to twist the airframe the other way, and pairing them off cancels it out.'],
      art:'quadTop', cap:'motor numbers, and which way each one turns' },
    { h:'How it moves', tab:'How it moves',
      p:['<b>Climb:</b> all four faster. <b>Roll right:</b> the two on the left speed up, and it leans right. <b>Pitch forward:</b> the two at the back speed up, and it tips forward.',
         '<b>Yaw</b> is the odd one. Speed up one diagonal pair and you unbalance that cancelled-out twist - the airframe rotates the <em>opposite</em> way to those two props. That is why yaw feels lazier than roll: it is fighting drag, not making thrust.'],
      art:'mixTable', cap:'four movements, four recipes',
      note:'If your quad flips instantly on take-off, two motors are wired in the wrong order. Props off, and check the motor test tab.' }
  ]
},
{
  id:'gs-bat-01', mod:'BAT', ord:10, title:'LiPo basics', mins:4, kind:'read', extra:'voltage',
  cards:[
    { h:'S is how many cells',
      p:['Four numbers, <b>per cell</b>, are the whole of battery safety. The S number is how many cells are in series - a 4S pack is four of them, so <b>always divide by S</b> before you judge a pack.'],
      facts:[
        { n:'4.20 V', l:'full', c:'sky' },
        { n:'3.70 V', l:'nominal' },
        { n:'3.50 V', l:'land now', c:'amber' },
        { n:'3.00 V', l:'ruined below', c:'rust' }
      ],
      art:'lipo', cap:'divide by S, then read the cell' },
    { h:'Sag is not damage',
      p:['Punch the throttle and the voltage drops - sometimes a whole volt per cell. Let off and it climbs back. That is <b>sag</b>, and it is normal.'],
      tip:'Judge a pack on its <b>resting</b> voltage, thirty seconds after you land. The number you see mid-punch tells you about the pack\'s C rating, not its charge.',
      note:'There is a slider at the end of this lesson. Punch the throttle on it and watch what happens.' },
    { h:'mAh and C',
      p:['Ask for more current than the C rating allows and the pack sags badly, gets hot, and puffs. Under-rating C is the most common way people kill packs that were otherwise fine.'],
      facts:[
        { n:'mAh', l:'size of the tank' },
        { n:'C',   l:'how fast you may empty it' },
        { n:'150 A', l:'1500 mAh × 100C', c:'green' }
      ] },
    { h:'Storage charge',
      p:['A pack left <b>full</b> degrades quickly. A pack left <b>empty</b> can die outright. More than a couple of days? Put it at storage - every decent charger has a storage mode and it takes one button.'],
      facts:[
        { n:'3.80 V', l:'per cell = storage', c:'green' },
        { n:'15.2 V', l:'on a 4S' },
        { n:'22.8 V', l:'on a 6S' }
      ] },
    { h:'When it goes wrong', tab:'When it goes wrong',
      p:['A LiPo fire makes its own oxygen, so water will not put it out. Get people away from the smoke - it is genuinely toxic - smother what you can, and let it finish. <b>Fight the spread, not the pack.</b>'],
      cols:{ tone:'dd', ha:'Always', hb:'Never',
        a:['Retire puffed or punctured packs; watch hard-crashed ones','Charge in a bag or a metal tin','Hard surface, someone watching'],
        b:['"One more flight" on a puffed pack','Charge unattended','Carpet, beds, anything soft'] },
      art:'lipoSafety', cap:'and a puffed pack never flies again' }
  ],
  check:[
    { q:'A 4S pack reads 14.0 V resting, a minute after you land. Fly it again?',
      opts:['Yes, 14 V is above nominal','No - that is 3.50 V a cell, which is land-now','Only a short flight','Yes, if it is not warm'],
      a:1, why:'14.0 divided by 4 is 3.50 V per cell. That is the land-now number, and it is already there at rest. Another flight takes cells below 3.0 and the pack loses capacity permanently.' },
    { q:'What is the storage voltage for a 6S pack?',
      opts:['25.2 V','22.8 V','21.0 V','19.8 V'],
      a:1, why:'3.80 V per cell times six is 22.8 V. 25.2 is fully charged, and leaving a pack there for weeks is what puffs it.' },
    { q:'Mid-punch your pack reads 13.6 V. Thirty seconds after landing it reads 15.1 V. Is there a problem?',
      opts:['Yes, the pack is failing','Yes, the ESCs are drawing too much','No - that is normal sag, and 15.1 resting is healthy','No, but the pack needs replacing soon'],
      a:2, why:'Voltage under heavy load always dips and then recovers. 15.1 V resting on a 4S is 3.78 a cell, which is a healthy pack. Judge on resting voltage.' }
  ]
},
{
  id:'gs-bat-02', mod:'BAT', ord:20, title:'Battery math', mins:3, kind:'drill', drill:'batteryMath',
  cards:[
    { h:'Three sums you will do forever', tab:'Three sums', art:'batteryMath', cap:'work them, do not memorise them',
      p:['<b>How long will this fly?</b> Usable capacity is about 80% of the pack - you land with a reserve, you do not run it flat. Divide that by the average current and turn hours into minutes.',
         '<b>How much can it give?</b> mAh divided by 1000, times C, is the maximum amps.',
         'The numbers change every attempt, so there is nothing to memorise. Work them.'] }
  ]
},
{
  id:'gs-rad-01', mod:'RAD', ord:10, title:'Analog against digital', mins:4, kind:'read', extra:'signal',
  cards:[
    { h:'Radio is light you cannot see', tab:'It is light',
      p:['Your control link, your video and the light from the sun are the same thing: <b>electromagnetic waves</b>, all moving at the speed of light. The only difference is the <b>frequency</b> - how many waves pass each second - and the wavelength that comes with it.',
         'Higher frequency means a shorter wave. Shorter waves carry more data but are stopped more easily by walls, leaves and people - which is why 5.8 GHz video breaks up behind a tree that 900 MHz control goes straight through.'],
      facts:[
        { n:'900 MHz', l:'33 cm wave - long-range control', c:'sky' },
        { n:'2.4 GHz', l:'12.5 cm - ELRS control, Wi-Fi' },
        { n:'5.8 GHz', l:'5 cm - the video link', c:'amber' },
        { n:'~500 THz', l:'visible light - the same wave, far faster', c:'rust' }
      ],
      tip:'Wavelength = speed of light / frequency. Antennas are cut to a fraction of the wavelength, which is why a 5.8 GHz antenna is tiny and a 900 MHz one is not.' },
    { h:'One way, and nothing comes back', tab:'One way only',
      p:['A tiny transmitter on the aircraft throws a picture at your goggles on <b>5.8 GHz</b>. There is no handshake, no retry, no acknowledgement. Whatever arrives is what you fly on.',
         'Two families do this very differently, and the difference decides how you fly.'],
      art:'videoChain', cap:'no handshake. whatever arrives, you fly on.' },
    { h:'Analog fails slowly',
      p:['Analog has been the FPV standard for twenty years. The picture degrades in a straight line: clean, then grain, then heavy static, then snow with the shape of the world still faintly in it.'],
      tip:'That gradient is the point. <b>Static is a distance gauge.</b> When it starts you are at the edge - and you can still fly home on a picture that is 70% noise.' },
    { h:'Digital fails all at once', tab:'Digital: a cliff',
      p:['DJI, HDZero and Walksnail send compressed video. Sharp picture, real colour, readable OSD - then a frozen frame breaking into blocks, then black.',
         '<b>There is no warning gradient</b>, so you fly a route you already know and watch the link-quality number instead of waiting for the picture to warn you.'],
      art:'failCurves', cap:'one slopes away. one drops off a cliff.' },
    { h:'Which to learn on',
      p:['Learn on analog. Not because it is better - because it teaches you what a failing link <b>feels</b> like while you can still do something about it.'],
      cols:{ tone:'vs', ha:'Analog', hb:'Digital',
        a:['Cheap - any goggles, any aircraft','The lowest latency there is','Warns you before it fails'],
        b:['A far better picture','Locked to one brand at both ends','Perfect, perfect, gone'] },
      note:'Drag the slider on the next card and watch both fail. That contrast is the lesson.' }
  ]
},
{
  id:'gs-rad-02', mod:'RAD', ord:20, title:'Bands, channels and racing', mins:4, kind:'drill', drill:'channels',
  cards:[
    { h:'Five bands, eight channels each', tab:'Bands and channels',
      p:['Your transmitter and your goggles must be on the same channel or you see nothing at all. Forty combinations sounds like plenty - it is not, because they are not all far enough apart to be used at once.'],
      facts:[
        { n:'A B E F R', l:'the five bands' },
        { n:'8',  l:'channels in each' },
        { n:'40', l:'combos - fewer than it sounds', c:'amber' }
      ] },
    { h:'Two on one channel and nobody flies', tab:'Two on one',
      p:['Two video transmitters on the same frequency do not take turns. Both pictures tear each other to pieces, and anyone in goggles is now flying blind.'],
      tip:'Channels get assigned <b>on the ground, out loud, before anyone arms</b>. It is not politeness - somebody is about to be blind if you get it wrong.' },
    { h:'Raceband', tab:'Raceband',
      p:['Band <b>R</b> exists because the other bands pack their channels too close together to run several pilots at once. R spaces its channels further apart.',
         'More than two of you flying? Use R, spread out across it, and leave a gap between pilots. This drill is exactly that skill.'],
      art:'raceband', cap:'spread out, and nobody bleeds' },
    { h:'Power, and the one rule', tab:'The one rule', art:'vtxAntenna', cap:'the most common way to kill a VTX',
      p:['25 mW is the default and it is plenty for a field. More power buys range and costs everybody else interference.',
         '<b>Never power a video transmitter with no antenna fitted.</b> The output has nowhere to go, it reflects back into the amplifier, and you cook the transmitter in seconds. This is the single most common way people destroy a VTX.'],
      note:'Antenna first, battery second. Every single time.' }
  ]
},
{
  id:'gs-rad-03', mod:'RAD', ord:30, title:'Antennas and diversity', mins:3, kind:'read', extra:'patch',
  cards:[
    { h:'Circular, and it has a handedness', tab:'Handedness', art:'polarity', cap:'match both ends or lose most of it',
      p:['FPV antennas are <b>circularly polarised</b> - the signal corkscrews rather than waving flat. That is what makes them shrug off reflections off the ground and buildings.',
         'A corkscrew turns one of two ways: right-hand (<b>RHCP</b>) or left-hand (<b>LHCP</b>). Both ends must match. Mix them and you throw away most of your signal before you leave the ground.'] },
    { h:'Omni and patch',
      p:['Good goggles run both at once. That is <b>diversity</b>: two receivers, two different antennas, and the goggles silently play whichever picture is better, frame by frame.'],
      facts:[
        { n:'OMNI',  l:'all round, not far', c:'sky' },
        { n:'PATCH', l:'far, only in its cone', c:'rust' },
        { n:'BOTH',  l:'diversity picks the winner', c:'green' }
      ],
      art:'antennas', cap:'both at once, and it picks the winner' },
    { h:'Aim the patch at the flying, not at yourself', tab:'Aim the patch',
      p:['A patch pointed straight ahead while you fly a course off to your left is doing nothing for you. Point it where the aircraft is <b>going to be</b>.'],
      note:'There is a live one at the end of this lesson: the aircraft flies a lap, you rotate the patch, and the link quality follows.' },
    { h:'What actually kills a link', tab:'What kills a link', art:'linkBlockers', cap:'fence, trees, and you',
      p:['The aircraft low and far away is far worse than high and far away, because the ground itself is in the path.'],
      cols:{ tone:'dd', ha:'The fixes', hb:'The walls at 5.8 GHz',
        a:['Turn your body out of the path','Go up - height is free range','Keep the flying inside the patch\'s cone'],
        b:['You, standing in the way','Chain-link fence, cars, buildings','Wet trees, and the ground itself'] },
      note:'If the picture is breaking up, before anything else: turn your body, and go up.' }
  ],
  check:[
    { q:'Your video transmitter has an RHCP antenna and you fit LHCP on the goggles. What happens?',
      opts:['Nothing, polarisation only matters for range records','You lose most of the signal and the range collapses','The picture inverts','It works but the colour is wrong'],
      a:1, why:'Mismatched handedness throws away most of the signal - typically enough to turn a whole field of range into a few tens of metres. Match both ends.' },
    { q:'You are flying a course entirely off to your left, and you have a patch antenna. Where do you aim it?',
      opts:['Straight ahead, so the cone is centred','At the course, off to your left','Straight up, for the widest coverage','It does not matter, diversity handles it'],
      a:1, why:'A patch only helps inside its cone. Point it at where the aircraft will be. Diversity means the omni covers everything else, not that aiming is pointless.' },
    { q:'Video is much worse at 100 m low over the grass than at 100 m up high. Why?',
      opts:['The transmitter is weaker near the ground','Cold air near the ground absorbs 5.8 GHz','The ground and whatever is on it is in the signal path','Ground effect from the props interferes'],
      a:2, why:'Same distance, different path. Low down, the earth and everything standing on it is between you and the aircraft. Height is the cheapest range upgrade there is.' }
  ]
},
{
  id:'gs-fly-01', mod:'FLY', ord:10, title:'Four channels, two sticks', mins:3, kind:'drill', drill:'sticks',
  cards:[
    { h:'Mode 2',
      p:['<b>Left stick:</b> up and down is <b>throttle</b>, left and right is <b>yaw</b> - spinning in place.',
         '<b>Right stick:</b> up and down is <b>pitch</b> - tipping forward and back to move forward and back. Left and right is <b>roll</b> - leaning to a side.',
         'Throttle is the only one that does not spring back to the middle, because it is the only one you want to stay where you put it.'],
      art:'sticksMode2', cap:'mode 2. throttle stays put; everything else springs back.' },
    { h:'Now prove it',
      p:['The drill names a movement and you make it. If a transmitter is plugged in it reads your real gimbals; if not, it takes the keyboard.',
         'This also <b>checks your mapping</b>. If the app asks for throttle up and sees yaw, something is wired wrong on your radio - far better to find that here than in the air.'] }
  ]
},
{
  id:'gs-fly-02', mod:'FLY', ord:20, title:'Rate mode against angle mode', mins:3, kind:'drill', drill:'rateAngle',
  cards:[
    { h:'One toggle, two aircraft', tab:'Two modes',
      p:['The stick asks for an <b>angle</b>, or for a <b>speed</b>. That is the whole difference - and it decides everything about how the aircraft behaves when you let go.'],
      cols:{ tone:'vs', ha:'Angle (self-level)', hb:'Rate (acro)',
        a:['Stick asks for a lean angle','Let go and it levels itself','Hard limit - cannot flip or go inverted','Forgiving. Where everyone starts'],
        b:['Stick asks for a rotation speed','Let go and it stays where you left it','Every flip, roll and dive lives here','Harder for two weeks, then it is all you want'] },
      art:'rateAngle', cap:'an angle, or a speed' },
    { h:'Feel the difference',
      p:['Same aircraft, one toggle. Hold it level in angle mode - let go and it recovers by itself. Now switch to rate and try again.',
         'Nothing you read will teach you this. Twenty seconds of each will.'] }
  ]
},
{
  id:'gs-fly-03', mod:'FLY', ord:30, title:'Hover Trainer', mins:5, kind:'drill', drill:'hover',
  cards:[
    { h:'The whole skill is small corrections', tab:'Small corrections', art:'hoverBox', cap:'hold the box, not a number',
      p:['A hover is not a thing you set, it is a thing you keep. The aircraft is always falling out of it and you are always putting it back, in inputs too small for anyone watching to see.'],
      steps:[
        { t:'Altitude', d:'hold a band, throttle alone' },
        { t:'The box',  d:'now with wind pushing you' },
        { t:'Rate mode', d:'nothing levels itself any more' }
      ],
      note:'Small and early beats big and late. Every time.' }
  ]
},
{
  id:'gs-fly-04', mod:'FLY', ord:40, title:'Throttle discipline', mins:4, kind:'drill', drill:'throttle',
  cards:[
    { h:'Stop using throttle like a switch', tab:'The sawtooth',
      p:['The beginner signature is full throttle, nothing, full throttle - a rising and falling sawtooth that never settles. It burns the pack, it makes the aircraft unpredictable, and it is exhausting to watch.',
         'This drill follows a moving target, and it scores you on <b>two</b> things: how close you stay, and how smooth you were getting there. You can track the target perfectly and still score badly by being violent about it.'],
      art:'throttleTrace', cap:'same altitude. completely different pilot.' }
  ]
},
{
  id:'gs-los-01', mod:'FLY', ord:50, title:'Which way is left?', mins:3, kind:'drill', drill:'orient',
  cards:[
    { h:'The aircraft does not know where you are', tab:'Its left, not yours',
      p:['Roll right means "lean toward your own right side" - the <b>aircraft\'s</b> right, not yours.',
         'Nose pointing away from you, the two agree and everything feels natural. Nose pointing <b>at</b> you and they are opposite: every roll input is reversed, and so is pitch.'],
      art:'noseIn', cap:'same stick. opposite result.' },
    { h:'Do not compute it. Learn it.', tab:'Learn it',
      p:['There is a trick that works for a while - imagine you are sitting in it and rotate yourself. It works, slowly, and slowly is not much use at 60 km/h.',
         'The thing that actually works is doing it several hundred times until there is nothing to work out. Ten rounds here, every session, and it stops being a calculation.'] }
  ]
},
{
  id:'gs-los-02', mod:'FLY', ord:60, title:'Gate Run', mins:5, kind:'drill', drill:'gates',
  cards:[
    { h:'A course that will not let you cheat', tab:'The course', art:'gateCourse', cap:'gate 6 has the nose back at you',
      p:['Six gates, laid out so you cannot fly the whole lap nose-away. Some you take side-on. At least one you take with the nose pointed straight back at yourself.',
         'Gates count in order and from the correct side. Clipping one costs you. So does taking forever.'],
      note:'If you get confused: centre the sticks, hold altitude, and yaw until it makes sense again. That is the next lesson, and you will want it here.' }
  ]
},
{
  id:'gs-los-03', mod:'FLY', ord:70, title:'Lost orientation recovery', mins:4, kind:'drill', drill:'recover',
  cards:[
    { h:'It happens to everybody',
      p:['Not "if you are bad at this". Everybody, usually when the aircraft is far away and small and you glanced down for a second.',
         'Being confused is not the dangerous part. The dangerous part is what people do next, which is jam a stick and hope.'] },
    { h:'Four steps, in this order', tab:'The four steps',
      p:['Skipping one is how it goes wrong. The order is the trick: you stop the bleeding before you try to work anything out.'],
      steps:[
        { t:'Level', d:'centre pitch and roll. stop making it worse' },
        { t:'Hold',  d:'throttle for a slow climb - altitude is thinking time' },
        { t:'Yaw',   d:'slowly, until the nose points away and the controls make sense' },
        { t:'Go',    d:'only now do you move' }
      ] },
    { h:'And if it does not come back', tab:'If it stays lost',
      p:['Throttle down, over grass, now. A controlled descent into grass costs you props and some dignity. Guessing costs you the aircraft, or somebody\'s window.'],
      tip:'Nobody has ever regretted landing early.' },
    { h:'If the video cuts',
      p:['Do not rip the goggles off - you will lose every reference you had. <b>Level, ease the throttle down, let it land itself.</b>'],
      tip:'On analog, if the picture flickers back for a moment, fly <b>toward yourself</b>: that is the direction the signal gets better, and it is the only clue you have.',
      note:'Now do it. You get dropped in disoriented and you run the four steps in order.' }
  ]
},
{
  id:'gs-trk-01', mod:'FLY', ord:80, title:'Your first flip and roll', mins:4, kind:'read',
  cards:[
    { h:'Every trick is the same three beats', tab:'Three beats',
      p:['A <b>roll</b> spins you around the nose (right stick, left-right). A <b>flip</b> tumbles you over the top (right stick, up-down). Same trick, different stick - and both are rate mode only.'],
      steps:[
        { t:'Punch', d:'a burst of throttle to buy height' },
        { t:'Snap',  d:'stick hard over, throttle LOW while inverted' },
        { t:'Catch', d:'level out, throttle back on before it sinks' }
      ],
      facts:[
        { n:'★', l:'difficulty', c:'green' },
        { n:'RATE', l:'mode required' },
        { n:'3+', l:'mistakes of height', c:'amber' }
      ],
      art:'trickFlip', cap:'punch. snap. catch.' },
    { h:'Why the throttle comes off', tab:'Throttle off',
      p:['Halfway round, the props point at the sky. Any thrust you are making while inverted is thrust <b>toward the ground</b> - which is why a flip flown at constant throttle finishes lower than it started, hard.'],
      tip:'Think of it as a shape: throttle <b>up</b> into the trick, <b>off</b> through the rotation, <b>on</b> again at the catch. The rotation itself is free - the sticks do that part.' },
    { h:'Where to learn it', tab:'Sim first',
      p:['The sims down the hall crash for free. The trick goes to grass only when the sim version is boring, and it goes near an object only when the grass version is boring.'],
      cols:{ tone:'dd', ha:'The ladder', hb:'Not the ladder',
        a:['Ten clean in a row in the sim','Then open grass, three mistakes high','Then, eventually, the real spot'],
        b:['First try outdoors "to see"','Low, because it looks cooler low','Anywhere near people. Ever.'] },
      art:'trickLadder', cap:'ten in a row, then move up' },
    { h:'Watch it done', tab:'Watch',
      p:['Four minutes, and you will see the throttle shape from the pilot\'s screen - which no diagram quite shows.'],
      videos:[
        { yt:'YPjSWXFgHEQ', t:'How To: Flips', by:'headmazta', len:'4:19',
          cap:'the whole mechanic, straight from the OSD' },
        { yt:'0EqJ9C8KuTQ', t:'10 FPV Freestyle Tricks - Learn These First', by:'Joshua Bardwell', len:'29:03', alt:true,
          cap:'<b>want more?</b> the ten-trick roadmap this module is built around' }
      ] }
  ]
},
{
  id:'gs-trk-02', mod:'FLY', ord:90, title:'The Split-S', mins:3, kind:'read',
  cards:[
    { h:'A U-turn that spends height', tab:'The move',
      p:['Half-roll to inverted, pull through a half loop, and leave the other way - lower, faster, and without the wide flat turn everyone can see from the ground.'],
      steps:[
        { t:'Check', d:'air below you - this trick spends height' },
        { t:'Roll',  d:'half-roll to inverted, throttle low' },
        { t:'Pull',  d:'pitch through the bottom of the loop' },
        { t:'Out',   d:'throttle on, flying the way you came' }
      ],
      facts:[
        { n:'★★', l:'difficulty', c:'amber' },
        { n:'HEIGHT', l:'is the entry fee', c:'rust' },
        { n:'180°', l:'turn, for free' }
      ],
      art:'trickSplitS', cap:'enter high. leave low, the other way.' },
    { h:'Where it goes wrong', tab:'The traps',
      p:['Both classic failures are the same failure: starting a downward half-loop without the height to finish it.'],
      cols:{ tone:'dd', ha:'Make it safe', hb:'The two killers',
        a:['Enter with double the height you think you need','Roll fully inverted before you pull','Throttle stays low until the nose is through'],
        b:['Pulling before the roll is finished - it corkscrews','Entering low - the loop needs all of it','Panic throttle while nose-down: full speed into the ground'] },
      tip:'If it feels wrong at the top, <b>keep pulling</b>. Half-finished is nose-down; finished is level. The way out is through.' },
    { h:'Watch it done', tab:'Watch',
      p:['Three minutes on the perfect shape, then the full beginner lesson if you want the sim-along version.'],
      videos:[
        { yt:'gepPp2OyXUQ', t:'How To Perfect Split-S', by:'headmazta', len:'3:00',
          cap:'the shape, the throttle, the exit' },
        { yt:'pL7sj1h3SRs', t:'Learn to Fly FPV - Lesson 10 - Flips and Split-S', by:'Joshua Bardwell', len:'10:16', alt:true,
          cap:'<b>want more?</b> flips and the split-S taught together, step by step' }
      ] }
  ]
},
{
  id:'gs-trk-03', mod:'FLY', ord:100, title:'The Power Loop', mins:4, kind:'read',
  cards:[
    { h:'Four beats round the clock', tab:'The move',
      p:['The signature FPV trick: a full loop, usually over something, with the world coming back the right way up exactly where you left it.'],
      steps:[
        { t:'Approach', d:'level, modest speed, at the thing' },
        { t:'Punch',    d:'full throttle and pull back - before it, not at it' },
        { t:'Float',    d:'throttle OFF over the top, upside down' },
        { t:'Catch',    d:'throttle on as the nose comes down the far side' }
      ],
      facts:[
        { n:'★★★', l:'difficulty', c:'rust' },
        { n:'SPLIT-S', l:'learn that first' },
        { n:'AIR', l:'loop nothing, at first', c:'green' }
      ],
      art:'trickPowerLoop', cap:'punch before the tree, not at it' },
    { h:'Where it goes wrong', tab:'The traps',
      p:['The float is the hard beat. Throttle over the top balloons you away from the loop; cutting the pull flattens it into a climb that never comes back round.'],
      cols:{ tone:'dd', ha:'Make it safe', hb:'What bites',
        a:['Air loops first - no object at all','Keep the pull constant all the way round','Commit: a slow half-loop is worse than a fast full one'],
        b:['Throttle while inverted - you balloon off the top','Easing off the pull mid-loop','Looping an object you cannot clear on a bad day'] },
      tip:'If it dies over the top, <b>finish the rotation with the pull and catch late</b>. Do not roll out of a half-done loop - that is how you meet the object sideways.' },
    { h:'Watch it done', tab:'Watch',
      p:['Eight minutes on the four sections - approach, punch, float, catch - with track drills you can copy in Liftoff on this very machine.'],
      videos:[
        { yt:'LTl0780qgCE', t:'How To Powerloop, An In-Depth Look', by:'FPV Academy', len:'7:59',
          cap:'the four beats, plus a Liftoff practice track' },
        { yt:'j-fJIPVe3fs', t:'Learn to Fly FPV - Lesson 15 - Beginner Power Loops', by:'Joshua Bardwell', len:'20:57', alt:true,
          cap:'<b>want more?</b> the full lesson, including how to bail out safely' }
      ] }
  ]
},
{
  id:'gs-trk-04', mod:'FLY', ord:110, title:'The Matty Flip', mins:3, kind:'read',
  cards:[
    { h:'A power loop, flown backwards', tab:'The move',
      p:['Named for Matty Stuntz. Dive at the gap, pitch <b>back</b> and punch, and loop over the top in reverse - with the camera holding the object the whole way round. It films better than anything else you will learn this year.'],
      steps:[
        { t:'Dive',  d:'nose down at the object, gentle speed' },
        { t:'Punch', d:'full throttle, pitch BACK' },
        { t:'Hold',  d:'the nose stays on the object as you go over' },
        { t:'Catch', d:'level and throttle on the far side' }
      ],
      facts:[
        { n:'★★★', l:'difficulty', c:'rust' },
        { n:'LOOP', l:'learn the power loop first' },
        { n:'2016', l:'the year it got its name' }
      ],
      art:'trickMatty', cap:'eyes on the prize, all the way over' },
    { h:'Watch it done', tab:'Watch',
      p:['First video: the pilot it is named after, teaching his own trick.'],
      videos:[
        { yt:'Twcj_8k_-vk', t:'Mattyflip with MattyStuntz - Trick Series', by:'Rotor Riot', len:'5:30',
          cap:'from the pilot it is named after' },
        { yt:'mZVjPSQHm9Y', t:'How To: Matty Flip', by:'headmazta', len:'3:58', alt:true,
          cap:'<b>short version</b> - the sticks and nothing else' }
      ],
      tip:'Every trick in this module is sitting in Liftoff and FPV.SkyDive on this machine, one tile away. Read, watch, then go crash where it is free.' }
  ]
},
{
  id:'gs-saf-02', mod:'SAF', ord:20, title:'The Brophy FPV rules sheet', mins:4, kind:'read',
  cards:[
    { h:'Six flight rules. Know them. Follow them.', tab:'The sheet',
      p:['This is the sheet on the wall by the simulators. Safe Flight is the badge that says you know it and you follow it - at all times you are with the Brophy FPV Club.'],
      steps:[
        { t:'Spotter for every goggle flight', d:'eyes on the aircraft the whole battery - that is the law, not a club habit' },
        { t:'Never over people',           d:'and never between you and the aircraft' },
        { t:'Call out your arm',           d:'in the flight zone, facing away, after the ARMING call' },
        { t:'Battery out to carry it',     d:'and packs live in their box or bag' },
        { t:'Props off on the bench',      d:'every time before a quad is plugged into a battery' },
        { t:'The instructor\'s word ends the flight', d:'"LAND" means now' }
      ],
      art:'propsOff', cap:'the sheet by the sims' },
    { h:'Who may fly what', tab:'Tiers',
      p:['The badges are not decoration. They are the club\'s answer to <b>who may touch which drone</b>, and that answer is checked before gear comes out of the case. Tiers 1, 2 and 3 each open with a <b>checkpoint</b>: a flight a mentor watches once every one of its <b>prerequisite</b> badges is ticked. Pass it and you are on that tier.'],
      cols:{ tone:'vs', ha:'You may', hb:'Once',
        a:['Fly any sim, any day','Fly the Meteor 75 for your Tiny Whoop checkpoint','Fly the Meteor 75 with the club','Fly the Pavo for your Pavo checkpoint','Fly the Pavo with the club, or any FPV drone at school','Fly at a school event or a race'],
        b:['You have a name at the kiosk','Its seven prerequisites are ticked - a mentor watches','You passed Tiny Whoop: you are Tier 1','Its five prerequisites are ticked - a mentor watches','You passed the Pavo 20 Pro Flight: you are Tier 2','Your five Event Pilot prerequisites are ticked - with a spotter and a mentor'] },
      tip:'Ask before you assume. A mentor can look you up on the kiosk in ten seconds.' },
    { h:'Fine, and not fine', tab:'Edge cases',
      p:['Most rule breaks are shortcuts, not rebellion. These are the ones the club actually sees.'],
      cols:{ tone:'dd', ha:'Fine', hb:'Not fine',
        a:['Calling ARMING, then a hover check on the pad','Spinning a tiny whoop\'s motors with props on, held down','Props on at the bench with a mentor supervising and the drone held or strapped down'],
        b:['Props on, battery in, nobody holding it','Arming without calling it out','Flying in goggles with nobody watching the aircraft'] },
      note:'Not sure whether something is allowed? Ask a mentor first.' }
  ]
},
{
  id:'gs-saf-quiz', mod:'SAF', ord:90, title:'Safe Flight quiz', mins:6, kind:'quiz', pool:'SAF',
  cards:[
    { h:'Ten questions. Eight to pass.', tab:'How it works', art:'checkride', cap:'ten questions, eighty to pass',
      p:['Ten questions drawn from the Safe Flight pool - the rules, the calls and the go / no-go - reshuffled every time. <b>80 to pass</b> earns the badge on the spot - no sign-off needed. Unlimited retakes; your best score is kept.'] }
  ]
},
/* ============================ SPOTTER (2026-10-10) ======================
   Quiz AND a mentor's sign-off: the quiz is the knowledge, the real flight
   spotted for a mentor is the badge. The mentor checks airspace law; the
   spotter checks the field. */
{
  id:'gs-spt-01', mod:'SPT', ord:10, title:'The spotter\'s job', mins:3, kind:'read',
  cards:[
    { h:'Your eyes are the pilot\'s eyes', tab:'The job',
      p:['In goggles the pilot sees only what the camera sees. You watch the <b>aircraft itself</b>, the whole battery, and say what the pilot cannot see. You will spot far more often than you fly.'],
      facts:[
        { n:'EYES',  l:'on the aircraft, the whole battery', c:'sky' },
        { n:'VOICE', l:'call it before it matters' },
        { n:'HAND',  l:'on the pilot\'s shoulder, if they want it' }
      ],
      art:'threeJobs', cap:'one flies. one watches.' },
    { h:'Before the battery goes in', tab:'The check',
      p:['Thirty seconds of looking around saves the flight. You check the <b>field</b>; a mentor checks that flying here is allowed today.'],
      steps:[
        { t:'Ask',   d:'a mentor: are we OK to fly here today?' },
        { t:'Look',  d:'people, pets, cars, trees, wires' },
        { t:'Agree', d:'where the pad is, and which way is "away"' },
        { t:'Check', d:'props tight, battery strapped, goggles on the right channel' }
      ],
      note:'You do not need to know airspace law to spot. Mentors have deep knowledge of the FAA rules and handle that part.' }
  ]
},
{
  id:'gs-spt-02', mod:'SPT', ord:20, title:'What to call', mins:3, kind:'read',
  cards:[
    { h:'The four calls', tab:'The four calls',
      p:['The pilot says them; you listen for them and repeat them if anyone nearby did not hear. Nobody walks out to the aircraft until they have heard DISARMED.'],
      steps:[
        { t:'Arming',   d:'before the props spin' },
        { t:'Takeoff',  d:'as it leaves the ground' },
        { t:'Landing',  d:'before it descends' },
        { t:'Disarmed', d:'props stopped. now people may walk' }
      ],
      art:'callouts', cap:'four words. hear all of them.' },
    { h:'What you call out', tab:'Your calls',
      p:['Short words, loud and early. "Person left" beats a full sentence.'],
      steps:[
        { t:'"PERSON"', d:'someone is walking in - the pilot lands' },
        { t:'"CAR" / "DOG" / "BIRD"', d:'anything moving toward the flight' },
        { t:'"HIGH" / "FAR"', d:'it is drifting out of your sight or up toward 400 ft' },
        { t:'"LAND"',   d:'anything you do not like - you never need a reason' }
      ],
      tip:'If you lose sight of the aircraft, say so at once: "I lost it." The pilot climbs or comes back toward you until you have it again.' },
    { h:'When to say LAND', tab:'LAND',
      cols:{ tone:'dd', ha:'Keep flying', hb:'Say LAND',
        a:['Someone watching from well outside the area','A bird far off and flying away','The aircraft in sight, near the pad'],
        b:['Someone walking into the flying area','You lost sight of the aircraft','You need to leave - a pilot never flies without a spotter'] },
      note:'Saying LAND is never wrong. A flight can always go again; a person cannot be un-hit.' }
  ]
},
{
  id:'gs-spt-quiz', mod:'SPT', ord:90, title:'Spotter quiz', mins:5, kind:'quiz', pool:'SPT',
  cards:[
    { h:'Ten questions. Eight to pass.', tab:'How it works', art:'checkride', cap:'ten questions, eighty to pass',
      p:['Ten questions on the job, the check and the calls, reshuffled every time. <b>80 to pass</b> - then a mentor watches you spot a real flight and signs the badge off. Unlimited retakes; your best score is kept.'] }
  ]
},
{
  id:'gs-bat-03', mod:'BAT', ord:30, title:'Charging, storage and disposal', mins:4, kind:'read',
  cards:[
    { h:'Charge at 1C, balanced, watched', tab:'Charging',
      p:['The charge current is the pack capacity in amps: a <b>1300 mAh</b> pack charges at <b>1.3 A</b>, a 300 mAh whoop pack at 0.3 A. Always on the balance lead, so the charger can hold every cell within a few millivolts of the others.'],
      facts:[
        { n:'1C', l:'charge rate: mAh ÷ 1000 = amps' },
        { n:'4.20 V', l:'full, per cell', c:'green' },
        { n:'BAL', l:'balance lead in, every time', c:'sky' },
        { n:'EYES', l:'never unattended', c:'rust' }
      ],
      art:'lipoSafety', cap:'hard surface, bag, somebody in the room' },
    { h:'Storage is 3.8 volts', tab:'Storage',
      p:['A full pack left full for a week is a pack that is dying. Within a day of flying, every pack goes to <b>storage voltage, 3.80-3.85 V per cell</b>. Most chargers have a Storage mode that charges or discharges to get there.'],
      cols:{ tone:'dd', ha:'Do', hb:'Don\'t',
        a:['Storage charge within a day','Keep packs in the LiPo bag, labelled','Store at room temperature'],
        b:['Leave packs full "for next week"','Leave packs flat (below 3.5 V) for days','Keep packs in a hot car or a backpack in the sun'] },
      tip:'Write the date on the tape when a pack goes into storage. A pack nobody has touched in three months gets checked before it flies.' },
    { h:'When a pack is finished', tab:'Disposal',
      p:['A pack is retired when it is puffed, has a cell that will not balance, has been in a hard crash twice, or sags so much it cannot finish a flight. Retired packs do not go in the bin.'],
      steps:[
        { t:'Mark it',        d:'tape across the connector, "DEAD" in marker' },
        { t:'Discharge it',   d:'fully, with the charger\'s discharge mode or a resistive load, outside the building' },
        { t:'Hand it in',     d:'to the instructor - the club takes them to a battery drop-off together' }
      ],
      note:'Never puncture, crush or burn a pack to "make it safe". Discharge, tape, hand in.' }
  ]
},
{
  id:'gs-bat-04', mod:'BAT', ord:40, title:'When a pack goes bad', mins:3, kind:'read',
  cards:[
    { h:'Puffed means retired', tab:'Puffing',
      p:['Gas inside the cell pushes the pouch out. A puffed pack is not "a bit tired" - the chemistry has started breaking down and it can go from warm to on fire with no warning. It does not get charged again. Ever.'],
      facts:[
        { n:'PUFF', l:'any swelling at all = retire', c:'rust' },
        { n:'HOT', l:'too hot to hold after a flight = watch it', c:'amber' },
        { n:'SMELL', l:'sweet chemical smell = get it outside now', c:'rust' }
      ],
      art:'lipo', cap:'flat pouch good. pillow bad.' },
    { h:'After a crash', tab:'Crashes',
      p:['Impact damage is invisible from outside and can take minutes to turn into heat. A pack that has been in a hard crash gets <b>watched for thirty minutes</b> - somewhere it cannot hurt anything, like a tin or the ground outside - before anybody charges it or packs it in a bag.'],
      tip:'Thirty minutes is longer than it feels. Note the time and fly a different pack.' },
    { h:'If it catches fire', tab:'Fire',
      p:['A LiPo fire is hot, fast and makes its own oxygen - it cannot be smothered. You do not fight it, you <b>contain</b> it and let it burn out.'],
      steps:[
        { t:'People back',   d:'everyone away, upwind of the smoke' },
        { t:'Do not touch it', d:'if it is already in the bag or the tin, leave it there' },
        { t:'Cool, don\'t smother', d:'a bucket of water or sand from arm\'s length is fine; a blanket is not' },
        { t:'Let it finish', d:'then nothing goes near it for an hour' },
        { t:'Tell the instructor', d:'and write the incident report' }
      ],
      note:'This is why packs charge on concrete, in a bag, with someone in the room. The procedure only works if the fire starts somewhere boring.' }
  ]
},
{
  id:'gs-bat-quiz', mod:'BAT', ord:90, title:'Battery Care quiz', mins:6, kind:'quiz', pool:'BAT',
  cards:[
    { h:'Ten questions. Eight to pass.', tab:'How it works', art:'checkride', cap:'ten questions, eighty to pass',
      p:['Voltages, charge rates, storage, crashes and fire. <b>80 to pass</b> earns Battery Care on the spot. Unlimited retakes; best score kept.'] }
  ]
},
{
  id:'gs-elc-03', mod:'ELC', ord:30, title:'Matching motor, ESC, prop and battery', mins:5, kind:'read',
  cards:[
    { h:'Four numbers that have to agree', tab:'The four',
      p:['A drone flies well when the <b>motor</b>, the <b>prop</b>, the <b>battery</b> and the <b>ESC</b> were chosen for each other. Get one wrong and the symptom is heat, sag, or a motor that cannot do what the prop asks of it.'],
      facts:[
        { n:'2207', l:'motor: 22 mm wide, 7 mm tall stator' },
        { n:'KV', l:'rpm per volt, unloaded', c:'sky' },
        { n:'5×4.3', l:'prop: diameter × pitch, inches', c:'amber' },
        { n:'45 A', l:'ESC: continuous amps per motor', c:'green' }
      ],
      art:'sixParts', cap:'the stator size is the motor\'s size' },
    { h:'KV against cell count', tab:'KV',
      p:['Motor speed is <b>KV × volts</b>. More cells means more volts, so the same KV spins faster on 6S than on 4S. That is why a 6S build uses a <b>lower</b> KV motor than a 4S build of the same size - the goal is the same prop speed either way.'],
      cols:{ tone:'vs', ha:'4S 5-inch', hb:'6S 5-inch',
        a:['2207 · 2400-2750 KV','16.8 V full','higher current, thicker wires'],
        b:['2207 · 1700-1950 KV','25.2 V full','lower current, cooler ESC'] },
      tip:'Lower KV on more cells is the efficient direction. High KV on high voltage is how you cook a motor in one flight.' },
    { h:'ESC amps and C rating', tab:'Current',
      p:['Every part in the current path has a limit. The ESC rating is per motor; the battery rating is for the whole pack. <b>Current = capacity × C</b>: a 1300 mAh 100C pack can supply 130 A, more than four 30 A motors will ever draw together.'],
      steps:[
        { t:'Find the motor\'s max amps', d:'on its data sheet, for your prop and cells' },
        { t:'ESC must exceed it',          d:'with margin - 45 A ESC for a 35 A motor' },
        { t:'Pack must cover all four',    d:'capacity × C ≥ 4 × motor amps, with margin' }
      ],
      note:'C ratings on cheap packs are optimistic. If a pack gets hot in a two-minute flight, treat its real C as half the label.' }
  ]
},
{
  id:'gs-elc-04', mod:'ELC', ord:40, title:'Why a 3-inch and a 5-inch differ', mins:3, kind:'read',
  cards:[
    { h:'Same parts list, different numbers', tab:'Three sizes',
      p:['Every quad in the club has the same six parts. What changes with size is how much air each prop moves per turn - and so how big, how fast and how hungry everything else has to be.'],
      cols:{ tone:'vs', ha:'Meteor 75 · whoop', hb:'5-inch freestyle',
        a:['0802 motor · ~20 000 KV · 1S','40 mm prop, ducted','5 A all-in-one board','300 mAh · flies 4 min','under 30 g'],
        b:['2207 motor · ~1800 KV · 6S','127 mm prop, 3 blades','45-60 A ESC','1300 mAh · flies 4 min','600 g+'] },
      art:'quadTop', cap:'the prop decides the rest' },
    { h:'The cinewhoop in the middle', tab:'Cinewhoop',
      p:['The Pavo 20 Pro and Cinebot 35 sit between the two: 2-3.5 inch ducted props, 3S-6S, 20-35 A, built to carry a camera smoothly rather than to race. Ducts protect people and props; they also cost efficiency, which is why cinewhoops fly short.'],
      tip:'When you are asked to pick parts for a frame, start from the prop size. It fixes the motor size, which fixes the current, which fixes the ESC and the battery.' }
  ]
},
{
  id:'gs-elc-quiz', mod:'ELC', ord:90, title:'Electrical Components quiz', mins:6, kind:'quiz', pool:'ELC',
  cards:[
    { h:'Ten questions. Eight to pass.', tab:'How it works', art:'checkride', cap:'ten questions, eighty to pass',
      p:['Parts, thrust, KV, current and which numbers go with which frame. <b>80 to pass</b> earns the badge. Unlimited retakes; best score kept.'] }
  ]
},
{
  id:'gs-rad-04', mod:'RAD', ord:40, title:'Control links: ELRS, Crossfire, binding, failsafe', mins:5, kind:'read',
  cards:[
    { h:'Two radios on every quad', tab:'Two links',
      p:['Video comes <b>down</b> from the aircraft on 5.8 GHz. Control goes <b>up</b> on a different band: <b>2.4 GHz</b> or <b>900 MHz</b>. They are separate systems with separate antennas, and losing one does not mean losing the other.'],
      facts:[
        { n:'2.4 GHz', l:'ELRS 2.4: fast, small antennas, the club default', c:'sky' },
        { n:'900 MHz', l:'ELRS 900 / Crossfire: slower, goes further and through trees', c:'amber' },
        { n:'5.8 GHz', l:'video, down only', c:'green' }
      ],
      art:'videoChain', cap:'control up, video down' },
    { h:'ELRS in one card', tab:'ELRS',
      p:['ExpressLRS is open source and runs on nearly every club radio and receiver. Three settings matter: the <b>packet rate</b> (how many times a second your sticks are sent), the <b>bind phrase</b> (which receivers answer to your radio), and <b>telemetry</b> (the aircraft reporting back - link quality, battery).'],
      cols:{ tone:'vs', ha:'Higher packet rate', hb:'Lower packet rate',
        a:['250-500 Hz','less latency','shorter range, more sensitive to interference'],
        b:['50-100 Hz','more range','fine for cinewhoops and long shots'] },
      tip:'The club bind phrase is the same on every club receiver. Flashing a new receiver with it is part of the Betaflight badge.' },
    { h:'Failsafe is the thing you set before you need it', tab:'Failsafe',
      p:['When the receiver stops hearing the radio, the flight controller runs the <b>failsafe</b> - and what that does <b>depends on how that drone is set up</b>. Small quads with no GPS are usually set to drop (motors off); others may be set to land or, with GPS, to fly home. Know what the one in your hands does.'],
      steps:[
        { t:'Check it', d:'Betaflight Failsafe tab: what is this drone set to do, and how fast?' },
        { t:'Test it',  d:'props OFF, arm, switch the radio off - it should do what it is set to' },
        { t:'Ask',      d:'not sure what a quad does? Ask a mentor before you fly it' }
      ],
      note:'Every drone can be different. Never assume a quad behaves like the last one you flew.' }
  ]
},
{
  id:'gs-rad-05', mod:'RAD', ord:50, title:'Interference at an event', mins:3, kind:'read',
  cards:[
    { h:'A gym full of phones', tab:'Crowds',
      p:['2.4 GHz is also Wi-Fi and Bluetooth. A stadium or gym with a thousand phones is the noisiest place a 2.4 GHz link will ever fly. Range that was easy at the field drops, and the link quality number on your OSD is the warning.'],
      facts:[
        { n:'LQ', l:'link quality: below 70 %, turn back', c:'amber' },
        { n:'RSSI', l:'signal strength: falls with distance and bodies', c:'sky' },
        { n:'900', l:'MHz link for big outdoor events', c:'green' }
      ],
      art:'linkBlockers', cap:'people are made of water. water eats 2.4 GHz.' },
    { h:'Two pilots, one room', tab:'Sharing the air',
      p:['Control links share fine - ELRS hops channels. <b>Video does not</b>. Two pilots on the same 5.8 GHz channel see each other\'s feed, and digital systems need a channel each too. Before anyone powers up at an event, the spotter runs the channel list.'],
      steps:[
        { t:'Agree channels before power-up', d:'Raceband, one per pilot, written on the board' },
        { t:'Power up one at a time',          d:'and confirm the picture is yours' },
        { t:'Watch LQ, not just the picture',  d:'video can look fine while control is about to go' }
      ],
      tip:'If your link quality falls at an event, fly back toward yourself and land. Nobody will remember the shot you did not get; everyone will remember the quad in the crowd.' }
  ]
},
{
  id:'gs-rad-06', mod:'RAD', ord:60, title:'Digital video: goggles, recording and D-log', mins:4, kind:'read',
  cards:[
    { h:'Bind once, fly all day', tab:'Binding',
      p:['A digital video unit (the O4 on the Meteor and the Pavo) pairs to one set of goggles like a phone to headphones. Power the quad, put the goggles in pairing mode, press the bind button on the air unit, wait for the picture. It stays bound until you bind something else - so if your picture is gone, ask who flew the goggles last.'],
      steps:[
        { t:'Props off, battery in',           d:'binding is a bench job' },
        { t:'Goggles: link / pair',            d:'from the goggles menu' },
        { t:'Air unit: hold the bind button',  d:'until the LED blinks' },
        { t:'Picture, then OSD',               d:'no OSD means the flight controller is not talking to the unit' }
      ],
      tip:'Two pilots in one room each need their own goggles and their own air unit. Digital does not share a channel the way analog does.' },
    { h:'Recording for the editor', tab:'Recording',
      p:['The air unit records to its own card. Set the resolution and frame rate <b>before</b> the shoot, not at the field: 4K at 60 for footage that will be slowed down, 1080 at 120 for racing. <b>D-log</b> records a flat, grey-looking picture that holds more light and shadow so the editor can grade it; normal mode looks finished straight away and cannot be pushed as far.'],
      facts:[
        { n:'D-LOG', l:'flat profile, grade it later - for Best of Brophy', c:'green' },
        { n:'NORMAL', l:'looks done now - for quick clips and the kiosk reel', c:'sky' },
        { n:'ND', l:'a sunglasses filter for the lens: slower shutter, smoother motion outdoors', c:'amber' }
      ],
      cols:{ tone:'vs', ha:'Bright day outside', hb:'Gym or indoors',
        a:['ND8 or ND16 on the lens','D-log if it will be graded','Shutter about twice the frame rate'],
        b:['No ND','Normal unless the editor asks','Watch for flicker under LED lights'] } }
  ]
},
{
  id:'gs-rad-quiz', mod:'RAD', ord:90, title:'Radio Protocol quiz', mins:6, kind:'quiz', pool:'RAD',
  cards:[
    { h:'Ten questions. Eight to pass.', tab:'How it works', art:'checkride', cap:'ten questions, eighty to pass',
      p:['Analog against digital, channels, antennas, control links, failsafe, and setting up a digital video system. <b>80 to pass</b> earns the badge. Unlimited retakes; best score kept.'] }
  ]
},
{
  id:'gs-asp-02', mod:'EVT', ord:6, title:'B4UFLY, LAANC and TRUST', mins:4, kind:'read',
  cards:[
    { h:'Three letters you need', tab:'The three',
      p:['Recreational flying in the United States comes with three things every club pilot carries: a <b>TRUST</b> certificate, a <b>B4UFLY</b> check of where you are standing, and - inside controlled airspace - a <b>LAANC</b> authorization before take-off.'],
      facts:[
        { n:'TRUST', l:'free online test, cannot be failed, print the certificate', c:'green' },
        { n:'B4UFLY', l:'the map that says what airspace you are in', c:'sky' },
        { n:'LAANC', l:'near-instant permission to fly in controlled airspace, up to the grid ceiling', c:'amber' }
      ],
      art:'ceiling', cap:'400 ft is the ceiling in uncontrolled air. near an airport it can be 0.' },
    { h:'Brophy is just outside Sky Harbor', tab:'Our airspace',
      p:['Phoenix Sky Harbor is Class B. On B4UFLY its surface area is the <b>orange grid</b>, and its edge runs a few blocks south of campus. Brophy itself is <b>outside</b> it, in uncontrolled airspace: the ceiling is the normal <b>400 ft</b> and no LAANC authorization is needed. Cross into the orange grid and the rules change - there the grid ceiling applies and you need LAANC. Indoors (the gym, the IC) the FAA rules do not apply.'],
      tip:'Check anyway, every time - the edge is close, and temporary flight restrictions appear for games and VIP visits. At club flights a mentor does this check.' },
    { h:'Registration and Remote ID', tab:'Paperwork',
      p:['Anything over <b>250 g</b> takes off must be registered (five dollars, three years) and broadcast Remote ID. The Meteor 75 and the Pavo 20 are under 250 g and need neither. The 5-inch and the Cinebot 35 are over, and the club registers them.'],
      cols:{ tone:'vs', ha:'Under 250 g', hb:'Over 250 g',
        a:['No registration','No Remote ID','TRUST still required'],
        b:['Registered, number on the frame','Remote ID module or built in','TRUST still required'] } }
  ]
},
{
  id:'gs-emg-01', mod:'EVT', ord:40, title:'Failsafe: set it, test it', mins:3, kind:'read',
  cards:[
    { h:'Know what your drone does', tab:'Set',
      p:['Failsafe is what the aircraft does the moment it stops hearing you. It is <b>set per drone</b> in Betaflight, so the procedure and the timing can differ from one quad to the next. Before an event, find out what each quad you will fly is set to.'],
      facts:[
        { n:'DROP',   l:'motors off, it falls where it is', c:'rust' },
        { n:'LAND',   l:'a slow descent on its own' },
        { n:'RESCUE', l:'GPS drones fly back toward home', c:'sky' }
      ] },
    { h:'Test it on the bench, props off', tab:'Test',
      p:['A failsafe nobody has tested is a guess. The test is thirty seconds and part of every Betaflight badge sign-off.'],
      steps:[
        { t:'Props off, battery in',  d:'on the bench, nowhere near the pad' },
        { t:'Arm',                     d:'motors idle' },
        { t:'Switch the radio off',    d:'and watch' },
        { t:'It does what it is set to', d:'and the OSD says FAILSAFE' },
        { t:'Radio back on',           d:'the quad must stay disarmed until you re-arm' }
      ],
      note:'If it does not do what it is set to, the quad does not fly until it is fixed. No exceptions, no "it is probably fine".' }
  ]
},
{
  id:'gs-emg-02', mod:'EVT', ord:50, title:'Flyaway and lost video', mins:4, kind:'read',
  cards:[
    { h:'Video gone, control still there', tab:'Lost video',
      p:['The most common emergency. Your goggles go black or to snow, but the aircraft is still listening. You are now a line-of-sight pilot whose spotter can see the quad and you cannot.'],
      steps:[
        { t:'Throttle to a hover, say "VIDEO OUT"', d:'the spotter takes over the calls' },
        { t:'Spotter calls the position',           d:'"ten metres out, head height, nose left"' },
        { t:'Climb a little, turn toward yourself', d:'analog video usually comes back as you get closer' },
        { t:'Still nothing? Land where it is',      d:'a slow descent on the spotter\'s calls, or disarm over grass' }
      ],
      art:'recoverSteps', cap:'hover. call. come home. land.' },
    { h:'Control gone', tab:'Flyaway',
      p:['A real flyaway - the aircraft not responding at all - is rare with a tested failsafe, because the failsafe has already taken over. If it is still flying, it is still hearing <i>something</i>.'],
      cols:{ tone:'dd', ha:'Do', hb:'Don\'t',
        a:['Switch the radio off and on - a reconnect often fixes it','Watch where it goes and note the time','Say it out loud so everyone looks up'],
        b:['Run after it in goggles','Assume it will come back on its own','Keep it quiet to avoid embarrassment'] },
      tip:'The lost-video drill in Flight prep is this lesson with a stick in your hand. Do it until the hover is automatic.' }
  ]
},
{
  id:'gs-emg-03', mod:'EVT', ord:60, title:'LiPo fire and injury', mins:3, kind:'read',
  cards:[
    { h:'Fire: contain, do not fight', tab:'Fire',
      p:['Battery Care covers the chemistry. Here is the drill, because in the moment you will not have time to remember the chemistry.'],
      steps:[
        { t:'"FIRE" - everyone back', d:'upwind, ten metres, nobody films from close' },
        { t:'Leave it in the bag or tin', d:'that is what they are for' },
        { t:'Water or sand from arm\'s length', d:'to cool the area, not to smother' },
        { t:'Let it burn out, then an hour', d:'before anybody touches it' },
        { t:'Report it',              d:'same day' }
      ],
      art:'lipoSafety', cap:'the bag is the plan' },
    { h:'Injury: the flight is over', tab:'Injury',
      p:['A prop cut is the club\'s most likely injury. It bleeds a lot and looks worse than it is - but the flight ends, and the person comes first.'],
      steps:[
        { t:'Disarm everything',   d:'every quad on the ground, radios down' },
        { t:'Pressure on the cut', d:'clean cloth, hold it, elevate' },
        { t:'Get an adult',        d:'instructor, coach, nurse - whoever is closest' },
        { t:'Then the report',     d:'what happened, which quad, who saw it' }
      ],
      note:'A spotter who calls "STOP" for a person walking in prevents more injuries than any first-aid kit.' }
  ]
},
{
  id:'gs-emg-04', mod:'EVT', ord:70, title:'The incident report', mins:2, kind:'read',
  cards:[
    { h:'Written the same day, every time', tab:'Report',
      p:['Crash with damage, injury, a fire, a flyaway, a complaint from anyone - all of them get a report, to <b>mtucker27@brophybroncos.org</b>, the same day. It is not punishment. It is how the club learns and how it keeps permission to fly on campus.'],
      steps:[
        { t:'When and where',   d:'date, time, place' },
        { t:'Who',              d:'pilot, spotter, anyone involved or hurt' },
        { t:'What',             d:'in order, plainly, no blame' },
        { t:'Damage',           d:'to people, to gear, to anything else' },
        { t:'Photos',           d:'the aircraft, the place, the pack if it was the pack' },
        { t:'What would have prevented it', d:'one honest sentence' }
      ],
      tip:'A report that says "I armed on the bench with props on and cut my hand" is worth more to the club than a year of perfect flights. Write it.' }
  ]
},
{
  id:'gs-emg-05', mod:'EVT', ord:80, title:'Scenario drill', mins:4, kind:'read',
  cards:[
    { h:'Three scenarios, pick the response', tab:'Drill',
      p:['Read each one as if it is happening. Then answer the three checks below - they are the drill.'],
      cols:{ tone:'vs', ha:'Scenario', hb:'First move',
        a:['Goggles go to snow 20 m out','Smoke from the charging table','A student walks onto the pad mid-flight'],
        b:['Hover, say VIDEO OUT, spotter calls','FIRE, everyone back, leave it in the bag','LAND - now, not after the gap'] } }
  ],
  check:[
    { q:'Video drops to black at 15 m. The spotter can see the quad. What do you do first?',
      opts:['Pull the goggles off and look for it','Hover and say VIDEO OUT','Disarm immediately','Full throttle up to get signal back'],
      a:1, why:'Hover and hand the calls to the spotter. Disarming at 15 m out is a crash; climbing blind near people is worse.' },
    { q:'A pack in the LiPo bag starts smoking. Best action?',
      opts:['Open the bag and pull the pack out to the floor','Throw a jacket over the bag','Move people back and leave it in the bag','Carry the bag outside'],
      a:2, why:'The bag is the containment. Opening it, covering it or carrying it all put a person next to a fire that is about to flare.' },
    { q:'After a crash that broke a prop and dented a wall, what gets written?',
      opts:['Nothing, no one was hurt','A note in the group chat','An incident report to the instructor, same day','A report only if the wall owner complains'],
      a:2, why:'Damage to anything other than the aircraft is an incident. Same day, plainly, with photos.' }
  ]
},
{
  id:'gs-evt-01', mod:'EVT', ord:10, title:'The flight zone', mins:4, kind:'read',
  cards:[
    { h:'Draw the box before the battery goes in', tab:'The box',
      p:['At a game, a dance or a rally the club does not fly "around". It flies inside a <b>zone</b> that was agreed, marked and briefed before anyone powered up - and nobody is in the zone unless they are crew or have agreed to be in the shot.'],
      facts:[
        { n:'LINE', l:'a rope, cones or tape between crew and crowd', c:'rust' },
        { n:'8 m', l:'minimum from the line to any flight path', c:'amber' },
        { n:'PAD', l:'one take-off spot, marked, facing away from people', c:'sky' },
        { n:'OUT', l:'an abort direction that is always empty', c:'green' }
      ],
      art:'ceiling', cap:'crew inside, crowd outside, nothing above anyone' },
    { h:'Who stands where', tab:'Positions',
      p:['The pilot stands where the spotter can touch their shoulder. The spotter stands where they can see the whole zone and the crowd line. Batteries, chargers and spare quads live on a table <b>behind</b> the pilot, never in the zone.'],
      cols:{ tone:'dd', ha:'In the zone', hb:'Never in the zone',
        a:['The aircraft','A marked pad','Gates or props for the shot'],
        b:['Spectators, even "just one"','The charging table','A second pilot\'s quad, powered'] },
      tip:'If the organiser wants the drone closer to the crowd than the line allows, ask the mentor on site. If the answer is no, the shot changes. That is what the Event Ops badge means.' }
  ]
},
{
  id:'gs-evt-02', mod:'EVT', ord:20, title:'Briefing bystanders', mins:3, kind:'read',
  cards:[
    { h:'Thirty seconds, out loud', tab:'The brief',
      p:['Before the first flight, the spotter briefs whoever is near the line: organisers, the nearest spectators, the photographer. It is short, friendly and specific.'],
      steps:[
        { t:'"We are flying a drone in this box for the next ten minutes"', d:'point at the line' },
        { t:'"Please stay behind the tape"', d:'and do not walk toward it, even for a photo' },
        { t:'"If I say LAND, we are landing"', d:'nothing is wrong, it is just the rule' },
        { t:'"Questions? Ask me, not the pilot"', d:'the pilot is in goggles and cannot hear you' }
      ],
      art:'threeJobs', cap:'the spotter talks. the pilot flies.' },
    { h:'People who do not listen', tab:'When it goes wrong',
      p:['Someone will step over the line - a kid, a photographer, a coach with a question. The response is the same one from Safe Flight: the pilot <b>lands</b>, the spotter walks the person back, and the flight resumes when the zone is clear.'],
      note:'Never argue with someone inside the zone while the aircraft is up. Land first. Everything else can wait four seconds.' }
  ]
},
{
  id:'gs-evt-03', mod:'EVT', ord:30, title:'Pilot and spotter call-outs', mins:3, kind:'read',
  cards:[
    { h:'The same four calls, louder', tab:'Calls',
      p:['ARMING, TAKEOFF, LANDING, DISARMED - the four calls from Safe Flight - at an event, said loudly enough for the crew table to hear over a crowd. Plus three the spotter owns.'],
      steps:[
        { t:'"CLEAR"',      d:'spotter: the zone is empty, you may arm' },
        { t:'"PERSON"',     d:'spotter: someone is near or over the line - pilot holds or lands' },
        { t:'"LAND LAND LAND"', d:'anyone: the flight ends now, no questions' },
        { t:'"BATTERY"',    d:'pilot: thirty seconds left, coming home' }
      ],
      art:'callouts', cap:'words, not hand signals - the pilot cannot see you' },
    { h:'The handover', tab:'Handover',
      p:['Two pilots sharing a zone swap on the ground, never in the air. DISARMED from the first, pack out, CLEAR from the spotter, then ARMING from the second. One aircraft in the zone at a time unless the event was planned as a race with its own gates and marshals.'],
      tip:'Practise the calls at the field until they are boring. At the rally there will be a thousand people and a PA system, and the only thing that will cut through is a habit.' }
  ]
},
{
  id:'gs-evt-quiz', mod:'EVT', ord:90, title:'Event Ops quiz', mins:6, kind:'quiz', pool:'EVT',
  cards:[
    { h:'Ten questions. Eight to pass.', tab:'How it works', art:'checkride', cap:'ten questions, eighty to pass',
      p:['The airspace check, the zone, the brief, the calls and the handover, plus failsafe, flyaway, fire and the incident report. <b>80 to pass</b>, then a mentor watches you set up and run a real flight zone to sign the badge off. Unlimited retakes; best score kept.'] }
  ]
}
];

/* ---------------------------------------------------------------------------
   CHECKRIDE POOL
   Sixteen are drawn per attempt, weighted so every module is represented.
   'mod' is used for that weighting - keep it accurate when adding questions.
   --------------------------------------------------------------------------- */
var GS_QUIZ = [
/* --- SAF / BAT / airspace (EVT since 2026-10-07) - from the old M1 --- */
{ mod:'RAD', q:'Your goggles show no picture from the quad you just powered up. Most likely cause?',
  opts:['The battery is low','The air unit is bound to a different set of goggles','The props are on backwards','The quad is too far away'], a:1,
  why:'Digital units stay bound to the last goggles that paired with them. On a shared fleet, "no picture on the bench" is almost always somebody else\'s binding.' },
{ mod:'RAD', q:'You are shooting a clip for Best of Brophy that the editor will colour-grade. Which recording setting?',
  opts:['Normal, so it looks finished','D-log, the flat profile','The lowest resolution to save card space','It does not matter, grading fixes anything'], a:1,
  why:'D-log keeps more light and shadow for the grade. Normal looks done straight away but cannot be pushed as far.' },
{ mod:'RAD', q:'Outdoors on a bright day the footage looks jittery and over-sharp. What goes on the lens?',
  opts:['A wider lens','An ND filter','Nothing, raise the frame rate','A polariser only'], a:1,
  why:'An ND filter is sunglasses for the camera: it lets the shutter slow down so motion blurs naturally.' },
{ mod:'RAD', q:'What do a radio control link and visible light have in common?',
  opts:['Nothing - radio is a kind of sound','Both are electromagnetic waves moving at the speed of light','Both need air to travel through','Both are stopped by glass'], a:1,
  why:'Radio, the video link and light are all electromagnetic waves. Only the frequency, and so the wavelength, is different.' },
{ mod:'RAD', q:'Why does 5.8 GHz video break up behind a tree when 900 MHz control does not?',
  opts:['5.8 GHz is limited to less power by law','Its shorter wavelength is soaked up more easily by leaves and water','Trees only block digital video','900 MHz bends around everything'], a:1,
  why:'Higher frequency means a shorter wave: more data, but leaves, walls and people stop it. Lower frequencies get through.' },
{ mod:'SAF', q:'Somebody walks into the flying area while you are up. What do you do?',
  opts:['Fly around them and keep going','Hover in place until they leave','Land','Climb above them'], a:2,
  why:'You land. Flying around a person keeps a moving aircraft near them, and hovering just makes the decision later.' },
{ mod:'SAF', q:'When may somebody walk downrange?',
  opts:['When the aircraft looks like it has landed','After they hear the "Disarmed" call','When the pilot takes their goggles off','As soon as it touches the ground'], a:1,
  why:'The "Disarmed" call means props stopped. Anything you infer by looking is a guess, and props are still turning for a while after touchdown.' },
{ mod:'SAF', q:'You need to change a Betaflight setting on a 5-inch at the Brophy bench, battery plugged in. What comes off first?',
  opts:['The battery','The props','The antenna','Nothing, it is only a setting'], a:1,
  why:'Props come off whenever the battery is plugged in on the bench. One wrong click in Betaflight and somebody gets hurt.' },
{ mod:'EVT', q:'Your aircraft weighs 620 g with the battery in. What does the FAA need?',
  opts:['Nothing, it is under 1 kg','It registered, with the number visible outside','A Part 107 certificate regardless of purpose','A LAANC authorisation for every flight'], a:1,
  why:'250 g and up gets registered, with the registration marked on the outside where you can read it without tools.' },
{ mod:'BAT', q:'A pack was in a hard crash ten minutes ago and looks fine. What now?',
  opts:['Charge it, it looks fine','Fly it again to use it up','Watch it for half an hour before it goes near a charger','Straight in the household bin'], a:2,
  why:'Crash damage inside a cell can start a fire minutes later. It gets watched for half an hour, somewhere it cannot hurt anything, before it goes anywhere near a charger.' },
{ mod:'EVT', q:'A crewed helicopter comes low over the field. What is the priority?',
  opts:['Hold position so it can see you','Land or descend immediately and give way','Climb to be more visible','Continue, they must give way to you'], a:1,
  why:'You always give way to crewed aircraft, immediately. They very likely cannot see you and could not dodge if they did.' },
{ mod:'BAT', q:'A 6S pack reads 25.2 V. What state is it in?',
  opts:['Storage charge','Fully charged','Land-now','Over-discharged'], a:1,
  why:'25.2 divided by 6 is 4.20 V per cell, which is full. Storage would be 22.8 V.' },
{ mod:'BAT', q:'A 3S pack reads 10.5 V at rest. What now?',
  opts:['Normal, fly it','Land-now territory - charge it, do not fly it','Perfect storage charge','It is ruined, bin it'], a:1,
  why:'10.5 over 3 is 3.50 V a cell - the land-now number. Not ruined, but it does not fly again before charging.' },
{ mod:'BAT', q:'How much current can a 1300 mAh 75C pack deliver?',
  opts:['about 9.75 A','about 97.5 A','about 975 A','about 75 A'], a:1,
  why:'1300 divided by 1000 is 1.3 Ah, times 75C is 97.5 A.' },
{ mod:'ELC', q:'You want to roll to the right. Which motors speed up?',
  opts:['The two on the right','The two on the left','The two at the back','One diagonal pair'], a:1,
  why:'More thrust on the left tips the aircraft to the right. Same logic as pitch, rotated ninety degrees.' },
{ mod:'ELC', q:'Why do diagonal props spin in the same direction as each other?',
  opts:['So the motors wear evenly','So the twisting forces cancel and it does not spin on its own','So all four props can be identical','To reduce noise'], a:1,
  why:'Each spinning prop tries to twist the airframe the opposite way. Pairing them off cancels it, and deliberately unbalancing it is how yaw works.' },
{ mod:'ELC', q:'A motor is too hot to hold right after landing. Most likely?',
  opts:['Normal for brushless motors','A bent shaft, a dry bearing, or something wound round it','The battery C rating is too high','The ESC is undersized for the pack'], a:1,
  why:'Warm is normal, too-hot-to-hold is not. It means something is binding, and it will get worse.' },
{ mod:'RAD', q:'The receiver stops hearing the transmitter. What happens?',
  opts:['Nothing, it keeps its last input','Failsafe runs - whatever that drone is set up to do','It always flies home','It switches to angle mode'], a:1,
  why:'Failsafe is set per drone. Know what the one you are flying does before you take off.' },
{ mod:'ELC', q:'Which part is designed to break in a crash?',
  opts:['The frame arms','The flight controller','The motors','The ESCs'], a:0,
  why:'Arms snap on purpose. They are the cheapest part on the aircraft and they break instead of the expensive ones.' },
{ mod:'RAD', q:'Your goggles show heavy static that clears as you fly back toward yourself. Which system, and what does it tell you?',
  opts:['Digital, and the link is about to cut','Analog, and you are at the edge of range - turn back','Digital, and the antenna is mismatched','Analog, and the VTX is failing'], a:1,
  why:'That gradual grain-to-snow slide is analog. It is a distance gauge, and it is telling you this is as far as you go.' },
{ mod:'RAD', q:'A digital link goes from a perfect picture to a frozen block of pixels to black. What is the lesson?',
  opts:['The goggles are faulty','Digital gives almost no warning, so watch link quality instead','Digital has more range than analog','You should raise the VTX power'], a:1,
  why:'Compressed video is fine until it is not. With no gradient to read, the number in the OSD is your only early warning.' },
{ mod:'RAD', q:'Two pilots power up on the same 5.8 GHz channel. What do they see?',
  opts:['They take turns, both pictures flicker','Both pictures tear each other apart and neither can fly','The stronger transmitter wins cleanly','Nothing changes if they are far apart'], a:1,
  why:'Video transmitters do not share a frequency. Both feeds are destroyed, and anyone in goggles is blind.' },
{ mod:'RAD', q:'Why does Raceband exist?',
  opts:['It is legal in more countries','Its channels are spaced further apart, so more pilots can fly at once','It has lower latency','It carries more power'], a:1,
  why:'The other bands pack channels too close together to run several aircraft simultaneously. R spreads them out.' },
{ mod:'RAD', q:'What must never happen to a video transmitter?',
  opts:['Being run at 25 mW','Being powered up with no antenna fitted','Being used on Raceband','Being mounted near the flight controller'], a:1,
  why:'With no antenna the output reflects back into the amplifier and cooks it within seconds. Antenna first, battery second.' },
{ mod:'RAD', q:'Your VTX antenna is RHCP. What goes on the goggles?',
  opts:['LHCP, so they complement each other','RHCP - handedness must match','Either, it makes no difference','A linear antenna'], a:1,
  why:'Mismatched handedness throws away most of the signal before you even take off.' },
{ mod:'RAD', q:'What does a diversity receiver actually do?',
  opts:['Doubles the transmit power','Runs two receivers with different antennas and plays whichever picture is better','Receives two channels at once','Splits the video to two pairs of goggles'], a:1,
  why:'Two receivers, usually an omni and a patch, and the goggles switch between them frame by frame.' },
{ mod:'RAD', q:'Same distance, but the aircraft is low over grass instead of high up, and the video is much worse. Why?',
  opts:['Ground effect from the props','The ground and everything on it is in the signal path','Cold air absorbs 5.8 GHz','The VTX heats up near the ground'], a:1,
  why:'Height is the cheapest range upgrade there is, because it clears the path.' },
{ mod:'FLY', q:'In Mode 2, what is the left stick left and right?',
  opts:['Roll','Yaw','Pitch','Trim'], a:1,
  why:'Left stick: throttle up and down, yaw left and right. Roll is the right stick.' },
{ mod:'FLY', q:'Which channel does NOT spring back to centre?',
  opts:['Roll','Pitch','Yaw','Throttle'], a:3,
  why:'Throttle stays where you put it, because that is the one setting you want held.' },
{ mod:'FLY', q:'You centre the sticks in rate mode while banked over. What happens?',
  opts:['It levels itself','It stops rotating but stays banked over','It continues rolling','It drops to angle mode'], a:1,
  why:'In rate mode the stick commands rotation speed. Centre means "stop rotating", not "return to level".' },
{ mod:'FLY', q:'You centre the sticks in angle mode while banked over. What happens?',
  opts:['It stays banked','It returns to level by itself','It keeps rolling','It descends'], a:1,
  why:'In angle mode the stick asks for a lean angle. Zero stick means zero lean, so it levels.' },
{ mod:'FLY', q:'Which mode can fly inverted?',
  opts:['Angle','Rate','Both','Neither'], a:1,
  why:'Angle mode has a hard lean limit, so it cannot go past it. Every flip and roll in FPV is rate mode.' },
{ mod:'FLY', q:'What is the sign of a beginner on the throttle?',
  opts:['Holding a constant mid-throttle','Large, late, on-off corrections','Using the throttle trim','Flying in angle mode'], a:1,
  why:'Full-nothing-full is the beginner sawtooth. Good throttle work is small, early and continuous.' },
{ mod:'FLY', q:'Best way to hold a hover?',
  opts:['Set the throttle exactly right and leave it','Constant small corrections, made early','Large corrections when it drifts far enough to see','Switch to angle mode and let go'], a:1,
  why:'A hover is kept, not set. The aircraft is always leaving it and you are always putting it back.' },
{ mod:'FLY', q:'The aircraft is 30 m out with the nose pointed at you. You push the right stick left. Which way does it go?',
  opts:['To your left','To your right','Straight toward you','It yaws left'], a:1,
  why:'Nose-in reverses roll. Its left is your right, so it tracks to your right.' },
{ mod:'FLY', q:'Nose pointing away from you. Push the right stick left. Which way?',
  opts:['To your left','To your right','Toward you','Away from you'], a:0,
  why:'Nose away is the easy case: the aircraft and you agree, so left is left.' },
{ mod:'FLY', q:'First step when you have lost orientation?',
  opts:['Yaw until it looks right','Centre pitch and roll to level it','Cut the throttle','Climb hard'], a:1,
  why:'LEVEL first. Stop making it worse, then buy time, then work out which way it is facing.' },
{ mod:'FLY', q:'What are the four recovery steps, in order?',
  opts:['Yaw, level, hold, go','Level, hold, yaw, go','Hold, yaw, level, go','Level, yaw, go, hold'], a:1,
  why:'LEVEL, HOLD, YAW, GO. Level it, gain a little height for thinking time, turn the nose away, then move.' },
{ mod:'FLY', q:'You cannot get your orientation back and it is drifting. Best option?',
  opts:['Guess and hope','Full throttle and climb out of trouble','Throttle down, over grass, now','Yaw hard until it snaps into place'], a:2,
  why:'A controlled descent into grass costs props. Guessing costs the aircraft or somebody\'s window.' },
{ mod:'FLY', q:'The video cuts out completely while you are in goggles. What do you do?',
  opts:['Pull the goggles off immediately','Level, ease the throttle down, and let it land','Hold your last input and wait','Full throttle to climb clear'], a:1,
  why:'Ripping the goggles off loses every reference you had. Level and descend smoothly - a landing you cannot see beats a crash you caused.' },
{ mod:'FLY', q:'On analog, the picture flickers back for a second and dies again. Which way do you fly?',
  opts:['Toward yourself','Straight on, and climb for a clearer line of sight','Left, to change the angle','Hold your position and wait for it to come back'], a:0,
  why:'Signal improves as it gets closer, so toward you is the only direction that helps. It is also the only clue you have.' },
{ mod:'FLY', q:'Why practise nose-in deliberately instead of avoiding it?',
  opts:['It looks better','It is the only way it stops being a calculation','It uses less battery','It is required for Part 107'], a:1,
  why:'The trick of imagining yourself in the aircraft works, slowly. Slowly is no use at speed. Repetition is what makes it instant.' },
{ mod:'SAF', q:'You want to check that a 5-inch\'s motors spin the right way, and no mentor is around. Where do the props go?',
  opts:['On, but on low throttle','Off','On, if you are quick','On, if the quad is not armed'], a:1,
  why:'Spinning motors in Betaflight is a props-off job. The exceptions are a tiny whoop held down, or a bigger quad held or strapped down with a mentor supervising.' },
{ mod:'SAF', q:'You want to spin the motors on a tiny whoop in Betaflight. Can the props stay on?',
  opts:['Never','Yes, as long as you are holding it down','Yes, if it sits on the bench by itself','Only outdoors'], a:1,
  why:'A tiny whoop is the exception: props can stay on as long as you are holding it down.' },
{ mod:'SAF', q:'Before you arm, you:',
  opts:['Arm first, then tell people','Call out ARMING, in the flight zone, facing away','Arm on the bench to walk it to the pad','Wait for the spotter to arm it'], a:1,
  why:'Call out your arm: in the flight zone, facing away, after the ARMING call. Everyone nearby then knows the props are about to spin.' },
{ mod:'SAF', q:'A pilot has ticked every prerequisite for the Tiny Whoop checkpoint. What may they fly?',
  opts:['Anything in the club case','The Meteor 75, for their checkpoint flight with a mentor','The Pavo 20 Pro at an event','Nothing until an officer signs a form'], a:1,
  why:'The ticked prerequisites open the checkpoint: a first real Meteor flight with a mentor watching. Pass it and you are Tier 1; the Pavo checkpoint opens Tier 2.' },
{ mod:'SAF', q:'The instructor says "LAND" while you are halfway through a line. You:',
  opts:['Finish the line, then land','Ask why over the noise','Land now','Hover and wait for a second call'], a:2,
  why:'LAND means now. The reason comes after the props stop.' },
{ mod:'SAF', q:'How do you carry a quad from the bench to the pad?',
  opts:['Armed, at idle','Battery in, disarmed','Battery out','Props off'], a:2,
  why:'Battery out to carry it. A disarmed quad with a battery in is one switch away from spinning.' },
{ mod:'SAF', q:'Flying in goggles with no spotter is:',
  opts:['Fine if the area is clear','Fine for short flights','Not allowed - a visual observer is required','Fine indoors'], a:2,
  why:'Goggles mean you cannot see the aircraft. A spotter watching it is a legal requirement and a club rule.' },
{ mod:'SAF', q:'Where do batteries live while people are flying?',
  opts:['In a pocket, so they stay warm','On the charging table, charging','In their box or bag','Plugged into the spare quad, ready'], a:2,
  why:'Packs live in their box or bag. Charging happens with someone watching, on a hard surface.' },
{ mod:'SAF', q:'What is the highest the club flies?',
  opts:['As high as the video holds','400 ft','1000 ft','Wherever the spotter can still hear you'], a:1,
  why:'Never over 400 ft - and always where your spotter can see it.' },
{ mod:'SAF', q:'When may you fly over people?',
  opts:['Never, no exceptions','When they have given consent, or a mentor has given you special permission','When you are higher than 50 ft','When you are flying fast'], a:1,
  why:'The default is never. The exceptions are people who have agreed to it, or special permission from a mentor.' },
{ mod:'SAF', q:'You are not sure whether something is allowed. What is the rule?',
  opts:['If nobody says no, it is fine','Ask first','Try it once and see','Check the website later'], a:1,
  why:'Not being sure is the answer. Ask an instructor or a mentor before you do it.' },
/* ---- Spotter (2026-10-10) ---- */
{ mod:'SPT', q:'Your pilot is in goggles. What are you watching?',
  opts:['The video feed over their shoulder','The aircraft itself, the whole battery','Your phone, for the timer','The pilot\'s hands'], a:1,
  why:'The pilot sees the camera; you watch the aircraft itself, the whole battery.' },
{ mod:'SPT', q:'Somebody starts walking into the flying area. What do you call?',
  opts:['Nothing, the pilot can see them','"PERSON" - and the pilot lands','"Watch out" once they are close','You walk over and talk to them first'], a:1,
  why:'Call it early and short: "PERSON". The pilot lands; the flight goes again once the area is clear.' },
{ mod:'SPT', q:'You lose sight of the aircraft behind a tree. What now?',
  opts:['Say nothing and hope it comes back','Say "I lost it" at once','Walk toward the tree','Tell the pilot after they land'], a:1,
  why:'Say it at once. The pilot climbs or comes back toward you until you can see it again.' },
{ mod:'SPT', q:'Who checks that flying at this spot is allowed today?',
  opts:['The spotter, with an airspace app','A mentor - they know the FAA rules','Nobody, the club field is always fine','The pilot, from the goggles'], a:1,
  why:'A mentor checks the rules for the spot. You check the field: people, pets, cars, trees, wires.' },
{ mod:'SPT', q:'Which of these is part of the spotter\'s check before the battery goes in?',
  opts:['Agreeing where the pad is and which way is "away"','Flashing the firmware','Charging the next pack','Picking the music for the video'], a:0,
  why:'Ask a mentor, look around, agree the pad and "away", check props, strap and goggles.' },
{ mod:'SPT', q:'When may somebody walk out to pick up the aircraft?',
  opts:['When it looks like it has landed','After the "Disarmed" call','When the pilot stands up','When the props slow down'], a:1,
  why:'Nobody walks out until they have heard DISARMED. Props keep turning for a moment after touchdown.' },
{ mod:'SPT', q:'You do not like something - you are not even sure what. Can you call LAND?',
  opts:['Only with a good reason','Yes - you never need a reason','Only a mentor can call LAND','Only if the battery is low'], a:1,
  why:'Saying LAND is never wrong. A flight can always go again.' },
{ mod:'SPT', q:'You need to leave in the middle of a flight. What happens?',
  opts:['The pilot keeps flying until the battery runs out','The pilot lands - nobody flies goggles without a spotter','You leave quietly','You hand your phone to the pilot'], a:1,
  why:'A goggle flight needs a spotter. If you go, the pilot lands - unless someone else takes over the job.' },
{ mod:'SPT', q:'The aircraft is drifting up and away, getting hard to see. What do you call?',
  opts:['"HIGH" or "FAR"','"PERSON"','"DISARMED"','Nothing yet'], a:0,
  why:'Call "HIGH" or "FAR" before it leaves your sight or gets near 400 ft.' },
{ mod:'SPT', q:'What does a good call sound like?',
  opts:['A full sentence, so nothing is missed','Short, loud and early: "Person left"','A hand signal','A quiet word so you do not distract the pilot'], a:1,
  why:'Short words, loud and early. The pilot cannot see you, so words, not hand signals.' },
{ mod:'BAT', q:'What is the 1C charge current for a 1300 mAh pack?',
  opts:['13 A','1.3 A','0.13 A','130 A'], a:1,
  why:'Capacity in amp-hours is the 1C rate: 1300 mAh = 1.3 Ah = 1.3 A.' },
{ mod:'BAT', q:'A pack you will not fly for a week should be left at:',
  opts:['4.20 V per cell, full','3.80-3.85 V per cell, storage','3.50 V per cell, landing voltage','Whatever it landed at'], a:1,
  why:'Storage voltage, within a day of flying. Full or flat for days is how packs die early.' },
{ mod:'BAT', q:'Why does the balance lead go in for every charge?',
  opts:['It charges faster','So the charger can keep every cell at the same voltage','It is only needed the first time','So the charger can read the capacity'], a:1,
  why:'Cells drift apart. The balance lead lets the charger hold them within millivolts of each other; a cell left behind is a cell that will fail.' },
{ mod:'BAT', q:'A pack is slightly puffed but still holds a charge. What now?',
  opts:['Fly it gently','Store it at storage voltage and watch it','Retire it: tape, discharge, hand in','Charge it at half rate'], a:2,
  why:'Any swelling means the chemistry is breaking down. It never gets charged again.' },
{ mod:'BAT', q:'A LiPo on the charging table catches fire. First move?',
  opts:['Pick up the bag and run outside','Throw a jacket over it','Everyone back, upwind','Pour water directly on the pack from close up'], a:2,
  why:'People back first. Then cool from arm\'s length if you can. Never carry a burning pack and never smother it - it makes its own oxygen.' },
{ mod:'BAT', q:'How is a dead pack disposed of?',
  opts:['In the bin, taped','Fully discharged, taped, handed to the instructor','Burned outside','Left in the LiPo bag indefinitely'], a:1,
  why:'Discharge fully, tape the connector, hand it in for the battery drop-off. Never in the bin, never punctured.' },
{ mod:'ELC', q:'What do the numbers in a "2207" motor mean?',
  opts:['22 mm stator width, 7 mm stator height','2200 KV, 7 poles','22 A, 7 V','2.2 inch prop, 7 pitch'], a:0,
  why:'Stator width and height in millimetres. Bigger stator, bigger prop.' },
{ mod:'ELC', q:'A 6S build of a 5-inch frame uses, compared with a 4S build:',
  opts:['Higher KV motors','Lower KV motors','The same KV, a bigger ESC','Smaller props'], a:1,
  why:'Motor speed is KV × volts. More cells means more volts, so the same prop speed needs lower KV.' },
{ mod:'ELC', q:'A motor can draw 35 A at full throttle. Which ESC?',
  opts:['30 A, it will rarely be full throttle','35 A exactly','45 A or more','Any ESC - the battery limits current'], a:2,
  why:'The ESC rating must exceed the motor\'s real draw with margin. An ESC at its limit cooks.' },
{ mod:'ELC', q:'Which pack can supply four motors drawing 30 A each?',
  opts:['1300 mAh 50C','850 mAh 100C','1300 mAh 100C','450 mAh 75C'], a:2,
  why:'Four × 30 A = 120 A. 1300 mAh × 100C = 130 A, with a little margin. 1300 × 50C is 65 A; 850 × 100C is 85 A; 450 × 75C is 34 A.' },
{ mod:'ELC', q:'What decides the motor size for a new frame?',
  opts:['The battery you own','The prop size the frame takes','The flight controller','The camera weight'], a:1,
  why:'Start from the prop. It fixes the motor size, which fixes the current, which fixes the ESC and the pack.' },
{ mod:'ELC', q:'Why does the Meteor 75 use a 1S battery and 20 000 KV motors?',
  opts:['1S is safer indoors','A 40 mm prop needs very high rpm, and 1S keeps the quad under 30 g','Higher KV is always better','Because whoops cannot use ESCs'], a:1,
  why:'A tiny prop moves little air per turn, so it needs rpm; one cell at 4.2 V with 20 000 KV gets there, and the pack weighs 8 g.' },
{ mod:'RAD', q:'Which band carries control on the club\'s ELRS radios?',
  opts:['5.8 GHz','2.4 GHz','900 MHz only','1.3 GHz'], a:1,
  why:'Club receivers are ELRS 2.4 GHz. Video is on 5.8 GHz. 900 MHz is the long-range option for big outdoor events.' },
{ mod:'RAD', q:'What does raising the ELRS packet rate from 100 Hz to 500 Hz do?',
  opts:['More range, more latency','Less latency, less range','No change in flight, only in telemetry','Lets two radios share one receiver'], a:1,
  why:'More packets a second means your sticks arrive sooner, but each packet has less power behind it, so range and interference margin drop.' },
{ mod:'RAD', q:'What is the bind phrase for?',
  opts:['Encrypting the video feed','Deciding which receivers answer to your radio','Setting the channel for the VTX','Naming the quad on the OSD'], a:1,
  why:'A receiver flashed with your bind phrase binds to your radio automatically. The club uses one phrase on every club receiver.' },
{ mod:'RAD', q:'How do you test failsafe?',
  opts:['Fly far away until it triggers','Props off, arm, switch the radio off, watch what it does','Unplug the receiver in flight','Read the Betaflight tab and trust it'], a:1,
  why:'On the bench, props off, radio off. It should do what its failsafe is set to, and the OSD should say FAILSAFE.' },
{ mod:'RAD', q:'Your link quality drops to 55 % flying over the crowd at the rally. You:',
  opts:['Keep going, the picture looks fine','Fly back toward yourself and land','Switch to a higher packet rate in flight','Climb for a better signal'], a:1,
  why:'LQ is the early warning. Come home while you still have control; the picture is the last thing to go, not the first.' },
{ mod:'EVT', q:'Which of these must every club pilot complete before flying a real drone?',
  opts:['Part 107','TRUST','A LAANC authorization','Drone registration'], a:1,
  why:'TRUST is the free recreational test, required of every recreational flyer. Part 107 is the commercial licence; LAANC and registration depend on where and what you fly.' },
{ mod:'EVT', q:'What is LAANC?',
  opts:['A drone registration number','Near-instant authorization to fly in controlled airspace up to the grid ceiling','The app that shows airspace','A no-fly zone'], a:1,
  why:'LAANC is the system that grants recreational and 107 pilots authorization in controlled airspace, through apps like Aloft and AirHub.' },
{ mod:'EVT', q:'What is the outdoor ceiling at Brophy?',
  opts:['0 ft - campus is inside Sky Harbor\'s Class B','400 ft - campus is just outside Sky Harbor\'s Class B','100 ft, by school rule','There is no ceiling'], a:1,
  why:'Brophy is just outside the orange Class B grid on B4UFLY, in uncontrolled airspace: 400 ft, no LAANC needed. A few blocks south, inside the grid, the grid ceiling applies - so it still gets checked.' },
{ mod:'EVT', q:'Do FAA airspace rules apply to the rally race in the gym?',
  opts:['Yes, the FAA covers every building','No - indoors is not FAA airspace','Only above 100 ft','Only if the doors are open'], a:1,
  why:'Enclosed spaces are not airspace. The club rules still apply in full.' },
{ mod:'EVT', q:'Goggles go black at 20 m. Spotter can see the quad. First move?',
  opts:['Disarm','Hover and say VIDEO OUT','Climb to full height','Pull the goggles off and look'], a:1,
  why:'Hover, hand the calls to the spotter, come home on their calls. Disarming at 20 m out is a crash.' },
{ mod:'EVT', q:'The quad stops responding but is still flying. What do you try first?',
  opts:['Run after it','Switch the radio off and on','Shout at the spotter to catch it','Nothing - wait for failsafe'], a:1,
  why:'A radio power cycle forces a reconnect and fixes most "not responding" cases. Say it out loud so everyone looks up.' },
{ mod:'EVT', q:'A pack in the LiPo bag is smoking. Best response?',
  opts:['Open the bag to check','Carry the bag outside','Everyone back, leave it in the bag, cool from arm\'s length','Smother it with a towel'], a:2,
  why:'The bag is the containment. Opening, carrying or covering it puts a person next to a fire that is about to flare.' },
{ mod:'EVT', q:'A spectator gets a prop cut. Order of actions?',
  opts:['Report, then first aid','Disarm everything, pressure on the cut, get an adult, then the report','Keep flying, the spotter handles it','Photograph it first'], a:1,
  why:'Every quad on the ground, person first, adult next, paperwork last - but the same day.' },
{ mod:'EVT', q:'Which of these needs an incident report?',
  opts:['A crash that broke a prop and dented a wall','A clean landing after lost video','A pack that reached storage voltage','A spotter calling PERSON'], a:0,
  why:'Damage to anything other than the aircraft, any injury, any fire, any complaint: report, same day, to the instructor.' },
{ mod:'EVT', q:'Where does the incident report go?',
  opts:['The group chat','mtucker27@brophybroncos.org, the same day','The kiosk','Nowhere, unless someone asks'], a:1,
  why:'Written, same day, to the instructor. It is how the club keeps its permission to fly on campus.' },
{ mod:'EVT', q:'After a pack fire has burned out, when may someone touch what is left?',
  opts:['As soon as the flames stop','After it has cooled for an hour','After it has been doused','Immediately, with gloves'], a:1,
  why:'Cells next to the one that burned can still go. An hour, untouched.' },
{ mod:'EVT', q:'The failsafe test: props off, armed, radio switched off - and the quad does not do what its failsafe is set to. The quad:',
  opts:['Flies, but only line of sight','Flies if the pilot is careful','Does not fly until it is fixed','Flies at the field but not at events'], a:2,
  why:'No failsafe, no flight. There is no careful enough.' },
{ mod:'EVT', q:'What separates the crew from the crowd at an event?',
  opts:['The spotter\'s voice','A rope, cones or tape line','Nothing - the pilot keeps distance','The organiser'], a:1,
  why:'A physical line that people can see. The flight path stays at least eight metres inside it.' },
{ mod:'EVT', q:'The organiser asks for the drone to pass right over the front row. You:',
  opts:['Do it once, slowly','Do it with a spotter','Only if the front row has agreed or the mentor on site says yes - otherwise change the shot','Do it at the end'], a:2,
  why:'Never over people by default. The exceptions are people who have agreed, or a mentor\'s permission; otherwise the shot changes. That is what the Event Ops badge means.' },
{ mod:'EVT', q:'Where does the charging table go?',
  opts:['In the flight zone, near the pad','Behind the pilot, outside the zone','At the crowd line so spectators can see','Wherever there is a socket'], a:1,
  why:'Behind the pilot, outside the zone. Nothing powered but the aircraft inside the box.' },
{ mod:'EVT', q:'Who gives the brief to the people near the line?',
  opts:['The pilot','The spotter','The organiser','Nobody - the tape is enough'], a:1,
  why:'The spotter talks; the pilot is in goggles and cannot hear questions. Thirty seconds, out loud, before the first flight.' },
{ mod:'EVT', q:'A photographer steps over the tape for a better angle mid-flight. The pilot:',
  opts:['Keeps flying away from them','Lands','Asks the spotter to decide','Hovers until they leave'], a:1,
  why:'Land. The spotter walks the person back. The flight resumes when the zone is clear.' },
{ mod:'EVT', q:'What does "CLEAR" from the spotter mean?',
  opts:['The battery is charged','The zone is empty, the pilot may arm','The flight is over','The video is clear'], a:1,
  why:'CLEAR is the spotter\'s permission to arm. Without it the pilot waits.' },
{ mod:'EVT', q:'Who may call "LAND LAND LAND"?',
  opts:['Only the instructor','Only the spotter','Anyone','Only the pilot'], a:2,
  why:'Anyone who sees a problem ends the flight. No questions until the props stop.' },
{ mod:'EVT', q:'Two pilots share a zone. How do they swap?',
  opts:['Second pilot takes off as the first lands','First lands, DISARMED, packs out, CLEAR, then the second arms','Both fly, one high one low','The spotter decides in the air'], a:1,
  why:'One aircraft in the zone at a time. Swap on the ground, through the calls.' },
{ mod:'EVT', q:'Before power-up at an event with three pilots, what is agreed first?',
  opts:['Who flies longest','Video channels, one per pilot, written down','Who holds the goggles','The music'], a:1,
  why:'Control links share; video does not. Channels agreed and written before anyone powers up.' },
{ mod:'EVT', q:'What does the pilot call with thirty seconds of battery left?',
  opts:['LANDING','BATTERY','DISARMED','CLEAR'], a:1,
  why:'BATTERY tells the spotter the quad is coming home now, before LANDING and DISARMED.' }
];
