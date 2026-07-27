#!/usr/bin/env node
// ============================================================
// Connect TVC — bulk sample-data generator.
//
// Regenerates a brand-new, internally-consistent sample dataset: 100 Home
// Groups, 200 solo Parties (one linked Person each), and 150 two-person
// Parties (two linked Person rows each, 300 people total) — 350 parties /
// 500 people in all. Writes a ready-to-run SQL migration to
// supabase/014_bulk_sample_data.sql, which DELETEs every existing
// group/party/person/contact-log row first, then inserts the fresh set.
//
// Re-run any time you want a different random batch:
//   node scripts/generate-sample-data.mjs
//
// This only ever writes the .sql file — it does not touch your database.
// Review the generated file, then run it yourself in the Supabase SQL
// editor (same workflow as every other migration in supabase/).
// ============================================================

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "..", "supabase", "014_bulk_sample_data.sql");

const NUM_GROUPS = 100;
const NUM_SOLO_PARTIES = 200;
const NUM_COUPLE_PARTIES = 150; // -> 300 people

// ---------- pools ----------

const CITIES = [
  ["Dallas", 75201], ["Fort Worth", 76102], ["Arlington", 76010], ["Plano", 75023],
  ["Frisco", 75034], ["McKinney", 75069], ["Garland", 75040], ["Irving", 75060],
  ["Grand Prairie", 75050], ["Richardson", 75080], ["Carrollton", 75006], ["Denton", 76201],
  ["Lewisville", 75056], ["Mesquite", 75149], ["Allen", 75002], ["Flower Mound", 75022],
  ["North Richland Hills", 76180], ["Mansfield", 76063], ["Rowlett", 75088], ["Euless", 76039],
  ["DeSoto", 75115], ["Cedar Hill", 75104], ["Wylie", 75098], ["Grapevine", 76051],
  ["Bedford", 76021], ["Rockwall", 75087], ["Keller", 76244], ["Southlake", 76092],
  ["Burleson", 76028], ["Haltom City", 76117], ["Hurst", 76053], ["Duncanville", 75116],
  ["Little Elm", 75068], ["Prosper", 75078], ["Sachse", 75048], ["The Colony", 75056],
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
const LAST_NAMES = [
  "Smith", "Grier", "Warren", "Landry", "Marchetti", "Whitcomb", "Rojas", "Zhang", "Reyes",
  "Rivera", "Whitson", "Farris", "Tanaka", "Guerrero", "Cho", "Ortiz", "Reed", "Castro",
  "Sheppard", "Reed", "Anand", "Lang", "Murphy", "Ramirez", "Whitaker", "Solis", "Sato",
  "Ledbetter", "Diaz", "Powell", "Roca", "Palmer", "Lindqvist", "Alston", "Whitmore",
  "Salcedo", "Delgado", "Osei", "Voss", "Nolan", "Lopez", "Alvarez", "Long", "Ross", "Baker",
  "Hughes", "Bennett", "Church", "Fox", "Cross", "Marsh", "Cruz", "Kim", "Patel", "Nguyen",
  "Perez", "Foster", "Wells", "Hunt",
];

const LIFE_STAGES = ["Families", "Young Adults", "Everyone", "Couples", "Students"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_WEIGHTS = [1, 3, 3, 3, 2, 2, 1]; // weeknight-heavy, matches the existing dataset's skew
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

// ---------- helpers ----------

let seedCounter = 1;
function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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
function randDays() {
  const count = randInt(1, 3);
  const pool = [...DAYS];
  const picked = [];
  for (let i = 0; i < count; i++) {
    const idx = randInt(0, pool.length - 1);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
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
  const [city, zipBase] = rand(CITIES);
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
function nextId(prefix) {
  return `${prefix}${seedCounter++}`;
}

// ---------- groups ----------

const groupIds = [];
const groupRows = [];
for (let i = 0; i < NUM_GROUPS; i++) {
  seedCounter = i + 1;
  const id = `g${i + 1}`;
  groupIds.push(id);
  const lastName = rand(LAST_NAMES);
  const host = `${rand(MALE_FIRST)} ${lastName} and ${rand(FEMALE_FIRST)} ${lastName}`;
  const mentor = Math.random() < 0.3 ? "—" : `${Math.random() < 0.5 ? rand(MALE_FIRST) : rand(FEMALE_FIRST)} ${rand(LAST_NAMES)}`;
  const name = `The ${pluralize(lastName)}`;
  const { city, address: addr } = address();
  const life = rand(LIFE_STAGES);
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

  groupRows.push(
    `('${id}','${esc(name)}','${day}','${time}','${esc(city)}','${esc(host)}','${esc(mentor)}','${life}','${status}','${format}','${freq}',${capacity},${members},${childcare},'${esc(topic)}','${ageRange}','${startDate}','${contactEmail}','${esc(addr)}','${esc(desc)}','${esc(placement)}')`,
  );
}

// ---------- parties + people ----------

const partyRows = [];
const peopleRows = [];

function pickStatusAndGroup() {
  const status = rand(PARTY_STATUS_POOL);
  const group = status === "Grouped" ? rand(groupIds) : null;
  return { status, group };
}

// Solo parties — one linked person each.
for (let i = 0; i < NUM_SOLO_PARTIES; i++) {
  const partyId = `p${i + 1}`;
  const { city, address: addr } = address();
  const life = rand(LIFE_STAGES);
  const age = ageForLife(life);
  const days = randDays();
  const timePref = rand(TIME_PREFS);
  const childcareNeeded = Math.random() < 0.25;
  const accessibility = Math.random() < 0.05 ? "Prefers ground-floor access" : "—";
  const interests = rand(INTERESTS);
  const notes = rand(NOTES);
  const joined = joinedDate();
  const { status, group } = pickStatusAndGroup();

  partyRows.push(
    `('${partyId}','','${esc(city)}','${esc(addr)}',${age},${sqlArray(days)},'${timePref}','${life}','${esc(interests)}',${childcareNeeded},'${esc(accessibility)}','${status}',${group ? `'${group}'` : "null"},'${joined}','${esc(notes)}')`,
  );

  const [first, last] = fullName().split(" ");
  const personId = `sp${i + 1}`;
  peopleRows.push(
    `('${personId}','${partyId}','${esc(`${first} ${last}`)}','${email(first, last)}','${phone()}')`,
  );
}

// Two-person parties — a linked couple sharing one surname.
for (let i = 0; i < NUM_COUPLE_PARTIES; i++) {
  const partyId = `cp${i + 1}`;
  const lastName = rand(LAST_NAMES);
  const partyName = `The ${pluralize(lastName)}`;
  const { city, address: addr } = address();
  const life = rand(LIFE_STAGES);
  const age = ageForLife(life);
  const days = randDays();
  const timePref = rand(TIME_PREFS);
  const childcareNeeded = Math.random() < 0.45; // couples skew higher — more likely to have kids
  const accessibility = Math.random() < 0.05 ? "Prefers ground-floor access" : "—";
  const interests = rand(INTERESTS);
  const notes = rand(NOTES);
  const joined = joinedDate();
  const { status, group } = pickStatusAndGroup();

  partyRows.push(
    `('${partyId}','${esc(partyName)}','${esc(city)}','${esc(addr)}',${age},${sqlArray(days)},'${timePref}','${life}','${esc(interests)}',${childcareNeeded},'${esc(accessibility)}','${status}',${group ? `'${group}'` : "null"},'${joined}','${esc(notes)}')`,
  );

  const firstA = rand(MALE_FIRST);
  const firstB = rand(FEMALE_FIRST);
  const idA = `cp${i + 1}a`;
  const idB = `cp${i + 1}b`;
  peopleRows.push(
    `('${idA}','${partyId}','${esc(`${firstA} ${lastName}`)}','${email(firstA, lastName)}','${phone()}')`,
  );
  peopleRows.push(
    `('${idB}','${partyId}','${esc(`${firstB} ${lastName}`)}','${email(firstB, lastName)}','${phone()}')`,
  );
}

// ---------- write the migration ----------

const totalPeople = NUM_SOLO_PARTIES + NUM_COUPLE_PARTIES * 2;
const totalParties = NUM_SOLO_PARTIES + NUM_COUPLE_PARTIES;

const sql = `-- ============================================================
-- Connect TVC -- bulk sample data, generated by
-- scripts/generate-sample-data.mjs (re-run that script for a fresh batch).
--
-- ${NUM_GROUPS} groups, ${totalParties} parties (${NUM_SOLO_PARTIES} solo +
-- ${NUM_COUPLE_PARTIES} two-person couples), ${totalPeople} people total.
--
-- Deletes ALL existing rows in contact_log/people/parties/groups first
-- (same "sample data is disposable" convention as 005_sample_data_dfw.sql),
-- then inserts this dataset fresh. Safe to re-run any time.
--
-- Run AFTER 013_party_split.sql (needs the parties table + people.party_id).
-- ============================================================

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
`;

writeFileSync(OUT_PATH, sql, "utf8");
console.log(`Wrote ${OUT_PATH}`);
console.log(`${NUM_GROUPS} groups, ${totalParties} parties (${NUM_SOLO_PARTIES} solo + ${NUM_COUPLE_PARTIES} couples), ${totalPeople} people.`);
