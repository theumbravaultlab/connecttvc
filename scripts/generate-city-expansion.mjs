#!/usr/bin/env node
// ============================================================
// Connect TVC — targeted city-expansion generator.
//
// Adds MORE Home Groups and Parties to five specific DFW-area cities —
// Flower Mound, Corinth, Coppell, Carrollton, Grapevine — without
// touching anything that already exists. Unlike
// scripts/generate-sample-data.mjs (which wipes and replaces the entire
// dataset), this is purely additive: INSERTs only, no deletes.
//
// 5 groups + 10 parties (4 solo + 6 two-person couples) per city, so:
//   25 groups, 50 parties (20 solo + 30 couples), 80 people total.
//
// Continues the existing id sequence from 017_bulk_sample_data_v2.sql
// (125 groups g1-g125, 200 solo parties p1-p200, 300 couple parties
// cp1-cp300) — new records start at g126 / p201 / cp301. This assumes
// 017 has actually been run with exactly those ids still intact; if the
// live database has since diverged (records renamed/deleted/added by
// hand), double check for id collisions before running the output file.
//
// Group surnames are read back out of 017_bulk_sample_data_v2.sql so the
// 25 new group names can't collide with the 125 that already exist.
//
// Writes supabase/018_five_city_expansion.sql. Re-run any time for a
// fresh random batch (it always regenerates that same file).
// ============================================================

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREV_SQL = join(__dirname, "..", "supabase", "017_bulk_sample_data_v2.sql");
const OUT_PATH = join(__dirname, "..", "supabase", "018_five_city_expansion.sql");

const CITIES = [
  { name: "Flower Mound", zip: 75022 },
  { name: "Corinth", zip: 76210 },
  { name: "Coppell", zip: 75019 },
  { name: "Carrollton", zip: 75006 },
  { name: "Grapevine", zip: 76051 },
];
const GROUPS_PER_CITY = 5;
const SOLO_PER_CITY = 4;
const COUPLE_PER_CITY = 6; // -> 12 people per city; matches the 2:3 solo:couple ratio from 017

const GROUP_ID_START = 126;
const SOLO_ID_START = 201;
const COUPLE_ID_START = 301;

// ---------- pools (same flavor as generate-sample-data.mjs) ----------

const STREETS = [
  "Josey Ln", "Precinct Line Rd", "Belt Line Rd", "Mockingbird Ln", "Custer Rd", "Broad St",
  "Meadow Creek Dr", "Elm St", "Cross Timbers Rd", "Rufe Snow Dr", "Preston Rd", "Parker Rd",
  "Pioneer Pkwy", "Walnut Hill Ln", "Virginia Pkwy", "Spring Creek Pkwy", "Collins St",
  "Division St", "Main St", "Stonebridge Dr", "Eldorado Pkwy", "Mason Ave", "FM 407",
  "Timber Creek Dr", "Long Prairie Rd",
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
// Same large pool as generate-sample-data.mjs, so re-running either script
// still draws from a consistent name universe.
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
  // Extra names so 25 unique surnames are still available after excluding
  // whichever of the above 017 already used.
  "Vargas", "Chapman", "Dunn", "Pittman", "Larson", "Freeman", "Wolfe", "Sharma", "Osborne",
  "Delacroix", "Whitfield", "Sanborn", "Marlow", "Ellison", "Frost", "Sinclair", "Beaumont",
  "Larkin", "Prescott", "Vance", "Winslow", "Ashford", "Kessler", "Thorne",
];
const LAST_NAMES = [...new Set(LAST_NAMES_RAW)];

const LIFE_STAGE_POOL = [
  "Families", "Families", "Families", "Families",
  "Everyone", "Everyone", "Everyone", "Everyone",
  "Couples", "Couples",
  "Young Adults", "Young Adults",
  "Students",
];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_WEIGHTS = [1, 3, 3, 3, 2, 2, 1];
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
  "", "",
];

