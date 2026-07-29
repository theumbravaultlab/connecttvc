import type { Group, Party, Person } from "./types";

// Seed data lifted verbatim from the design handoff (console records = canonical).

export const SEED_GROUPS: Group[] = [
  {
    id: "1", name: "Riverside Table", day: "Tue", time: "7:00 PM", area: "Eastside",
    host: "Maya & Jon Alvarez", mentor: "Ben Ortiz", life: "Families", status: "Open",
    format: "In-person", freq: "Weekly", capacity: 12, members: 9, childcare: true,
    topic: "Family life & the Gospels", ageRange: "30–45", startDate: "Sep 2025",
    contactEmail: "riverside@connecttvc.org", address: "412 Elm Ct, Eastside",
    desc: "A relaxed weeknight dinner where families share a meal and a short devotional while the kids play together.",
    placementDetails: "Childcare on site; street parking only, arrive a few minutes early.",
    assignedTo: null,
  },
  {
    id: "2", name: "Sunrise Circle", day: "Wed", time: "6:30 AM", area: "Downtown",
    host: "Grace Kim", mentor: "—", life: "Young Adults", status: "Closed",
    format: "In-person", freq: "Weekly", capacity: 8, members: 8, childcare: false,
    topic: "Morning study in Proverbs", ageRange: "22–30", startDate: "Jan 2026",
    contactEmail: "sunrise@connecttvc.org", address: "88 Market St, Downtown",
    desc: "An early coffee-and-study for young professionals to start the day grounded before work.",
    placementDetails: "Currently full — worth checking back, spots turn over as folks relocate for work.",
    assignedTo: null,
  },
  {
    id: "3", name: "The Front Porch", day: "Thu", time: "7:30 PM", area: "North Hills",
    host: "Danny Osei", mentor: "Ruth Osei", life: "Everyone", status: "Open",
    format: "Hybrid", freq: "Weekly", capacity: 14, members: 9, childcare: false,
    topic: "Come-as-you-are conversation", ageRange: "All ages", startDate: "Mar 2024",
    contactEmail: "frontporch@connecttvc.org", address: "9 Crestview Rd, North Hills",
    desc: "An open, come-as-you-are group that is perfect for anyone new to the area or just exploring.",
    placementDetails: "Hybrid — a Zoom link goes out to the group same-day for anyone joining online.",
    assignedTo: null,
  },
  {
    id: "4", name: "Oak & Ember", day: "Sun", time: "5:00 PM", area: "Westgate",
    host: "Priya & Sam Rao", mentor: "—", life: "Couples", status: "Open",
    format: "In-person", freq: "Every other week", capacity: 12, members: 10, childcare: true,
    topic: "Marriage & rhythms of faith", ageRange: "28–50", startDate: "Oct 2025",
    contactEmail: "oakember@connecttvc.org", address: "220 Birch Ln, Westgate",
    desc: "A close-knit Sunday group for couples building rhythms of faith and friendship together.",
    placementDetails: "Childcare available with advance notice — text the host by Friday.",
    assignedTo: null,
  },
  {
    id: "5", name: "Common Grounds", day: "Mon", time: "12:00 PM", area: "Midtown",
    host: "Leah Bennett", mentor: "—", life: "Students", status: "New",
    format: "In-person", freq: "Weekly", capacity: 12, members: 8, childcare: false,
    topic: "Campus lunch & study", ageRange: "18–24", startDate: "Aug 2026",
    contactEmail: "commongrounds@connecttvc.org", address: "1 University Plz, Midtown",
    desc: "A midday, campus-adjacent gathering for students to connect and recharge over lunch.",
    placementDetails: "Meets in the campus plaza food court — look for the Connect TVC table tent.",
    assignedTo: null,
  },
];

export const SEED_PARTIES: Party[] = [
  {
    id: "js", partyName: "The Smiths",
    area: "Midtown", address: "210 Campus Ave, Midtown", age: 29,
    days: ["Mon", "Tue", "Fri"], timePref: "Evenings", life: "Couples",
    interests: "Marriage, serving together", childcareNeeded: false, accessibility: "—",
    status: "New", group: null, joined: "Jun 2026",
    notes: "Recently married, new to Connect TVC and eager to plug in.",
    assignedTo: null,
  },
  {
    id: "sl", partyName: "",
    area: "Eastside", address: "88 Willow St, Eastside", age: 34,
    days: ["Tue", "Thu"], timePref: "Evenings", life: "Families",
    interests: "Parenting, cooking", childcareNeeded: true, accessibility: "—",
    status: "Grouped", group: "1", joined: "Feb 2026",
    notes: "Family of four, needs childcare on meeting nights.",
    assignedTo: null,
  },
  {
    id: "mb", partyName: "",
    area: "North Hills", address: "45 Ridge Rd, North Hills", age: 41,
    days: ["Thu", "Sun"], timePref: "Flexible", life: "Everyone",
    interests: "Hiking, apologetics", childcareNeeded: false,
    accessibility: "Prefers ground-floor access", status: "Waitlisted", group: null,
    joined: "May 2026", notes: "New in town, flexible on timing.",
    assignedTo: null,
  },
  {
    id: "aw", partyName: "",
    area: "Downtown", address: "12 Market Sq, Downtown", age: 26,
    days: ["Wed", "Sat"], timePref: "Mornings", life: "Young Adults",
    interests: "Worship, mentoring", childcareNeeded: false, accessibility: "—",
    status: "Actively Searching", group: null, joined: "Jul 2026",
    notes: "Prefers an early-morning group downtown.",
    assignedTo: null,
  },
  {
    id: "dt", partyName: "",
    area: "Midtown", address: "300 University Dr, Midtown", age: 20,
    days: ["Mon", "Thu"], timePref: "Afternoons", life: "Students",
    interests: "Study groups, gaming", childcareNeeded: false, accessibility: "—",
    status: "Grouped", group: "5", joined: "Aug 2026",
    notes: "Sophomore, connected through campus ministry.",
    assignedTo: null,
  },
];

export const SEED_PEOPLE: Person[] = [
  { id: "js-1", partyId: "js", name: "John Smith", email: "john.smith@email.com", phone: "(555) 201-4478" },
  { id: "js-2", partyId: "js", name: "Sarah Smith", email: "", phone: "" },
  { id: "sl-1", partyId: "sl", name: "Sarah Lopez", email: "sarah.lopez@email.com", phone: "(555) 664-1120" },
  { id: "mb-1", partyId: "mb", name: "Marcus Bell", email: "marcus.b@email.com", phone: "(555) 903-7781" },
  { id: "aw-1", partyId: "aw", name: "Aisha Warren", email: "aisha.w@email.com", phone: "(555) 448-2093" },
  { id: "dt-1", partyId: "dt", name: "David Tran", email: "david.tran@email.com", phone: "(555) 771-5560" },
];
