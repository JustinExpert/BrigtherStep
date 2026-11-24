# BrighterStep – End-to-End Test Scenario

One story through a full school year: set up the school, enrol students, teach, grade, print
report cards, then close the year. Each step says what to do and what should happen.
Tick **Pass** or write what went wrong.

> **Run this on the test copy only.** Never on the live site or live database.
> Saves made during testing would change real school data.

---

## 0. Before you start

| # | Do | Expected | Pass |
|---|---|---|---|
| 0.1 | In `.env`, set `MONGODB_DB=brighterstep_yeartest` (the copy). Confirm `VENDOR_KEY` is set. | — | ☐ |
| 0.2 | `npm run db:check` | Connects; password not printed | ☐ |
| 0.3 | `npm run db:seed -- --reset` then `npm run db:add-sample-levels` | Demo data loaded; sample Kinder / JHS / SHS / College sections added | ☐ |
| 0.4 | `npm run db:audit` | Clean, no problems listed | ☐ |
| 0.5 | `npm run dev:api` and `npm run dev`, open http://localhost:5173 | Login page shows | ☐ |
| 0.6 | Open http://localhost:3001/api/health | Says the database is connected | ☐ |

Test accounts (passwords in README §14): Super Admin, School Admin, Teacher, Student, Parent.
Use names starting with **TEST** for anything you create, so it's easy to find and remove.

---

## 1. Create the users

The story starts with the Super Admin and builds every other account from there.
Accounts for teachers, students and parents get **linked** to their records later (section 5),
once those records exist.

### 1a. Super Admin creates the School Admin

| # | Do | Expected | Pass |
|---|---|---|---|
| 1.1 | Sign in as Super Admin | Lands on Admin Dashboard with totals | ☐ |
| 1.2 | **My Account**: change the Super Admin's password | Saved; new password works next sign-in | ☐ |
| 1.3 | **User Management → Add user**: "TEST Admin", role **School Admin**, temporary password | Account listed as active | ☐ |
| 1.4 | Add another user with the **same email** | Refused: one account per email | ☐ |
| 1.5 | Sign out. Sign in as TEST Admin with the temporary password | "Set your password" screen; nothing else opens until a new password is saved, then the Admin Dashboard | ☐ |
| 1.6 | TEST Admin → **My Account**: set name, phone, photo | Saved | ☐ |

### 1b. School Admin creates staff accounts

| # | Do | Expected | Pass |
|---|---|---|---|
| 1.7 | As TEST Admin → **User Management → Add user**: "TEST Teacher", role **Teacher**, temporary password | Account listed | ☐ |
| 1.8 | Sign in as TEST Teacher | Signs in; sees no sections yet (none assigned) | ☐ |
| 1.9 | As TEST Admin, **deactivate** TEST Teacher, then try to sign in as them | Refused | ☐ |
| 1.10 | **Reactivate** TEST Teacher | Can sign in again | ☐ |

### 1c. Students and parents sign up themselves

| # | Do | Expected | Pass |
|---|---|---|---|
| 1.11 | On the login page → **Register** as a student: "TEST Student A" | Account created, **waiting for approval** | ☐ |
| 1.12 | Try to sign in as that student | Refused until approved | ☐ |
| 1.13 | **Register** as a parent: "TEST Parent" | Waiting for approval | ☐ |
| 1.14 | As TEST Admin → User Management | Both show as waiting (approved and linked in section 5) | ☐ |

### 1d. Sign-in safety

| # | Do | Expected | Pass |
|---|---|---|---|
| 1.15 | Sign in as TEST Teacher with a wrong password 5 times | 5th try: account locked for 5 minutes | ☐ |
| 1.16 | Try the correct password straight away | Still locked; works after 5 minutes | ☐ |
| 1.17 | **Forgot password** for TEST Teacher | Reset link created (shown on screen only if `DEMO_RESET_LINKS=true`; otherwise admin sends it from User Management) | ☐ |
| 1.18 | Open the reset link, set a new password, sign in | Works; old password no longer works | ☐ |
| 1.19 | As TEST Admin, set a **temporary password** for TEST Teacher | Teacher can sign in with it | ☐ |

---

## 2. School levels (vendor)

