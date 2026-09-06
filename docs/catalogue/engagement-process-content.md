---
title: Engagement Process — Web Copy Source
purpose: Public-facing content source for a "How We Work" / "Getting Started" page on mustaphaukizuru.com. Rewritten from the internal Client Engagement Guide (Client Engagement Documents/01 Client Engagement Guide.pdf) for a prospect audience — shorter, no internal ops detail, no legal language.
status: ported — this is the authored source; the site renders it from web/src/data/servicesCatalogue.js
ported: 2026-09-04 (T2-9). HOW_IT_WORKS_DETAILED, SUBMIT_BY_STAGE, DELIVERY_MODALITY and ACCESS_PRIVACY in web/src/data/servicesCatalogue.js; rendered at /how-we-work and /es/how-we-work; framing strings under `process.*` in services.json; also printed into the downloadable catalogue. Spanish was authored in the tu register (ADR 0004), not translated. Edit the data, not this file, for anything the site shows.
last_updated: 2026-09-04
---

# How We Work

Six steps from first message to handover, whether the engagement is a two-day audit or a multi-month build.

## 1. Submit a Request

**How:** the contact form on the Services page, email to hello@mustaphaukizuru.com, or WhatsApp.
**When:** any time — response within 1 business day.
**What to include:** which offering or category you're interested in, a one-paragraph description of the problem or goal, and your organization type (business, school, individual). No technical detail required at this stage — that's what the discovery call is for.

## 2. Discovery Call

A 30-minute video call (Google Meet, Zoom, or Teams) to confirm scope, constraints, and timeline. No cost, no obligation. Ends with a clear next step: either a written proposal follows, or — if the request is out of scope — a referral or honest no.

## 3. Written Proposal

Delivered within 3 business days of the discovery call. Every proposal states: exact scope and deliverables, price in USD and MXN, payment schedule, estimated timeline, and delivery modality (remote or on-site — see below). Proposals are valid for 14 days.

## 4. Agreement and Deposit

Once the proposal is accepted: a short service agreement is signed, and the deposit specified in the proposal is paid before work is scheduled. This is also when any NDA is put in place, ahead of the technical access step that follows.

## 5. Kickoff and Access

A kickoff call is scheduled within 5 business days of the deposit clearing. Any system access needed (hosting, cloud console, repository, business accounts) is granted at this point, following the least-privilege principle — scoped, named-collaborator access rather than shared passwords wherever the platform supports it. See **Access & Data Privacy** below.

## 6. Delivery

Work proceeds against the agreed timeline with a weekly status update (async, or a short sync call for larger engagements). Feedback on delivered work within 2 business days keeps the schedule on track — this is the single biggest factor in whether a project lands on time. The engagement closes with a formal handover: documentation, credentials transferred or revoked as agreed, and a 30-day support window on the delivered work.

---

# What to Submit, By Stage

| Stage | What's needed |
|---|---|
| Initial request | Offering of interest, problem description, organization type |
| Discovery call | Whoever will make the final decision on scope and budget |
| Proposal acceptance | Legal/trade name, billing contact, tax ID (RFC) if a CFDI invoice is needed, signing authority |
| Agreement and deposit | Signature, deposit payment |
| Kickoff | Primary contact, technical contact (if different), confirmed modality, any brand assets or existing documentation relevant to the work |
| During delivery | Timely feedback, a reachable decision-maker |

*(Full field-by-field version: Client Onboarding Checklist, available to clients at proposal stage.)*

---

# Delivery Modality

**Remote by default.** Every offering across all four service categories — IT Strategy Consulting, AI Integration & Workflow Automation, Cloud Architecture & Migration, Digital Product Engineering — is delivered fully online via video call, screen-share, and shared documentation. This is the default for good reason: it's faster to schedule, leaves a written record, and costs less.

**On-site, where the work requires physical access.** Two situations call for a visit rather than a call:
- **On-Premise to Cloud Migration** and **Zero-Trust Security Hardening** — when the work involves physical network hardware (routers, switches, on-site servers) that can't be assessed or reconfigured remotely.
- **School clients** with physical needs — device fleet setup, smart-classroom installation, in-person staff training — where the value is in being in the room.

On-site work is scoped and priced separately in the proposal; it's never assumed.

---

# Access & Data Privacy

Trust is earned before access is granted, not after:

- **Least privilege.** Named-collaborator invites (a GitHub collaborator role, a scoped GCP/AWS IAM role, a Google Workspace admin role) are the default — never a shared root login. Where a platform has no scoped-role option, a password-manager shared vault is used instead of a plain-text credential.
- **NDA first.** A mutual non-disclosure agreement is signed before any credential or system access is granted, whatever the engagement size.
- **Reviewed and revoked.** Access is reviewed at project handover and revoked unless the engagement continues as an active retainer.
- **LFPDPPP compliance.** Personal data handled during an engagement is processed under Mexico's Federal Law on Protection of Personal Data Held by Private Parties. Full privacy policy: mustaphaukizuru.com/privacy.
- **AI sub-processor disclosure.** For AI Integration & Workflow Automation work, any third-party AI model or API used to process client data is named in the proposal before work begins — no undisclosed sub-processors.

---

# Where it ended up

- `/how-we-work` and `/es/how-we-work` (`web/src/pages/HowWeWorkPage.jsx`) — all four sections.
- The three-step summary on `/services` and every category page is now **derived** from the six steps by id, so the short and long versions cannot drift.
- One FAQ entry, "What happens after I send a request?", first in `funnel.faq.items`, which the FAQPage schema picks up.
- `HowTo` structured data built from the same six steps (`web/src/seo/schemas/howToSchema.js`).
- The downloadable catalogue prints the six steps, the submission table, the modality and the access rules.
- Footer quick links, the sitemap with hreflang, and the server-side OG card map.