// ---------- helpers ----------

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
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
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
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
function pluralize(name) { return /[sxz]$|ch$|sh$/i.test(name) ? `${name}es` : `${name}s`; }
function esc(s) { return String(s).replace(/'/g, "''"); }
function q(s) { return `'${esc(s)}'`; }
function sqlArray(arr) { return `ARRAY[${arr.map((d) => `'${d}'`).join(",")}]::text[]`; }
function fullName() {
  const male = Math.random() < 0.5;
  const first = rand(male ? MALE_FIRST : FEMALE_FIRST);
  const last = rand(LAST_NAMES);
  return `${first} ${last}`;
}
function addressIn(city, zip) {
  return `${randInt(100, 9899)} ${rand(STREETS)}, ${city}, TX ${zip}`;
}
function slug(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, ""); }
function joinedDate() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${rand(months)} ${randInt(2015, 2026)}`;
}
function email(first, last, domain = "email.com") {
  const n = Math.random() < 0.3 ? randInt(1, 99) : "";
  return `${first}.${last}${n}@${domain}`.toLowerCase();
}
function phone() { return `(555) ${randInt(200, 999)}-${randInt(1000, 9999)}`; }

// ---------- read existing group names out of 017, to avoid collisions ----------

const prevSql = readFileSync(PREV_SQL, "utf8");
const usedGroupNames = new Set();
for (const line of prevSql.split("\n")) {
  const m = line.match(/^\('g\d+','(The [^']+)'/);
  if (m) usedGroupNames.add(m[1]);
}

const availableSurnames = LAST_NAMES.filter((n) => !usedGroupNames.has(`The ${pluralize(n)}`));
const neededSurnames = CITIES.length * GROUPS_PER_CITY;
if (availableSurnames.length < neededSurnames) {
  throw new Error(
    `Only ${availableSurnames.length} unique surnames left unused by 017, need ${neededSurnames}. Add more names to LAST_NAMES_RAW.`,
  );
}
const newSurnames = shuffled(availableSurnames).slice(0, neededSurnames);

// ---------- generate ----------

const groupRows = [];
const partyRows = [];
const peopleRows = [];
const groupsMeta = []; // for the self-contained match-rate check below
const partiesMeta = [];

let groupIdCounter = GROUP_ID_START;
let soloIdCounter = SOLO_ID_START;
let coupleIdCounter = COUPLE_ID_START;
let surnameIdx = 0;

for (const city of CITIES) {
  const cityGroupIds = [];

  for (let i = 0; i < GROUPS_PER_CITY; i++) {
    const id = `g${groupIdCounter++}`;
    const lastName = newSurnames[surnameIdx++];
    const host = `${rand(MALE_FIRST)} ${lastName} and ${rand(FEMALE_FIRST)} ${lastName}`;
    const mentor = Math.random() < 0.3 ? "—" : `${Math.random() < 0.5 ? rand(MALE_FIRST) : rand(FEMALE_FIRST)} ${rand(LAST_NAMES)}`;
    const name = `The ${pluralize(lastName)}`;
    const addr = addressIn(city.name, city.zip);
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

    cityGroupIds.push(id);
    groupsMeta.push({ id, name, area: city.name, life, day });
    groupRows.push(
      `(${q(id)},${q(name)},${q(day)},${q(time)},${q(city.name)},${q(host)},${q(mentor)},${q(life)},${q(status)},${q(format)},${q(freq)},${capacity},${members},${childcare},${q(topic)},${q(ageRange)},${q(startDate)},${q(contactEmail)},${q(addr)},${q(desc)},${q(placement)})`,
    );
  }

  const pickStatusAndGroup = () => {
    const status = rand(PARTY_STATUS_POOL);
    const group = status === "Grouped" ? rand(cityGroupIds) : null;
    return { status, group };
  };

  for (let i = 0; i < SOLO_PER_CITY; i++) {
    const partyId = `p${soloIdCounter++}`;
    const addr = addressIn(city.name, city.zip);
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

    partiesMeta.push({ area: city.name, life, days });
    partyRows.push(
      `(${q(partyId)},'',${q(city.name)},${q(addr)},${age},${sqlArray(days)},${q(timePref)},${q(life)},${q(interests)},${childcareNeeded},${q(accessibility)},${q(status)},${group ? q(group) : "null"},${q(joined)},${q(notes)})`,
    );

    const [first, last] = fullName().split(" ");
    const personId = `sp${soloIdCounter}`;
    peopleRows.push(`(${q(personId)},${q(partyId)},${q(`${first} ${last}`)},${q(email(first, last))},${q(phone())})`);
  }

  for (let i = 0; i < COUPLE_PER_CITY; i++) {
    const partyId = `cp${coupleIdCounter}`;
    const lastName = rand(LAST_NAMES); // couples may freely reuse surnames -- normal, unlike groups
    const partyName = `The ${pluralize(lastName)}`;
    const addr = addressIn(city.name, city.zip);
    const life = rand(LIFE_STAGE_POOL);
    const age = ageForLife(life);
    const days = randPartyDays();
    const timePref = rand(TIME_PREFS);
    const childcareNeeded = Math.random() < 0.45;
    const accessibility = Math.random() < 0.05 ? "Prefers ground-floor access" : "—";
    const interests = rand(INTERESTS);
    const notes = rand(NOTES);
    const joined = joinedDate();
    const { status, group } = pickStatusAndGroup();

    partiesMeta.push({ area: city.name, life, days });
    partyRows.push(
      `(${q(partyId)},${q(partyName)},${q(city.name)},${q(addr)},${age},${sqlArray(days)},${q(timePref)},${q(life)},${q(interests)},${childcareNeeded},${q(accessibility)},${q(status)},${group ? q(group) : "null"},${q(joined)},${q(notes)})`,
    );

    const firstA = rand(MALE_FIRST);
    const firstB = rand(FEMALE_FIRST);
    peopleRows.push(`(${q(`${partyId}a`)},${q(partyId)},${q(`${firstA} ${lastName}`)},${q(email(firstA, lastName))},${q(phone())})`);
    peopleRows.push(`(${q(`${partyId}b`)},${q(partyId)},${q(`${firstB} ${lastName}`)},${q(email(firstB, lastName))},${q(phone())})`);
    coupleIdCounter++;
  }
}

// ---------- self-contained match-rate check (new groups vs new parties
// only -- these all share the same 5 cities, so this is meaningful on its
// own; it does not cross-check against the existing 125 groups / 500
// parties from 017, which would need parsing that file's full contents) ----------

function matchCount(party) {
  return groupsMeta.filter(
    (g) => g.area === party.area && g.life === party.life && party.days.includes(g.day),
  ).length;
}
let zero = 0, one = 0, twoPlus = 0, total = 0, max = 0;
for (const p of partiesMeta) {
  const c = matchCount(p);
  total += c;
  if (c > max) max = c;
  if (c === 0) zero++; else if (c === 1) one++; else twoPlus++;
}
const n = partiesMeta.length;
const stats = {
  zeroPct: ((zero / n) * 100).toFixed(1),
  onePct: ((one / n) * 100).toFixed(1),
  twoPlusPct: ((twoPlus / n) * 100).toFixed(1),
  avg: (total / n).toFixed(2),
  max,
};

// ---------- write ----------

const totalGroups = CITIES.length * GROUPS_PER_CITY;
const totalParties = CITIES.length * (SOLO_PER_CITY + COUPLE_PER_CITY);
const totalPeople = CITIES.length * (SOLO_PER_CITY + COUPLE_PER_CITY * 2);

const sql = `-- ============================================================
-- Connect TVC -- five-city expansion, generated by
-- scripts/generate-city-expansion.mjs (re-run for a fresh random batch).
--
-- Adds ${totalGroups} groups and ${totalParties} parties (${CITIES.length * SOLO_PER_CITY}
-- solo + ${CITIES.length * COUPLE_PER_CITY} two-person couples, ${totalPeople} people total)
-- spread evenly across five cities -- ${GROUPS_PER_CITY} groups and
-- ${SOLO_PER_CITY + COUPLE_PER_CITY} parties (${SOLO_PER_CITY} solo, ${COUPLE_PER_CITY} couples) in
-- each of: ${CITIES.map((c) => c.name).join(", ")}.
--
-- PURELY ADDITIVE -- unlike 017_bulk_sample_data_v2.sql, this file
-- contains no DELETEs. It only inserts new rows, continuing the existing
-- id sequence (groups g${GROUP_ID_START}-g${GROUP_ID_START + totalGroups - 1}, solo parties
-- p${SOLO_ID_START}-p${SOLO_ID_START + CITIES.length * SOLO_PER_CITY - 1}, couple parties
-- cp${COUPLE_ID_START}-cp${COUPLE_ID_START + CITIES.length * COUPLE_PER_CITY - 1}) -- this assumes
-- 017 has already been run with those ids intact and untouched.
--
-- All ${totalGroups} new group names were checked against the ${usedGroupNames.size}
-- group names already in 017_bulk_sample_data_v2.sql and are guaranteed
-- not to collide.
--
-- Match-rate check (new groups vs. new parties only, since all of them
-- share these same 5 cities -- does not cross-check against the existing
-- 125 groups / 500 parties from 017): ${stats.zeroPct}% of the new parties
-- have zero candidate groups among the new groups alone, ${stats.onePct}%
-- have exactly one, ${stats.twoPlusPct}% have two or more (avg ${stats.avg},
-- max ${stats.max}). Note Corinth and Coppell had zero existing groups/parties
-- before this file, so new households there only match against the
-- ${GROUPS_PER_CITY} new groups in their own city -- expected, not a bug.
--
-- Run this in the Supabase SQL editor any time after 017_bulk_sample_data_v2.sql.
-- ============================================================

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
`;

writeFileSync(OUT_PATH, sql, "utf8");
console.log(`Wrote ${OUT_PATH}`);
console.log(`${totalGroups} groups, ${totalParties} parties (${CITIES.length * SOLO_PER_CITY} solo + ${CITIES.length * COUPLE_PER_CITY} couples), ${totalPeople} people.`);
console.log(`Match rate (new-vs-new only): ${stats.zeroPct}% zero, ${stats.onePct}% one, ${stats.twoPlusPct}% two+ (avg ${stats.avg}, max ${stats.max}).`);
