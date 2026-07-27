#!/usr/bin/env node
// ============================================================
// Connect TVC — bulk sample-data generator.
//
// Regenerates a brand-new, internally-consistent sample dataset: 125 Home
// Groups, 200 solo Parties (one linked Person each), and 300 two-person
// Parties (two linked Person rows each, sharing a surname, 600 people
// total) — 500 parties / 800 people in all. Also seeds a realistic subset
// of contact_log (outreach) and placement_history (group-assignment)
// rows, so those features aren't empty on a fresh dataset. Writes a
// ready-to-run SQL migration to supabase/017_bulk_sample_data_v2.sql,
// which DELETEs every existing group/party/person/contact-log/placement-
// history row first, then inserts the fresh set.
//
// Re-run any time you want a different random batch:
//   node scripts/generate-sample-data.mjs
//
// This only ever writes the .sql file — it does not touch your database.
// Review the generated file, then run it yourself in the Supabase SQL
// editor (same workflow as every other migration in supabase/).
//
// Geography is deliberately weighted (not flat/uniform across every
// city) and day-availability is deliberately widened (4–6 days, not
// 1–3) — the original v1 DFW sample dataset used flat/uniform picks and
// left 35.7% of people with zero candidate groups under the Finder's
// default match rule (exact city AND day-overlap AND exact life stage);
// concentrating toward a handful of primary cities and giving people more
// day-availability overlap fixed that. Same lesson applied here from the
// start instead of re-discovering it. The resulting match-rate
// distribution (computed below) is written into this file's own header
// comment for anyone reading it later.
// ============================================================

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "supabase", "017_bulk_sample_data_v2.sql");

const NUM_GROUPS = 125;
const NUM_SOLO_PARTIES = 200;
const NUM_COUPLE_PARTIES = 300; // -> 600 people

// ---------- pools ----------

// Weighted by tier: primary cities get the bulk of both groups and
// people (realistic — a real church draws disproportionately from
// nearby suburbs — and it's also what actually produces match overlap).
// Fewer primary cities and a heavier weight than the original DFW dataset
// used — 125 groups spread across 5 life stages is a much sparser pool
// than that dataset's group count, so it needs sharper concentration to
// land in a similar match-rate range.
const PRIMARY_CITIES = [
  ["Dallas", 75201], ["Fort Worth", 76102], ["Arlington", 76010], ["Plano", 75023],
];
const SECONDARY_CITIES = [
  ["Irving", 75060], ["McKinney", 75069], ["Garland", 75040],
  ["Grand Prairie", 75050], ["Richardson", 75080],
];
const LONG_TAIL_CITIES = [
  ["Carrollton", 75006], ["Denton", 76201], ["Lewisville", 75056], ["Mesquite", 75149],
  ["Allen", 75002], ["Flower Mound", 75022], ["North Richland Hills", 76180], ["Mansfield", 76063],
  ["Rowlett", 75088], ["Euless", 76039], ["DeSoto", 75115], ["Cedar Hill", 75104],
  ["Wylie", 75098], ["Grapevine", 76051], ["Bedford", 76021], ["Rockwall", 75087],
  ["Keller", 76244], ["Southlake", 76092], ["Burleson", 76028], ["Haltom City", 76117],
  ["Hurst", 76053], ["Duncanville", 75116], ["Little Elm", 75068], ["Prosper", 75078],
  ["Sachse", 75048], ["The Colony", 75056],
];
const CITY_POOL = [
  ...Array(40).fill(PRIMARY_CITIES).flat(),
  ...Array(10).fill(SECONDARY_CITIES).flat(),
  ...LONG_TAIL_CITIES,
];

const STREETS = [
  "Josey Ln", "Precinct Line Rd", "Belt Line Rd", "Mockingbird Ln", "Custer Rd", "Broad St",
  "Meadow Creek Dr", "Elm St", "Cross Timbers Rd", "Rufe Snow Dr", "Preston Rd", "Parker Rd",
  "Pioneer Pkwy", "Walnut Hill Ln", "Virginia Pkwy", "Spring Creek Pkwy", "Collins St",
  "Division St", "Main St", "Stonebridge Dr", "Eldorado Pkwy",
];

