// Demo seed data. Deliberately messy: typos, all-caps paper transcriptions,
// missing ages, unknown names, people who moved, and duplicate records.
// Times are "hours ago" so the demo always looks like it's ~5 days after the
// evacuation order. See SEED_SCENARIOS.md for the stories and what to test.

export const DEMO_PASSWORD = 'demo1234';

export const shelters = [
  { code: 'lincoln',     name: 'Lincoln High School Gym',              address: '1200 Ridge Rd, Millbrook',  capacity: 400 },
  { code: 'riverside',   name: 'Riverside Community Center',           address: '85 Mill St, Millbrook',     capacity: 250 },
  { code: 'stbrendan',   name: "St. Brendan's Parish Hall",            address: '14 Church Ln, Ashford',     capacity: 120 },
  { code: 'fairgrounds', name: 'County Fairgrounds Expo Hall (medical)', address: '300 Fair Rd, Ashford',    capacity: 500 },
];

// key is used only inside this file to wire up references.
// Authorities must come before the volunteers they created.
export const staff = [
  { key: 'lincoln.authority',     shelter: 'lincoln',     role: 'authority', name: 'Carol Mendes' },
  { key: 'lincoln.vol1',          shelter: 'lincoln',     role: 'volunteer', name: 'Ben Ortiz',    createdBy: 'lincoln.authority' },
  { key: 'lincoln.vol2',          shelter: 'lincoln',     role: 'volunteer', name: 'Aisha Bello',  createdBy: 'lincoln.authority' },

  { key: 'riverside.authority',   shelter: 'riverside',   role: 'authority', name: 'Frank Liu' },
  { key: 'riverside.vol1',        shelter: 'riverside',   role: 'volunteer', name: 'Megan Doyle',  createdBy: 'riverside.authority' },
  { key: 'riverside.vol2',        shelter: 'riverside',   role: 'volunteer', name: 'Sam Patel',    createdBy: 'riverside.authority' },

  { key: 'stbrendan.authority',   shelter: 'stbrendan',   role: 'authority', name: 'Tom Reilly' },
  { key: 'stbrendan.vol1',        shelter: 'stbrendan',   role: 'volunteer', name: 'Rosa Alvarez', createdBy: 'stbrendan.authority' },

  { key: 'fairgrounds.authority', shelter: 'fairgrounds', role: 'authority', name: 'Janet Ward' },
  { key: 'fairgrounds.vol1',      shelter: 'fairgrounds', role: 'volunteer', name: 'Luis Romero',  createdBy: 'fairgrounds.authority' },
  { key: 'fairgrounds.vol2',      shelter: 'fairgrounds', role: 'volunteer', name: 'Kim Nguyen',   createdBy: 'fairgrounds.authority' },
];

// Login email for a staff key, e.g. 'lincoln.vol1' -> 'lincoln.vol1@demo.org'
export const staffEmail = (key) => `${key}@demo.org`;

export const publicUsers = [
  { name: 'Elena Ramirez',   contact: 'elena@demo.org' },   // mother of Lucas
  { name: "Kevin O'Neill",   contact: 'kevin@demo.org' },   // son of Margaret
  { name: 'Priya Shah',      contact: 'priya@demo.org' },   // sister of Rajesh
  { name: 'Travis Whitfield', contact: 'travis@demo.org' }, // Dana's abusive ex
  { name: 'Tom Becker',      contact: 'tom@demo.org' },     // relative not in system
];