| # | Do | Expected | Pass |
|---|---|---|---|
| 2.1 | Super Admin → **School Levels**. Turn off College, save with a **wrong** vendor code | Refused | ☐ |
| 2.2 | Wrong code 5 times | Page locked for 5 minutes | ☐ |
| 2.3 | After the lock, save with the right code (College off) | Saved, no redeploy needed | ☐ |
| 2.4 | Check Students, Sections, Subjects, Gradebook | No College tab, no College students | ☐ |
| 2.5 | Turn College back on | College tab and data come back unchanged | ☐ |
| 2.6 | Sign in as School Admin, try opening `/levels` | Sent back to the dashboard | ☐ |

---

## 3. School Setup (Super Admin)

| # | Do | Expected | Pass |
|---|---|---|---|
| 3.1 | Edit school name, address, contacts | Saved; name shows in the header | ☐ |
| 3.2 | Check school year label and dates | Correct open year | ☐ |
| 3.3 | Tick **Use DepEd grading** | Passing 75, O / VS / S / FS / DME scale | ☐ |
| 3.4 | Set weights for a subject to 30 / 50 / 30 (=110%) | Refused: must add up to 100% | ☐ |
| 3.5 | Set 30 / 50 / 20 | Saved | ☐ |
| 3.6 | Add SHS strand "TEST-ARTS" | Appears in the SHS section and subject forms | ☐ |
| 3.7 | Add College program `TBSX` "TEST Program", 4 years | Appears in College section form | ☐ |
| 3.8 | Change a period start time in Timetable's Time column | All sections show the new time | ☐ |

---

## 4. Subjects, sections, teachers

| # | Do | Expected | Pass |
|---|---|---|---|
| 4.1 | **Subjects → Elementary**: add "TEST Science" for Grades 4–6 | Shows on Elementary tab only for those grades | ☐ |
| 4.2 | **Subjects → Senior High**: add "TEST Drawing", 2nd semester, strand TEST-ARTS | Saved with semester and strand | ☐ |
| 4.3 | **Subjects → College**: add "TEST Programming 1", 3 units, 1st sem, program TBSX | Saved | ☐ |
| 4.4 | Try to rename or delete a subject that already has grades | Refused (in use) | ☐ |
| 4.5 | **Sections → Elementary**: add "Grade 5 – TEST Rose", adviser, room, capacity | Saved for the open year | ☐ |
| 4.6 | Add another "Grade 5 – TEST Rose" | Refused: name must be unique in the grade | ☐ |
| 4.7 | **Sections → Senior High**: "Grade 11 – TEST Arts", strand TEST-ARTS | Saved | ☐ |
| 4.8 | **Sections → College**: "TBSX 1st Year – A" | Saved | ☐ |
| 4.9 | **Teachers**: add "TEST Teacher" with a main subject | Saved | ☐ |
| 4.10 | **Teaching Assignments**: TEST Teacher → TEST Rose / TEST Science, and TBSX 1-A / TEST Programming 1 | Saved | ☐ |

---

## 5. Students and users

| # | Do | Expected | Pass |
|---|---|---|---|
| 5.1 | **Students → Admission Form**: add "TEST Student A" to Grade 5 – TEST Rose | Saved; enrolment history starts today | ☐ |
| 5.2 | Add "TEST Student B" to TEST Rose, "TEST Student C" to TBSX 1-A, "TEST Student D" to Grade 11 – TEST Arts | Saved | ☐ |
| 5.3 | Try a student with a missing required field or bad email | Refused with a clear message | ☐ |
| 5.4 | Students list: search "TEST", sort by name, go to page 2 | Correct results; paging works | ☐ |
| 5.5 | **Export CSV** with the "TEST" search | CSV has every matching student | ☐ |
| 5.6 | **User Management**: link the TEST Teacher login (1.7) to the TEST Teacher record (4.9) | Linked | ☐ |
| 5.7 | Approve the student sign-up (1.11) and link it to the TEST Student A record | Approved; student can now sign in | ☐ |
| 5.8 | Approve "TEST Parent" (1.13) and link TEST Student A as their child | Approved; parent can now sign in | ☐ |
| 5.9 | Sign in as each of the three | Teacher sees TEST Rose and TBSX 1-A; student sees own profile; parent sees TEST Student A only | ☐ |

---

## 5b. Student logins at enrolment

