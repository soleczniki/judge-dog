# Judges LinkedIn — Product Concept

## The Idea

Dog show judges have no standard digital home. Their FCI page is a data record, not a presence. Most have no website. When they judge a show, exhibitors leave with no way to find them, follow them, or read their critique.

**Judges LinkedIn** turns judge.dog into a platform where judges own and publish their professional identity — credentials, critiques, and contact — all on one shareable page. The QR code makes it physical: scan it at ringside, land on the judge's page.

---

## Who It's For

| Audience | What they get |
|---|---|
| **Judges** | A professional page they control, a place to publish critiques, visibility to organizers looking to book them |
| **Exhibitors** | Find their dog's critique after a show, know what a judge values before entering |
| **Show organizers** | Search and evaluate judges by specialty, credentials, and critique history before booking |

---

## Core Features

### 1. Judge Profile Page
Each judge gets a clean, public page at a readable URL:

```
judge.dog/tapio-eerola
judge.dog/annika-ulltveit-moe
```

The page shows:
- Photo, name, country, credentials (pre-populated from FCI data)
- Bio written by the judge — their philosophy, what they look for
- Breeds and groups authorized
- Languages spoken
- Show history (self-reported or auto-imported)
- Critiques they've published
- Reviews from exhibitors (current feature)
- Booking contact / availability (future)

### 2. Critique Publishing
Judges can write and publish critiques directly on their page, structured by show.

Each critique entry has:
- Show name + date + location
- Breed + class
- Placement (1st, BOB, BIS, etc.)
- The written critique text

Exhibitors can search: "find my critique" by kennel name, breed, or show. The judge.dog/tapio-eerola page becomes a living archive of their judging output — the way a journalist has a byline archive.

This mirrors sites like kcjudgescritiques.org.uk but judge-owned, not club-managed.

### 3. QR Code
Every claimed profile gets a unique QR code linking to their page. Judges can:
- Print it on their ring card
- Add it to their business card
- Display it on a sign at ringside after judging

Exhibitors scan it immediately after the ring — the impression is fresh, the motivation to leave a review or find a critique is highest at that moment.

### 4. Claim & Verification
A judge claims their page by verifying their FCI licence number (flow already partially built). Once claimed:
- They choose their URL slug (defaulting to their name)
- They can edit their bio, photo, social links
- They unlock critique publishing and QR code download

Unclaimed profiles still exist (auto-populated from FCI) but show a "Not yet claimed" badge.

---

## URL Identity

**Claimed profiles** — chosen by the judge:
```
judge.dog/tapio-eerola
judge.dog/t-eerola          ← if collision
```

**Unclaimed profiles** — fallback to FCI ID:
```
judge.dog/judge/fci_1       ← current format, stays as redirect
```

When a judge claims and sets their slug, the old `/judge/fci_1` URL redirects permanently.

---

## How Critiques Work in Practice

**The judge's flow:**
1. After a show, log in
2. Click "Add critiques for [Show name]"
3. For each class: select breed, enter placements, write critique text
4. Publish — immediately live on their page

**The exhibitor's flow:**
1. Scan QR at the show (or search on judge.dog later)
2. Land on the judge's page
3. Click "Find my critique" → search by show name or breed
4. Read the critique for their dog
5. Optionally: leave a review of the judge

---

## Phased Build

### Phase 1 — Profile ownership (now)
- Claim flow with verification *(partially built)*
- Custom URL slug
- Bio + photo upload
- QR code generator (static, links to profile)

### Phase 2 — Critiques
- Critique editor (rich text, per show/breed/class)
- Show archive on profile
- Search within a judge's critiques

### Phase 3 — Discovery
- Organizer search: find judges by breed, country, availability
- "Available to judge" toggle on profile
- Contact/booking request (already prototyped)

### Phase 4 — Network
- Judges follow each other
- Show results feed
- Announcements ("I'm judging at X show on Y date")

---

## What Makes This Different

| | FCI website | Club critique archives | judge.dog |
|---|---|---|---|
| Judge controls content | ✗ | ✗ | ✓ |
| Public critiques | ✗ | ✓ | ✓ |
| Exhibitor reviews | ✗ | ✗ | ✓ |
| QR / shareable link | ✗ | ✗ | ✓ |
| Booking contact | ✗ | ✗ | ✓ |
| Works across all orgs | FCI only | UK only | All |

---

## Open Questions

- **Critique format**: free text only, or structured fields (movement, type, coat, etc.)?
- **Language**: do critiques publish in the judge's language or require English?
- **Moderation**: can a judge delete a review left on their profile? (Probably not — that's the review platform's integrity.)
- **Pricing**: free for claimed profiles, premium for QR + critique publishing + analytics?
- **Domain**: does `judge.dog/@tapio-eerola` feel better than `judge.dog/tapio-eerola`?
