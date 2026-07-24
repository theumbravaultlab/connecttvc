import type { Group, Person } from "./types";

// Seed data lifted verbatim from the design handoff (console records = canonical).
// `x`/`y` are the design's mock map percentages, used as a fallback pin position
// until real geocoding populates lat/lng.

export const SEED_GROUPS: Group[] = [
  {
    id: "1", name: "Riverside Table", day: "Tue", time: "7:00 PM", area: "Eastside",
    host: "Maya & Jon Alvarez", coHost: "Ben Ortiz", life: "Families", status: "Active",
    format: "In-person", freq: "Weekly", capacity: 12, members: 9, childcare: true,
    topic: "Family life & the Gospels", ageRange: "30–45", startDate: "Sep 2025",
    contactEmail: "riverside@connecttvc.org", address: "412 Elm Ct, Eastside",
    desc: "A relaxed weeknight dinner where families share a meal and a short devotional while the kids play together.",
    x: 24, y: 32,
  },
  {
    id: "2", name: "Sunrise Circle", day: "Wed", time: "6:30 AM", area: "Downtown",
    host: "Grace Kim", coHost: "—", life: "Young Adults", status: "Full",
    format: "In-person", freq: "Weekly", capacity: 8, members: 8, childcare: false,
    topic: "Morning study in Proverbs", ageRange: "22–30", startDate: "Jan 2026",
    contactEmail: "sunrise@connecttvc.org", address: "88 Market St, Downtown",
    desc: "An early coffee-and-study for young professionals to start the day grounded before work.",
    x: 58, y: 22,
  },
  {
    id: "3", name: "The Front Porch", day: "Thu", time: "7:30 PM", area: "North Hills",
    host: "Danny Osei", coHost: "Ruth Osei", life: "Everyone", status: "Active",
    format: "Hybrid", freq: "Weekly", capacity: 14, members: 9, childcare: false,
    topic: "Come-as-you-are conversation", ageRange: "All ages", startDate: "Mar 2024",
    contactEmail: "frontporch@connecttvc.org", address: "9 Crestview Rd, North Hills",
    desc: "An open, come-as-you-are group that is perfect for anyone new to the area or just exploring.",
    x: 76, y: 56,
  },
  {
    id: "4", name: "Oak & Ember", day: "Sun", time: "5:00 PM", area: "Westgate",
    host: "Priya & Sam Rao", coHost: "—", life: "Couples", status: "Active",
    format: "In-person", freq: "Every other week", capacity: 12, members: 10, childcare: true,
    topic: "Marriage & rhythms of faith", ageRange: "28–50", startDate: "Oct 2025",
    contactEmail: "oakember@connecttvc.org", address: "220 Birch Ln, Westgate",
    desc: "A close-knit Sunday group for couples building rhythms of faith and friendship together.",
    x: 40, y: 70,
  },
  {
    id: "5", name: "Common Grounds", day: "Mon", time: "12:00 PM", area: "Midtown",
    host: "Leah Bennett", coHost: "—", life: "Students", status: "Forming",
    format: "In-person", freq: "Weekly", capacity: 12, members: 8, childcare: false,
    topic: "Campus lunch & study", ageRange: "18–24", startDate: "Aug 2026",
    contactEmail: "commongrounds@connecttvc.org", address: "1 University Plz, Midtown",
    desc: "A midday, campus-adjacent gathering for students to connect and recharge over lunch.",
    x: 54, y: 48,
  },
];

export const SEED_PEOPLE: Person[] = [
  {
    id: "js", name: "John Smith", email: "john.smith@email.com", phone: "(555) 201-4478",
    area: "Midtown", days: ["Mon", "Tue", "Fri"], timePref: "Evenings", life: "Couples",
    interests: "Marriage, serving together", childcareNeeded: false, accessibility: "—",
    status: "Unassigned", group: null, joined: "Jun 2026",
    notes: "Recently married, new to Connect TVC and eager to plug in.",
  },
  {
    id: "sl", name: "Sarah Lopez", email: "sarah.lopez@email.com", phone: "(555) 664-1120",
    area: "Eastside", days: ["Tue", "Thu"], timePref: "Evenings", life: "Families",
    interests: "Parenting, cooking", childcareNeeded: true, accessibility: "—",
    status: "Matched", group: "1", joined: "Feb 2026",
    notes: "Family of four, needs childcare on meeting nights.",
  },
  {
    id: "mb", name: "Marcus Bell", email: "marcus.b@email.com", phone: "(555) 903-7781",
    area: "North Hills", days: ["Thu", "Sun"], timePref: "Flexible", life: "Everyone",
    interests: "Hiking, apologetics", childcareNeeded: false,
    accessibility: "Prefers ground-floor access", status: "Waitlisted", group: null,
    joined: "May 2026", notes: "New in town, flexible on timing.",
  },
  {
    id: "aw", name: "Aisha Warren", email: "aisha.w@email.com", phone: "(555) 448-2093",
    area: "Downtown", days: ["Wed", "Sat"], timePref: "Mornings", life: "Young Adults",
    interests: "Worship, mentoring", childcareNeeded: false, accessibility: "—",
    status: "Unassigned", group: null, joined: "Jul 2026",
    notes: "Prefers an early-morning group downtown.",
  },
  {
    id: "dt", name: "David Tran", email: "david.tran@email.com", phone: "(555) 771-5560",
    area: "Midtown", days: ["Mon", "Thu"], timePref: "Afternoons", life: "Students",
    interests: "Study groups, gaming", childcareNeeded: false, accessibility: "—",
    status: "Matched", group: "5", joined: "Aug 2026",
    notes: "Sophomore, connected through campus ministry.",
  },
];