// history: oldest first. arrived/left are hours ago; left: null = still there.
// status defaults to 'sheltered' at the last shelter in history.
export const persons = [
  // ---------------- Lincoln High School Gym ----------------
  {
    name: 'Lucas Ramires', age: [8, 10], home: 'Elm St, Harbor View', minor: true,
    desc: 'Boy in green school uniform, blue dinosaur backpack. Came on the school bus from Harbor View Elementary. Says his mom is Elena.',
    history: [{ at: 'lincoln', arrived: 118, by: 'lincoln.vol1' }],
  },
  {
    name: 'Grace Okafor', age: [42, 46], home: 'Shore Rd, Port Willet',
    desc: 'Lost her phone during the evacuation. Looking for her husband David, who stayed behind to help neighbors.',
    history: [{ at: 'lincoln', arrived: 110, by: 'lincoln.vol2' }],
  },
  {
    name: 'Raj Sha', age: [25, 30], home: 'Dock St',
    desc: 'Tall, glasses. Works at the cannery.',
    history: [{ at: 'lincoln', arrived: 100, by: 'lincoln.vol1' }],
  },
  {
    name: 'Michael Johnson', age: [22, 25], home: 'Grant Ave',
    desc: 'College student, left arm in a sling.',
    history: [{ at: 'lincoln', arrived: 96, by: 'lincoln.vol2' }],
  },
  {
    name: 'Tasha Greene', age: [15, 16], home: 'Harbor View', minor: true,
    desc: 'Unaccompanied. Was at a friend\'s house when the evacuation started.',
    history: [{ at: 'lincoln', arrived: 80, by: 'lincoln.vol1' }],
  },
  { name: 'Ana Lima',      age: [30, 35], home: 'Port Willet', desc: 'About 7 months pregnant.',
    history: [{ at: 'lincoln', arrived: 90, by: 'lincoln.vol2' }] },
  { name: 'Walter Briggs', age: [70, 75], home: 'Bayview Rd',  desc: 'Uses a walker.',
    history: [{ at: 'lincoln', arrived: 115, by: 'lincoln.vol1' }] },
  { name: 'Emily Chen',    age: [28, 32], home: null,          desc: null,
    history: [{ at: 'lincoln', arrived: 105, by: 'lincoln.vol2' }] },
  { name: 'Samuel Ortiz',  age: null,     home: null,          desc: 'Declined to give age or address.',
    history: [{ at: 'lincoln', arrived: 70, by: 'lincoln.vol1' }] },

  // ---------------- Riverside Community Center ----------------
  {
    // Moved properly: Riverside -> Fairgrounds (medical needs).
    name: "Margaret O'Neill", age: [78, 82], home: 'Seabreeze Nursing Home, Port Willet',
    desc: 'Moved from Seabreeze Nursing Home by county EMS. Mild memory loss, needs daily medication.',
    history: [
      { at: 'riverside',   arrived: 112, left: 95, by: 'riverside.vol1' },
      { at: 'fairgrounds', arrived: 95,            by: 'fairgrounds.vol1' },
    ],
  },
  {
    name: 'Dana Whitfield', age: [30, 35], home: 'Hill St', doNotDisclose: true,
    desc: 'Asked not to be findable.',
    history: [{ at: 'riverside', arrived: 100, by: 'riverside.vol2' }],
  },
  {
    // Original record. He later walked to St. Brendan's and was registered
    // again there instead of being moved (see "Jon Peirce").
    name: 'Jonathan Pierce', age: [60, 65], home: 'Bayview Rd',
    desc: 'Retired fisherman. Gray beard, Navy tattoo on right forearm.',
    history: [{ at: 'riverside', arrived: 108, by: 'riverside.vol1' }],
  },
  {
    // Moved twice, then left the shelter system to stay with family.
    name: 'Harold Kim', age: [65, 70], home: 'Elm St', status: 'left',
    desc: 'Left to stay with his daughter out of state.',
    history: [
      { at: 'lincoln',   arrived: 119, left: 90, by: 'lincoln.vol1' },
      { at: 'riverside', arrived: 90,  left: 30, by: 'riverside.vol2' },
    ],
  },
  { name: 'Rosa Delgado', age: [50, 55], home: 'Mill St',    desc: null,
    history: [{ at: 'riverside', arrived: 104, by: 'riverside.vol1' }] },
  { name: 'Kevin Brooks', age: [35, 40], home: null,         desc: 'Has a dog with him.',
    history: [{ at: 'riverside', arrived: 99, by: 'riverside.vol2' }] },
  { name: 'Linda Park',   age: [45, 50], home: 'Grant Ave',  desc: null,
    history: [{ at: 'riverside', arrived: 100, by: 'riverside.vol1' }] },
  { name: 'Bill Turner',  age: [55, 60], home: 'Bayview Rd', desc: 'Hearing aid.',
    history: [{ at: 'riverside', arrived: 85, by: 'riverside.vol2' }] },

  // ---------------- St. Brendan's Parish Hall ----------------
  {
    name: 'David Okafor', age: [45, 50], home: 'Shore Rd, Port Willet',
    desc: 'Stayed behind to help neighbors. Rescued by boat two days after the evacuation. Bandaged left hand.',
    history: [{ at: 'stbrendan', arrived: 66, by: 'stbrendan.vol1' }],
  },
  {
    // Undocumented, gave first name only. Here with her two children.
    name: 'Maria', age: [35, 45], home: null,
    desc: 'Gave first name only. Here with her two children, Sofia and Mateo.',
    history: [{ at: 'stbrendan', arrived: 102, by: 'stbrendan.vol1' }],
  },
  { name: 'Sofia', age: [6, 8], home: null, minor: true, desc: 'With her mother, Maria.',
    history: [{ at: 'stbrendan', arrived: 102, by: 'stbrendan.vol1' }] },
  { name: 'Mateo', age: [3, 5], home: null, minor: true, desc: 'With his mother, Maria.',
    history: [{ at: 'stbrendan', arrived: 102, by: 'stbrendan.vol1' }] },
  {
    // DUPLICATE of "Jonathan Pierce" at Riverside.
    name: 'Jon Peirce', age: [58, 65], home: 'Bayview Rd',
    desc: 'Gray beard, tattoo on arm. Walked here from Riverside looking for his brother.',
    history: [{ at: 'stbrendan', arrived: 60, by: 'stbrendan.vol1' }],
  },
  {
    // Same name as the Michael Johnson at Lincoln, but NOT the same person.
    name: 'Michael Johnson', age: [60, 65], home: 'Ridge Rd', desc: 'Diabetic.',
    history: [{ at: 'stbrendan', arrived: 95, by: 'stbrendan.vol1' }],
  },
  { name: 'Patricia Nolan', age: [60, 65], home: 'Church Ln', desc: null,
    history: [{ at: 'stbrendan', arrived: 98, by: 'stbrendan.vol1' }] },
  { name: 'Greg Hall',      age: [40, 45], home: null,        desc: null,
    history: [{ at: 'stbrendan', arrived: 97, by: 'stbrendan.vol1' }] },

  // ---------------- County Fairgrounds (medical) ----------------
  {
    // DUPLICATE of "Margaret O'Neill", created by the night shift.
    name: 'Peggy Oneil', age: [75, 85], home: 'Seabreeze',
    desc: 'Elderly woman, confused at night. Arrived by ambulance.',
    history: [{ at: 'fairgrounds', arrived: 94, by: 'fairgrounds.vol2' }],
  },
  {
    // Entered from a paper sheet, all caps.
    name: 'JOSE HERNANDEZ', age: [40, 45], home: 'CANNERY ROW',
    desc: 'ENTERED FROM PAPER SHEET #3',
    history: [{ at: 'fairgrounds', arrived: 100, by: 'fairgrounds.vol1' }],
  },
  {
    // DUPLICATE of "JOSE HERNANDEZ" (accents, different volunteer).
    name: 'José Hernández', age: [40, 45], home: 'Cannery Row',
    desc: 'Diabetic, needs insulin.',
    history: [{ at: 'fairgrounds', arrived: 99, by: 'fairgrounds.vol2' }],
  },
  {
    // Unidentified: matching has to lean on age, description.
    name: 'Unknown', age: [70, 80], home: null,
    desc: 'Found at the bus depot. Not speaking. Gray hair, red flannel shirt, wedding ring.',
    history: [{ at: 'fairgrounds', arrived: 88, by: 'fairgrounds.vol1' }],
  },
  {
    name: 'Betty Foster', age: [85, 90], home: 'Seabreeze Nursing Home, Port Willet',
    desc: 'Moved from Seabreeze with other residents.',
    history: [
      { at: 'riverside',   arrived: 112, left: 95, by: 'riverside.vol1' },
      { at: 'fairgrounds', arrived: 95,            by: 'fairgrounds.vol1' },
    ],
  },
  { name: 'Arthur Lee',      age: [75, 80], home: 'Seabreeze Nursing Home', desc: null,
    history: [{ at: 'fairgrounds', arrived: 111, by: 'fairgrounds.vol1' }] },
  { name: 'Nadia Rahman',    age: [30, 35], home: 'Dock St',   desc: 'Dialysis patient.',
    history: [{ at: 'fairgrounds', arrived: 90, by: 'fairgrounds.vol2' }] },
  { name: 'Chris Walker',    age: [25, 30], home: null,        desc: null,
    history: [{ at: 'fairgrounds', arrived: 80, by: 'fairgrounds.vol2' }] },
  { name: 'Elizabeth Moore', age: [60, 65], home: 'Shore Rd',  desc: 'Oxygen tank.',
    history: [{ at: 'fairgrounds', arrived: 92, by: 'fairgrounds.vol1' }] },
];

// Searches already filed when the demo starts. Elena's, Priya's and Tom's
// are left for reviewers to file themselves.
export const searchRequests = [
  { by: 'kevin@demo.org', relationship: 'Son', names: ["Margaret O'Neill", 'Peggy', 'Maggie'],
    age: [78, 82], home: 'Seabreeze Nursing Home', desc: 'My mother. We lost track of her when Seabreeze was evacuated.' },
  // Dana is private, so this match is declined automatically and Travis
  // only ever sees "no confirmed match yet".
  { by: 'travis@demo.org', relationship: 'Husband', names: ['Dana Whitfield'], age: [30, 35], home: 'Hill St', desc: null },
  // Filed by a Lincoln volunteer for Grace, who has no phone.
  { forPerson: 'Grace Okafor', filedBy: 'lincoln.vol2', relationship: 'Husband', names: ['David Okafor', 'Dave'],
    age: [45, 50], home: 'Shore Rd', desc: 'Stayed behind to help neighbors.' },
];
