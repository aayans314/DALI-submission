# Demo data and test scenarios

The seed (`npm run db:reset -- --yes` in `server/`) creates four shelters, 34 sheltered people, and the accounts below. The data is deliberately messy so that matching, duplicates, and privacy rules all get exercised. Every account uses the password `demo1234`.

## Accounts

| Who | Login | Role |
|---|---|---|
| Carol Mendes | `lincoln.authority@demo.org` | Authority, Lincoln High School Gym |
| Ben Ortiz, Aisha Bello | `lincoln.vol1@demo.org`, `lincoln.vol2@demo.org` | Volunteers, Lincoln |
| Frank Liu | `riverside.authority@demo.org` | Authority, Riverside Community Center |
| Megan Doyle, Sam Patel | `riverside.vol1@demo.org`, `riverside.vol2@demo.org` | Volunteers, Riverside |
| Tom Reilly | `stbrendan.authority@demo.org` | Authority, St. Brendan's Parish Hall |
| Rosa Alvarez | `stbrendan.vol1@demo.org` | Volunteer, St. Brendan's |
| Janet Ward | `fairgrounds.authority@demo.org` | Authority, County Fairgrounds (medical) |
| Luis Romero, Kim Nguyen | `fairgrounds.vol1@demo.org`, `fairgrounds.vol2@demo.org` | Volunteers, Fairgrounds |
| Elena Ramirez | `elena@demo.org` | Public user |
| Kevin O'Neill | `kevin@demo.org` | Public user |
| Priya Shah | `priya@demo.org` | Public user |
| Travis Whitfield | `travis@demo.org` | Public user |
| Tom Becker | `tom@demo.org` | Public user |

## Scenarios

**1. Child bused from school (minor match).** Lucas was registered at Lincoln with a typo, "Lucas Ramires". Log in as Elena and search for "Lucas Ramirez" and "Luke", age 8 to 10. Expected: a match goes to a Lincoln volunteer, then to the Lincoln authority before anything is shared, because he is a minor.

**2. Elderly parent moved by another agency (duplicate + transfer).** Margaret O'Neill went from Seabreeze Nursing Home to Riverside, then was transferred to the Fairgrounds. The Fairgrounds night shift also registered her as "Peggy Oneil". Log in as Kevin and search for "Margaret O'Neill", "Peggy", and "Maggie", age 78 to 82. Expected: both records come up as candidates, and a duplicate check flags the pair for merging.

**3. Spouse rescued two days later (volunteer files for someone without a phone).** Grace Okafor is at Lincoln with no phone. Her husband David was rescued by boat and is at St. Brendan's. Log in as a Lincoln volunteer and file a search on Grace's behalf for "David Okafor" and "Dave". Expected: a St. Brendan's volunteer is asked to confirm with David, and both shelters can coordinate once he agrees.

**4. Someone who doesn't want to be found.** Dana Whitfield at Riverside is marked do-not-disclose. Log in as Travis and search for "Dana Whitfield". Expected: the match is declined automatically and Travis only ever sees "no confirmed match yet", exactly like a search with no results.

**5. Typo plus nickname.** Rajesh Shah was registered as "Raj Sha". Log in as Priya and search for "Rajesh Shah" and "Raj Shah", age 25 to 30. Expected: a match through the nickname table and fuzzy matching.

**6. Nobody matches.** Log in as Tom and search for "Eleanor Becker". Expected: "no confirmed match yet", with the search kept open in case she is registered later.

**7. Duplicates the check should find.** "Jonathan Pierce" (Riverside) and "Jon Peirce" (St. Brendan's) are the same man: he walked between shelters and was registered twice. "JOSE HERNANDEZ" and "José Hernández" at the Fairgrounds are the same man, entered once from paper and once by hand.

**8. A duplicate the check should *not* find.** There are two different men named "Michael Johnson": one aged 22 to 25 at Lincoln, one aged 60 to 65 at St. Brendan's. The age ranges don't overlap, so they must not be flagged.

**9. Hard records.** Some records are deliberately incomplete. "Unknown" at the Fairgrounds has no name, only an age range and a description. "Maria" at St. Brendan's gave a first name only, and her two children are registered as accompanied minors. "Samuel Ortiz" at Lincoln declined to give an age. Harold Kim moved twice and then left the shelter system.