| # | Do | Expected | Pass |
|---|---|---|---|
| 5b.1 | TEST Student C's page → **Sign-in accounts → Create logins**: student login with no email, new parent "TEST Parent C" with an email | Student signs in with the STU-… ID, parent with the email; temporary passwords shown once | ☐ |
| 5b.2 | **Print slip** | Two slips with sign-in details and "choose your own password at first sign-in" | ☐ |
| 5b.3 | Kinder student → Create logins | Student login not ticked by default (parent only) | ☐ |
| 5b.4 | TEST Student D → add to the existing TEST Parent C login | Parent now has 2 children; slip says "existing password" | ☐ |
| 5b.5 | Sign in with TEST Student C's ID (lowercase) + temporary password | "Set your password" screen; other URLs don't open | ☐ |
| 5b.6 | Set a new password | Dashboard opens; old temporary password no longer works | ☐ |
| 5b.7 | 5 wrong passwords with the ID, then admin's lock icon → new temporary password | Locked; the new temporary password clears the lock and must be changed | ☐ |
| 5b.8 | Register as a student with TEST Student C's ID | Refused: already has an account | ☐ |

---

## 6. Timetable

| # | Do | Expected | Pass |
|---|---|---|---|
| 6.1 | **Timetable → Edit** for TEST Rose: put TEST Science on Monday period 1 | Saved | ☐ |
| 6.2 | Put TEST Programming 1 in TBSX 1-A at the **same** Monday period 1 (same teacher) | Refused: teacher double-booked | ☐ |
| 6.3 | Move it to period 2 | Saved | ☐ |
| 6.4 | Open a level with no sections | Shows a button to create a section first | ☐ |

---

## 7. Daily work (as TEST Teacher)

| # | Do | Expected | Pass |
|---|---|---|---|
| 7.1 | Sign in as TEST Teacher | Dashboard shows only TEST Rose and TBSX 1-A, and today's schedule | ☐ |
| 7.2 | Open Students / Sections | Only their own sections' students | ☐ |
| 7.3 | **Attendance**: TEST Rose, today: A = Present, B = Late | Saved | ☐ |
| 7.4 | Mark another day: A = Absent | Saved | ☐ |
| 7.5 | **Announcements**: post to TEST Rose only | Saved | ☐ |
| 7.6 | Try to open a section they don't teach (change the URL/id) | Not shown / refused | ☐ |

---

## 8. Grading

### 8a. Elementary (TEST Rose, TEST Science, Q1)

| # | Do | Expected | Pass |
|---|---|---|---|
| 8.1 | **Gradebook → Elementary** → TEST Rose → TEST Science → Q1 | Lists A and B | ☐ |
| 8.2 | Add activities: Quiz 1 (WW, 20), Project (PT, 50), Exam (QA, 100) | Columns appear | ☐ |
| 8.3 | Scores A: 18 / 45 / 90. B: 10 / blank / 60 | Blank = not entered yet | ☐ |
| 8.4 | Type 25 on Quiz 1 (max 20) | Refused | ☐ |
| 8.5 | **Save scores** | Saved as draft; not on report card yet | ☐ |
| 8.6 | **Publish grades** | Q1 grades published | ☐ |
| 8.7 | Change B's Project to 30 | "Changes not published" shows | ☐ |
| 8.8 | Publish again | Message gone | ☐ |
| 8.9 | Q2: **copy** last period's activities | Same activities, empty scores | ☐ |

### 8b. Senior High (Grade 11 – TEST Arts, TEST Drawing)

| # | Do | Expected | Pass |
|---|---|---|---|
| 8.10 | Gradebook → Senior High → TEST Arts → TEST Drawing | Only Q3 and Q4 (2nd semester) | ☐ |
| 8.11 | Add scores in Q3 for D, publish | Published | ☐ |

### 8c. Kinder (sample Kinder section)

| # | Do | Expected | Pass |
|---|---|---|---|
| 8.12 | Gradebook → Kinder → section → a learning area → Q1 | Checklist with B / D / C, no scores | ☐ |
| 8.13 | Rate each child, **Publish ratings** | Published | ☐ |

### 8d. College (TBSX 1-A, TEST Programming 1)

| # | Do | Expected | Pass |
|---|---|---|---|
| 8.14 | Gradebook → College → TBSX 1-A → TEST Programming 1 | Periods Prelim / Midterm / Finals | ☐ |
| 8.15 | Enter C: Prelim 90, Midterm 85, Finals 80; publish each | Final ≈ 85% → 1.x–2.x grade, Passed | ☐ |
| 8.16 | On a sample College student, set **INC** on Finals | Shows INC; not counted in GWA | ☐ |
| 8.17 | Irregular: open a sample College student → **Subject load** → Drop a block subject, **Add** TEST Programming 1 | Saved | ☐ |
| 8.18 | As TEST Teacher, open TEST Programming 1 gradebook | That student appears, marked "Irregular" | ☐ |