const MALE_FIRST = [
  "James", "John", "Robert", "Michael", "David", "Daniel", "Kevin", "Ethan", "Noah", "Logan",
  "Isaac", "Malik", "Wei", "Diego", "Hunter", "Cody", "Blake", "Spencer", "Marcus", "Will",
  "Tom", "Victor", "Kwame", "Dylan", "Jordan", "Luis", "Ben", "Gabriel", "Elijah", "Owen",
];
const FEMALE_FIRST = [
  "Sarah", "Mary", "Jennifer", "Linda", "Elizabeth", "Susan", "Jessica", "Karen", "Nancy",
  "Ella", "Ava", "Hannah", "Priya", "Layla", "Fatima", "Natalie", "Kayla", "Vanessa", "Ruth",
  "Grace", "Isabela", "Gabriela", "Michelle", "Amanda", "Rachel", "Sydney", "Monica", "Wei",
  "Emma", "Olivia",
];
// Deliberately oversized (~160, deduped below) — 125 Home Groups each need
// a *unique* surname (picked without replacement), unlike parties, where
// two different households sharing a surname is normal and expected.
const LAST_NAMES_RAW = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez",
  "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor",
  "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez",
  "Clark", "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King", "Wright",
  "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall",
  "Rivera", "Campbell", "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans",
  "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes", "Stewart", "Morris",
  "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper", "Peterson",
  "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson", "Watson",
  "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
  "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross", "Foster",
  "Jimenez", "Powell", "Jenkins", "Perry", "Russell", "Sullivan", "Bell", "Coleman", "Butler",
  "Henderson", "Barnes", "Gonzales", "Fisher", "Vasquez", "Simmons", "Romero", "Jordan",
  "Patterson", "Alexander", "Hamilton", "Graham", "Reynolds", "Griffin", "Wallace", "Moreno",
  "West", "Cole", "Hayes", "Chen", "Wang", "Zhang", "Tanaka", "Cho", "Sato", "Osei", "Anand",
  "Marchetti", "Whitcomb", "Rojas", "Whitson", "Farris", "Guerrero", "Castro", "Sheppard",
  "Lang", "Whitaker", "Solis", "Ledbetter", "Roca", "Lindqvist", "Alston", "Whitmore",
  "Salcedo", "Delgado", "Voss", "Nolan", "Church", "Fox", "Cross", "Marsh", "Landry", "Grier",
  "Wells", "Hunt", "Bryant",
];
const LAST_NAMES = [...new Set(LAST_NAMES_RAW)];

