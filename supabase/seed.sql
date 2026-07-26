-- ============================================================
-- Connect TVC seed data (matches the design handoff).
-- Run AFTER schema.sql. Safe to re-run (upserts by id).
-- ============================================================

insert into public.groups
  (id, name, day, time, area, host, mentor, life, status, format, freq,
   capacity, members, childcare, topic, age_range, start_date, contact_email,
   address, description, x, y)
values
  ('1','Riverside Table','Tue','7:00 PM','Eastside','Maya & Jon Alvarez','Ben Ortiz','Families','Active','In-person','Weekly',12,9,true,'Family life & the Gospels','30–45','Sep 2025','riverside@connecttvc.org','412 Elm Ct, Eastside','A relaxed weeknight dinner where families share a meal and a short devotional while the kids play together.',24,32),
  ('2','Sunrise Circle','Wed','6:30 AM','Downtown','Grace Kim','—','Young Adults','Full','In-person','Weekly',8,8,false,'Morning study in Proverbs','22–30','Jan 2026','sunrise@connecttvc.org','88 Market St, Downtown','An early coffee-and-study for young professionals to start the day grounded before work.',58,22),
  ('3','The Front Porch','Thu','7:30 PM','North Hills','Danny Osei','Ruth Osei','Everyone','Active','Hybrid','Weekly',14,9,false,'Come-as-you-are conversation','All ages','Mar 2024','frontporch@connecttvc.org','9 Crestview Rd, North Hills','An open, come-as-you-are group that is perfect for anyone new to the area or just exploring.',76,56),
  ('4','Oak & Ember','Sun','5:00 PM','Westgate','Priya & Sam Rao','—','Couples','Active','In-person','Every other week',12,10,true,'Marriage & rhythms of faith','28–50','Oct 2025','oakember@connecttvc.org','220 Birch Ln, Westgate','A close-knit Sunday group for couples building rhythms of faith and friendship together.',40,70),
  ('5','Common Grounds','Mon','12:00 PM','Midtown','Leah Bennett','—','Students','Forming','In-person','Weekly',12,8,false,'Campus lunch & study','18–24','Aug 2026','commongrounds@connecttvc.org','1 University Plz, Midtown','A midday, campus-adjacent gathering for students to connect and recharge over lunch.',54,48)
on conflict (id) do update set
  name=excluded.name, day=excluded.day, time=excluded.time, area=excluded.area,
  host=excluded.host, mentor=excluded.mentor, life=excluded.life,
  status=excluded.status, format=excluded.format, freq=excluded.freq,
  capacity=excluded.capacity, members=excluded.members, childcare=excluded.childcare,
  topic=excluded.topic, age_range=excluded.age_range, start_date=excluded.start_date,
  contact_email=excluded.contact_email, address=excluded.address,
  description=excluded.description, x=excluded.x, y=excluded.y;

insert into public.people
  (id, name, email, phone, area, address, days, time_pref, life, interests,
   childcare_needed, accessibility, status, group_id, joined, notes)
values
  ('js','John Smith','john.smith@email.com','(555) 201-4478','Midtown','210 Campus Ave, Midtown','{Mon,Tue,Fri}','Evenings','Couples','Marriage, serving together',false,'—','New',null,'Jun 2026','Recently married, new to Connect TVC and eager to plug in.'),
  ('sl','Sarah Lopez','sarah.lopez@email.com','(555) 664-1120','Eastside','88 Willow St, Eastside','{Tue,Thu}','Evenings','Families','Parenting, cooking',true,'—','Grouped','1','Feb 2026','Family of four, needs childcare on meeting nights.'),
  ('mb','Marcus Bell','marcus.b@email.com','(555) 903-7781','North Hills','45 Ridge Rd, North Hills','{Thu,Sun}','Flexible','Everyone','Hiking, apologetics',false,'Prefers ground-floor access','Waitlisted',null,'May 2026','New in town, flexible on timing.'),
  ('aw','Aisha Warren','aisha.w@email.com','(555) 448-2093','Downtown','12 Market Sq, Downtown','{Wed,Sat}','Mornings','Young Adults','Worship, mentoring',false,'—','Actively Searching',null,'Jul 2026','Prefers an early-morning group downtown.'),
  ('dt','David Tran','david.tran@email.com','(555) 771-5560','Midtown','300 University Dr, Midtown','{Mon,Thu}','Afternoons','Students','Study groups, gaming',false,'—','Grouped','5','Aug 2026','Sophomore, connected through campus ministry.')
on conflict (id) do update set
  name=excluded.name, email=excluded.email, phone=excluded.phone, area=excluded.area,
  address=excluded.address, days=excluded.days, time_pref=excluded.time_pref, life=excluded.life,
  interests=excluded.interests, childcare_needed=excluded.childcare_needed,
  accessibility=excluded.accessibility, status=excluded.status,
  group_id=excluded.group_id, joined=excluded.joined, notes=excluded.notes;