---

## 9. Report cards and reports

| # | Do | Expected | Pass |
|---|---|---|---|
| 9.1 | Sign in as TEST Student A's login → **Report Card** | Only **published** grades; this year's attendance (1 absent) | ☐ |
| 9.2 | Try to view another student's report (change URL/id) | Refused | ☐ |
| 9.3 | Sign in as TEST Parent → children | Only TEST Student A; announcement from 7.5 shows | ☐ |
| 9.4 | Print → Save as PDF | Clean, readable PDF | ☐ |
| 9.5 | Student D (SHS) report card | One table per semester, each with general average | ☐ |
| 9.6 | Kinder report card | B / D / C per quarter, no average | ☐ |
| 9.7 | Student C (College) report card | Units, final %, grade, remark, GWA per semester | ☐ |
| 9.8 | Irregular student's report card | Follows their load (dropped subject gone, added subject shown) | ☐ |
| 9.9 | Choose the past year 2025–2026 (if added) | Read-only report shows | ☐ |
| 9.10 | Staff → **Reports**: attendance summary, class list, class grades for Q1 | Correct; **Export CSV** and **Print** work | ☐ |

---

## 10. Transfer

| # | Do | Expected | Pass |
|---|---|---|---|
| 10.1 | TEST Student B → **Transfer** to another Grade 5 section, today, reason "TEST" | Moved; enrolment history shows both sections with dates | ☐ |
| 10.2 | Check B's Q1 grades and attendance | Still there under the old section | ☐ |
| 10.3 | Transfer the irregular College student | Their add/drop load is cleared | ☐ |

---

## 11. Permissions and security

| # | Do | Expected | Pass |
|---|---|---|---|
| 11.1 | As Student, open `/students`, `/users`, `/grades` by URL | Sent back to their dashboard | ☐ |
| 11.2 | As Teacher, change a grade in a subject they don't teach | Refused | ☐ |
| 11.3 | As School Admin, open School Setup | View only | ☐ |
| 11.4 | Super Admin → **Roles & Permissions**: give Teacher no Reports access | Teacher loses the Reports menu and URL | ☐ |
| 11.5 | Try to remove the Super Admin's own full access | Not allowed | ☐ |
| 11.6 | Put the Reports access back | Restored | ☐ |
| 11.7 | Sign out, press Back in the browser | No private data shown; must sign in | ☐ |

---

## 12. Backup and closing the year

| # | Do | Expected | Pass |
|---|---|---|---|
| 12.1 | Super Admin → **Backup & Restore** → Download | Backup file downloads | ☐ |
| 12.2 | **School Setup → Start new school year**, tick **Move every student up one grade** | New year open | ☐ |
| 12.3 | Check TEST Student A | Now Grade 6, same section name if it exists | ☐ |
| 12.4 | Check a student who was in the last grade / last College year | Graduated | ☐ |
| 12.5 | Sections, teaching assignments, timetables | Copied to the new year | ☐ |
| 12.6 | Try to edit a grade from the closed year | Refused (read-only) | ☐ |
| 12.7 | Report card → previous year | Old grades still show | ☐ |
| 12.8 | **Restore** the backup from 12.1 | Data back to before the rollover | ☐ |
| 12.9 | `npm run db:audit` | Clean | ☐ |

---

## 13. Clean up

| # | Do | Expected | Pass |
|---|---|---|---|
| 13.1 | Reset the copy: `npm run db:seed -- --reset` (copy DB only) | Back to demo data | ☐ |
| 13.2 | Set `.env` back to the database you normally use | — | ☐ |

---

## Result

| Area | Passed | Failed | Notes |
|---|---|---|---|
| 1 Create users / Sign-in | | | |
| 2 Levels | | | |
| 3 School Setup | | | |
| 4 Subjects / Sections / Teachers | | | |
| 5 Students / Users | | | |
| 6 Timetable | | | |
| 7 Daily work | | | |
| 8 Grading | | | |
| 9 Report cards / Reports | | | |
| 10 Transfer | | | |
| 11 Permissions | | | |
| 12 Backup / New year | | | |

Tested by: ________  Date: ________  Build / commit: ________