// Skewed toward Families/Everyone (most common on a real roster), used for
// both groups and parties so supply and demand actually line up — two
// independent uniform dice rolls rarely agree.
const LIFE_STAGE_POOL = [
  "Families", "Families", "Families", "Families",
  "Everyone", "Everyone", "Everyone", "Everyone",
  "Couples", "Couples",
  "Young Adults", "Young Adults",
  "Students",
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_WEIGHTS = [1, 3, 3, 3, 2, 2, 1]; // weeknight-heavy
const TIME_PREFS = ["Mornings", "Afternoons", "Evenings", "Flexible"];
const MEETING_TIMES = ["6:00 AM", "6:30 AM", "10:00 AM", "12:00 PM", "5:00 PM", "5:30 PM", "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM"];
const FORMATS = ["In-person", "In-person", "In-person", "Hybrid", "Hybrid", "Online"];
const FREQS = ["Weekly", "Weekly", "Weekly", "Every other week", "Monthly"];
const AGE_RANGES = ["18–24", "22–30", "24–32", "26–40", "28–42", "30–48", "32–48", "35–55", "All ages"];
const PARTY_STATUS_POOL = [
  "New", "New",
  "Actively Searching", "Actively Searching", "Actively Searching",
  "Waitlisted",
  "Grouped", "Grouped", "Grouped", "Grouped",
];

const TOPICS = [
  "Come-as-you-are community", "Marketplace faith & ethics", "Late-night study for grad students",
  "Anchored young adults study", "College & career Bible study", "Marriage & rhythms of faith",
  "Singles navigating career and faith", "Recovery & redemption stories", "Once-a-month family potluck",
  "Parenting & purpose", "Prayer & scripture memory", "Empty nesters finding purpose",
  "Sunday evening reflection", "Family life & the Gospels", "Loving our neighbors well",
  "Career & calling", "Bridging seasons of marriage", "Shared dinner & devotion",
  "Saturday morning conversation", "Marriage enrichment",
];
const DESCRIPTIONS = [
  "A relaxed gathering where neighbors share a meal and a short devotional.",
  "Biweekly conversation focused on strengthening marriages.",
  "A steady midweek anchor for young adults navigating a new season.",
  "Fully virtual and especially welcoming to first-timers.",
  "A midday, campus-adjacent gathering for students to connect and recharge.",
  "An open, come-as-you-are group perfect for anyone new to the area.",
  "Our most established group in this life stage.",
  "Practical, honest conversations on parenting with purpose.",
  "Built around whole-family participation, kids welcome.",
  "Coffee-shop-style mornings, open conversation format.",
  "One of our longest-running groups — open to absolutely anyone.",
  "A close-knit group building rhythms of faith and friendship together.",
  "Late start time built around nontraditional schedules.",
  "A brand-new group, just getting off the ground.",
  "Weekly gathering with a short devotional for the whole family.",
  "A new group for couples just starting to build shared habits of faith.",
];
const PLACEMENT_DETAILS = [
  "Childcare on site; arrive a few minutes early to drop off.",
  "Meets in a church classroom, not a home — easy to find.",
  "Street parking only — carpooling encouraged.",
  "A Zoom link goes out to the group same-day for anyone joining online.",
  "Casual dress, kids welcome to roam during discussion.",
  "New members welcome any week, no need to wait for a new term.",
  "Text the host by Friday if you need childcare arranged.",
  "Driveway parking is tight; street parking is easier.",
  "Meets in the campus plaza food court — look for the table tent.",
  "Pets on site (two friendly dogs) — mention if that's a concern.",
  "Currently at capacity — check back as spots open.",
  "Meets in the host's living room; enter through the side gate.",
];
const INTERESTS = [
  "Marriage, serving together", "Parenting, cooking", "Hiking, apologetics",
  "Worship, mentoring", "Study groups, gaming", "Missions, hospitality",
  "Music, discipleship", "Running, prayer", "Reading, service projects",
  "Coffee, deep conversation", "Sports, community outreach", "Art, quiet reflection",
];
const NOTES = [
  "New in town, flexible on timing.",
  "Recently married, new to Connect TVC and eager to plug in.",
  "Family of four, needs childcare on meeting nights.",
  "Prefers an early-morning group.",
  "Sophomore, connected through campus ministry.",
  "Long-time member, between groups after a move.",
  "Referred by a friend already in a group.",
  "Looking for something close to home.",
  "",
  "",
];
const OUTREACH_NOTES = [
  "Left a voicemail, will follow up next week.",
  "Texted about upcoming group options in their area.",
  "Had a great call — excited to visit a group this Sunday.",
  "Emailed with two group suggestions nearby.",
  "No answer yet, trying again this week.",
  "Connected them with the group host directly.",
  "Confirmed they're settling in well with the group.",
  "Following up after they missed a first visit.",
  "",
  "",
];
const COORDINATORS = [
  "sarah.coord@connecttvc.org",
  "james.leader@connecttvc.org",
  "maria.ministry@connecttvc.org",
  "david.outreach@connecttvc.org",
];

// ---------- helpers ----------

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function weightedDay() {
  const total = DAY_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < DAYS.length; i++) {
    r -= DAY_WEIGHTS[i];
    if (r <= 0) return DAYS[i];
  }
  return DAYS[0];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
// 4–6 days, drawn from the same weeknight-heavy weighting as group meeting
// days — deliberately wider than a flat 1–3 uniform pick, since more
// availability overlap is what actually produces group matches.
function randPartyDays() {
  const count = randInt(4, 6);
  const picked = new Set();
  let guard = 0;
  while (picked.size < count && guard < 50) {
    picked.add(weightedDay());
    guard++;
  }
  return [...picked];
}
function ageForLife(life) {
  switch (life) {
    case "Students": return randInt(18, 23);
    case "Young Adults": return randInt(22, 32);
    case "Families": return randInt(28, 50);
    case "Couples": return randInt(25, 55);
    default: return randInt(18, 70);
  }
}
function pluralize(name) {
  return /[sxz]$|ch$|sh$/i.test(name) ? `${name}es` : `${name}s`;
}
function esc(s) {
  return String(s).replace(/'/g, "''");
}
function q(s) {
  return `'${esc(s)}'`;
}
function sqlArray(arr) {
  return `ARRAY[${arr.map((d) => `'${d}'`).join(",")}]::text[]`;
}
function fullName() {
  const male = Math.random() < 0.5;
  const first = rand(male ? MALE_FIRST : FEMALE_FIRST);
  const last = rand(LAST_NAMES);
  return `${first} ${last}`;
}
function address() {
  const [city, zipBase] = rand(CITY_POOL);
  const zip = zipBase + randInt(0, 9);
  return { city, address: `${randInt(100, 9899)} ${rand(STREETS)}, ${city}, TX ${zip}` };
}
function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function joinedDate() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${rand(months)} ${randInt(2015, 2026)}`;
}
function email(first, last, domain = "email.com") {
  const n = Math.random() < 0.3 ? randInt(1, 99) : "";
  return `${first}.${last}${n}@${domain}`.toLowerCase();
}
function phone() {
  return `(555) ${randInt(200, 999)}-${randInt(1000, 9999)}`;
}

// ---------- groups ----------

const groupIds = [];
const groupsMeta = []; // { id, name, area, life, day } — used for match stats + placement history
const groupRows = [];

const groupSurnames = shuffled(LAST_NAMES).slice(0, NUM_GROUPS);
if (groupSurnames.length < NUM_GROUPS) {
  throw new Error(`Need ${NUM_GROUPS} unique surnames for group names, only have ${groupSurnames.length}.`);
}

for (let i = 0; i < NUM_GROUPS; i++) {
  const id = `g${i + 1}`;
  const lastName = groupSurnames[i];
  const host = `${rand(MALE_FIRST)} ${lastName} and ${rand(FEMALE_FIRST)} ${lastName}`;
  const mentor = Math.random() < 0.3 ? "—" : `${Math.random() < 0.5 ? rand(MALE_FIRST) : rand(FEMALE_FIRST)} ${rand(LAST_NAMES)}`;
  const name = `The ${pluralize(lastName)}`;
  const { city, address: addr } = address();
  const life = rand(LIFE_STAGE_POOL);
  const capacity = randInt(6, 26);
  const members = Math.random() < 0.15 ? capacity : randInt(0, capacity - 1);
  const full = members >= capacity;
  const status = full ? "Closed" : rand(["New", "Open", "Open", "Open", "Open", "Open", "Closed"]);
  const format = rand(FORMATS);
  const freq = rand(FREQS);
  const childcare = Math.random() < 0.45;
  const day = weightedDay();
  const time = rand(MEETING_TIMES);
  const topic = rand(TOPICS);
  const ageRange = rand(AGE_RANGES);
  const startDate = joinedDate();
  const contactEmail = `${slug(name)}@connecttvc.org`;
  const desc = rand(DESCRIPTIONS);
  const placement = rand(PLACEMENT_DETAILS);

  groupIds.push(id);
  groupsMeta.push({ id, name, area: city, life, day });
  groupRows.push(
    `(${q(id)},${q(name)},${q(day)},${q(time)},${q(city)},${q(host)},${q(mentor)},${q(life)},${q(status)},${q(format)},${q(freq)},${capacity},${members},${childcare},${q(topic)},${q(ageRange)},${q(startDate)},${q(contactEmail)},${q(addr)},${q(desc)},${q(placement)})`,
  );
}

// ---------- parties + people ----------

const partyRows = [];
const peopleRows = [];
const partiesMeta = []; // { area, life, days } — used for match stats only
const placementHistoryRows = [];
const contactLogRows = [];

function pickStatusAndGroup() {
  const status = rand(PARTY_STATUS_POOL);
  const group = status === "Grouped" ? rand(groupIds) : null;
  return { status, group };
}

// Seeds contact_log + placement_history for one party — never touches
// party/person rows themselves, purely additive demo data so the outreach
// log and placement history aren't empty on a fresh dataset.
function seedHistory(partyId, status, currentGroupId) {
  // ~35% of parties have 1-3 outreach entries.
  if (Math.random() < 0.35) {
    const n = randInt(1, 3);
    for (let i = 0; i < n; i++) {
      const daysAgo = randInt(1, 180);
      contactLogRows.push(
        `(${q(partyId)},${q(rand(COORDINATORS))},${q(rand(OUTREACH_NOTES))},now() - interval '${daysAgo} days')`,
      );
    }
  }

  if (currentGroupId) {
    const g = groupsMeta.find((x) => x.id === currentGroupId);
    const assignedDaysAgo = randInt(5, 250);
    placementHistoryRows.push(
      `(${q(partyId)},${q(currentGroupId)},${q(g.name)},${q(rand(COORDINATORS))},now() - interval '${assignedDaysAgo} days',null)`,
    );
    // ~15% of currently-grouped parties also show a prior group they moved
    // on from, so Placement History has something to actually show.
    if (Math.random() < 0.15 && groupIds.length > 1) {
      let prev;
      do {
        prev = rand(groupsMeta);
      } while (prev.id === currentGroupId);
      const unassignedDaysAgo = assignedDaysAgo + randInt(5, 55);
      const pastAssignedDaysAgo = unassignedDaysAgo + randInt(60, 400);
      placementHistoryRows.push(
        `(${q(partyId)},${q(prev.id)},${q(prev.name)},${q(rand(COORDINATORS))},now() - interval '${pastAssignedDaysAgo} days',now() - interval '${unassignedDaysAgo} days')`,
      );
    }
  } else if (Math.random() < 0.1) {
    // ~10% of not-currently-grouped parties previously were, and left —
    // demonstrates a party that's back on the market.
    const prev = rand(groupsMeta);
    const unassignedDaysAgo = randInt(5, 55);
    const pastAssignedDaysAgo = unassignedDaysAgo + randInt(60, 400);
    placementHistoryRows.push(
      `(${q(partyId)},${q(prev.id)},${q(prev.name)},${q(rand(COORDINATORS))},now() - interval '${pastAssignedDaysAgo} days',now() - interval '${unassignedDaysAgo} days')`,
    );
  }
}

// Solo parties — one linked person each.
for (let i = 0; i < NUM_SOLO_PARTIES; i++) {
  const partyId = `p${i + 1}`;
  const { city, address: addr } = address();
  const life = rand(LIFE_STAGE_POOL);
  const age = ageForLife(life);
  const days = randPartyDays();
  const timePref = rand(TIME_PREFS);
  const childcareNeeded = Math.random() < 0.25;
  const accessibility = Math.random() < 0.05 ? "Prefers ground-floor access" : "—";
  const interests = rand(INTERESTS);
  const notes = rand(NOTES);
  const joined = joinedDate();
  const { status, group } = pickStatusAndGroup();

  partiesMeta.push({ area: city, life, days });
  partyRows.push(
    `(${q(partyId)},'',${q(city)},${q(addr)},${age},${sqlArray(days)},${q(timePref)},${q(life)},${q(interests)},${childcareNeeded},${q(accessibility)},${q(status)},${group ? q(group) : "null"},${q(joined)},${q(notes)})`,
  );

  const [first, last] = fullName().split(" ");
  const personId = `sp${i + 1}`;
  peopleRows.push(`(${q(personId)},${q(partyId)},${q(`${first} ${last}`)},${q(email(first, last))},${q(phone())})`);

  seedHistory(partyId, status, group);
}

// Two-person parties — a linked couple sharing one surname.
for (let i = 0; i < NUM_COUPLE_PARTIES; i++) {
  const partyId = `cp${i + 1}`;
  const lastName = rand(LAST_NAMES);
  const partyName = `The ${pluralize(lastName)}`;
  const { city, address: addr } = address();
  const life = rand(LIFE_STAGE_POOL);
  const age = ageForLife(life);
  const days = randPartyDays();
  const timePref = rand(TIME_PREFS);
  const childcareNeeded = Math.random() < 0.45; // couples skew higher — more likely to have kids
  const accessibility = Math.random() < 0.05 ? "Prefers ground-floor access" : "—";
  const interests = rand(INTERESTS);
  const notes = rand(NOTES);
  const joined = joinedDate();
  const { status, group } = pickStatusAndGroup();

  partiesMeta.push({ area: city, life, days });
  partyRows.push(
    `(${q(partyId)},${q(partyName)},${q(city)},${q(addr)},${age},${sqlArray(days)},${q(timePref)},${q(life)},${q(interests)},${childcareNeeded},${q(accessibility)},${q(status)},${group ? q(group) : "null"},${q(joined)},${q(notes)})`,
  );

  const firstA = rand(MALE_FIRST);
  const firstB = rand(FEMALE_FIRST);
  const idA = `cp${i + 1}a`;
  const idB = `cp${i + 1}b`;
  peopleRows.push(`(${q(idA)},${q(partyId)},${q(`${firstA} ${lastName}`)},${q(email(firstA, lastName))},${q(phone())})`);
  peopleRows.push(`(${q(idB)},${q(partyId)},${q(`${firstB} ${lastName}`)},${q(email(firstB, lastName))},${q(phone())})`);

  seedHistory(partyId, status, group);
}

// ---------- match-rate stats (matches the Finder's default rule: exact
// city AND day-overlap AND exact life stage) ----------

function matchCount(party) {
  return groupsMeta.filter(
    (g) => g.area === party.area && g.life === party.life && party.days.includes(g.day),
  ).length;
}

let zero = 0, one = 0, twoPlus = 0, totalMatches = 0, maxMatches = 0;
for (const p of partiesMeta) {
  const c = matchCount(p);
  totalMatches += c;
  if (c > maxMatches) maxMatches = c;
  if (c === 0) zero++;
  else if (c === 1) one++;
  else twoPlus++;
}
const totalPartiesForStats = partiesMeta.length;
const matchStats = {
  zeroPct: ((zero / totalPartiesForStats) * 100).toFixed(1),
  onePct: ((one / totalPartiesForStats) * 100).toFixed(1),
  twoPlusPct: ((twoPlus / totalPartiesForStats) * 100).toFixed(1),
  avg: (totalMatches / totalPartiesForStats).toFixed(2),
  max: maxMatches,
};

// ---------- write the migration ----------

const totalPeople = NUM_SOLO_PARTIES + NUM_COUPLE_PARTIES * 2;
const totalParties = NUM_SOLO_PARTIES + NUM_COUPLE_PARTIES;

const sql = `-- ============================================================
-- Connect TVC -- bulk sample data v2, generated by
-- scripts/generate-sample-data.mjs (re-run that script for a fresh batch).
-- Supersedes 014_bulk_sample_data.sql (left in place as a historical
-- record, not run again).
--
-- ${NUM_GROUPS} groups, ${totalParties} parties (${NUM_SOLO_PARTIES} solo +
-- ${NUM_COUPLE_PARTIES} two-person couples sharing a surname), ${totalPeople}
-- people total. Also seeds a realistic subset of contact_log (~35% of
-- parties, 1-3 entries each) and placement_history rows (every currently-
-- grouped party gets a "current" entry; ~15% of those also get a prior
-- group they moved on from; ~10% of not-currently-grouped parties show a
-- group they previously left) so the outreach log and placement history
-- features aren't empty on a fresh dataset.
--
-- Match-rate distribution under the Finder's default rule (exact city AND
-- day-overlap AND exact life stage): ${matchStats.zeroPct}% of parties have
-- zero candidate groups, ${matchStats.onePct}% have exactly one,
-- ${matchStats.twoPlusPct}% have two or more (avg ${matchStats.avg},
-- max ${matchStats.max} for one party) -- geography is weighted toward
-- 4 primary DFW cities, life stage skews toward Families/Everyone, and
-- day-availability is 4-6 days (not 1-3) so most parties land in the
-- multi-candidate case -- same tuning lesson learned from the original
-- 005_sample_data_dfw.sql v1 -> v2 pass, pushed further since 125 groups
-- across 5 life stages is a sparser pool than that dataset's group count.
--
-- Deletes ALL existing rows in placement_history/contact_log/people/
-- parties/groups first (same "sample data is disposable" convention as
-- every prior bulk-sample migration), then inserts this dataset fresh.
-- Safe to re-run any time.
--
-- Run AFTER 016_placement_history.sql (needs the parties, people, and
-- placement_history tables, plus deleted_at from 015_soft_delete.sql).
-- ============================================================

delete from public.placement_history;
delete from public.contact_log;
delete from public.people;
delete from public.parties;
delete from public.groups;

insert into public.groups
  (id, name, day, time, area, host, mentor, life, status, format, freq,
   capacity, members, childcare, topic, age_range, start_date, contact_email,
   address, description, placement_details)
values
${groupRows.join(",\n")};

insert into public.parties
  (id, party_name, area, address, age, days, time_pref, life, interests,
   childcare_needed, accessibility, status, group_id, joined, notes)
values
${partyRows.join(",\n")};

insert into public.people
  (id, party_id, name, email, phone)
values
${peopleRows.join(",\n")};

insert into public.placement_history
  (party_id, group_id, group_name_snapshot, assigned_by, assigned_at, unassigned_at)
values
${placementHistoryRows.join(",\n")};

insert into public.contact_log
  (party_id, contacted_by, note, created_at)
values
${contactLogRows.join(",\n")};
`;

writeFileSync(OUT_PATH, sql, "utf8");
console.log(`Wrote ${OUT_PATH}`);
console.log(`${NUM_GROUPS} groups, ${totalParties} parties (${NUM_SOLO_PARTIES} solo + ${NUM_COUPLE_PARTIES} couples), ${totalPeople} people.`);
console.log(`${placementHistoryRows.length} placement_history rows, ${contactLogRows.length} contact_log rows.`);
console.log(`Match rate: ${matchStats.zeroPct}% zero, ${matchStats.onePct}% one, ${matchStats.twoPlusPct}% two+ (avg ${matchStats.avg}, max ${matchStats.max}).`);
