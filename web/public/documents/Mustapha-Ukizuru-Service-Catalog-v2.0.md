# Mustapha Ukizuru — Service Catalog

**Brand:** Technology Consulting · Digital Products · STEM and School Solutions
**Owner:** Mustapha Ukizuru
**Domain:** mustaphaukizuru.com
**Version:** 2.0
**Effective Date:** September 04, 2026
**Review Cycle:** Quarterly
**Status:** Production-ready

---

## PART I — GOVERNANCE

### 1. Catalog Scope and Purpose

This catalog defines the complete set of professional services offered under the Mustapha Ukizuru brand. It is the single source of truth for what is sold, how it is sold, who it is sold to, and how it is delivered. The catalog supports four operational uses: customer-facing marketing on mustaphaukizuru.com, sales conversations and proposals, internal delivery planning, and quarterly portfolio governance. The catalog is generated directly from the production codebase (`src/data/servicesCatalogue.js`) so it can never drift from what the website actually offers.

### 2. Catalog Architecture

The catalog is organized in three layers, top-down:

- **Categories** — 4 service lines, each with an independent outcome promise and its own page at `/services/<slug>`.
- **Offerings** — 20 atomic, independently sellable services within the categories.
- **Deliverables** — the specific outputs produced within each offering.

Audience-level all-in Packages (recurring monthly plans, not project offerings) are documented separately in Part IV.

### 3. Naming Conventions

**Offering identifier schema:** `UKZ-{CCC}-{NNN}`

- `UKZ` — brand prefix (Mustapha Ukizuru)
- `CCC` — three-letter category code
- `NNN` — three-digit sequential offering number within the category

**Category codes:**

| Code | Category | URL slug |
|------|----------|----------|
| ITS | IT Strategy Consulting | `/services/it-strategy-consulting` |
| AIA | AI Integration & Workflow Automation | `/services/ai-automation` |
| CAM | Cloud Architecture & Infrastructure Migration | `/services/cloud-architecture-migration` |
| DPE | End-to-End Digital Product Engineering | `/services/digital-product-engineering` |

Each offering also carries a URL-safe slug, addressable as `/services/<category-slug>#<offering-slug>` and bookable at `/book?service=<offering-slug>`.

### 4. Metadata Schema

Every offering record contains the following fields:

| Field | Description |
|-------|-------------|
| ID | UKZ-{CCC}-{NNN} unique identifier |
| Name | Offering name |
| Outcome | One-sentence value statement |
| Audience | Target segment(s): SMB, EDU, IND, or combinations |
| Engagement | Audit, Retainer, Engagement, Roadmap, Build, Integration, Migration, Implementation, or Sprint |
| Duration | Typical delivery timeframe |
| Pricing model | Fixed, From quote, or Retainer |
| Tier | 1 (Flagship) or 2 (Standard) |
| Deliverables | Specific outputs produced |

### 5. Audience Codes

| Code | Segment | Priority |
|------|---------|----------|
| SMB | SMEs & Businesses | Primary |
| EDU | Schools & Education | Secondary |
| IND | Individuals & Pros | Inbound |

EDU has a dedicated audience page at `/schools`, composed from the offerings below — it is not a fifth category.

### 6. Service Tiers

| Tier | Definition |
|------|------------|
| 1 | Flagship — Featured offering |
| 2 | Standard — Actively sold |

### 7. Engagement Types

Audit · Retainer · Engagement · Roadmap · Build · Integration · Migration · Implementation · Sprint

### 8. Lifecycle

All offerings listed in this document are **Active**. Version 2.0 retires the earlier six-category, 82-SKU taxonomy (Catalog v1.0, 29 April 2026) in full — see Appendix B.

---

## PART II — CATALOG INDEX

### 9. Master Index by Category

#### IT Strategy Consulting (ITS) — 5 offerings

Independent senior advice on what to keep, what to cut, and what to build next.

| ID | Offering | Tier | Audience | Starting price |
|----|----------|------|----------|----------------|
| UKZ-ITS-001 | Software Stack Audit | 2 | SMB, EDU | $750 USD · MX$15,000 |
| UKZ-ITS-002 | Fractional CTO Engagement | 1 | SMB | From $775 USD · MX$15,500/month |
| UKZ-ITS-003 | Vendor Evaluation & RFP | 2 | SMB, EDU | From $900 USD · MX$18,000 |
| UKZ-ITS-004 | Digital Transformation Roadmap | 1 | SMB, EDU | From $950 USD · MX$19,000 |
| UKZ-ITS-005 | Compliance & Risk Assessment | 2 | SMB, EDU | $750 USD · MX$15,000 |

#### AI Integration & Workflow Automation (AIA) — 4 offerings

Assistants, agents and pipelines that remove repetitive work from your team's week.

| ID | Offering | Tier | Audience | Starting price |
|----|----------|------|----------|----------------|
| UKZ-AIA-001 | Custom AI Assistants & WhatsApp Bots | 1 | SMB, IND | From $950 USD · MX$19,000 |
| UKZ-AIA-003 | Cross-Platform API Pipelines | 2 | SMB, IND | From $300 USD · MX$6,000 |
| UKZ-AIA-004 | Internal RAG Knowledge Base | 1 | SMB, EDU | From $1,925 USD · MX$38,500 |
| UKZ-AIA-005 | Data Extraction Workflows | 2 | SMB | From $950 USD · MX$19,000 |

#### Cloud Architecture & Infrastructure Migration (CAM) — 5 offerings

Move to the cloud safely, pay less for it, and survive the bad day.

| ID | Offering | Tier | Audience | Starting price |
|----|----------|------|----------|----------------|
| UKZ-CAM-001 | On-Premise to Cloud Migration | 1 | SMB, EDU | From $2,875 USD · MX$57,500 |
| UKZ-CAM-002 | Cloud Bill Optimisation | 2 | SMB | $450 USD · MX$9,000 |
| UKZ-CAM-003 | Disaster Recovery Planning | 2 | SMB, EDU | From $725 USD · MX$14,500 |
| UKZ-CAM-004 | Docker & Containerisation | 2 | SMB | From $725 USD · MX$14,500 |
| UKZ-CAM-005 | Zero-Trust Security Hardening | 2 | SMB, EDU | From $1,075 USD · MX$21,500 |

#### End-to-End Digital Product Engineering (DPE) — 6 offerings

From clickable prototype to shipped product, with the pipeline and maintenance to keep it running.

| ID | Offering | Tier | Audience | Starting price |
|----|----------|------|----------|----------------|
| UKZ-DPE-001 | Interactive UI/UX Wireframing | 2 | SMB, IND | $900 USD · MX$18,000 |
| UKZ-DPE-002 | MVP Web App Development | 1 | SMB, IND | From $1,925 USD · MX$38,500 |
| UKZ-DPE-003 | Cross-Platform Mobile Apps | 2 | SMB | From $2,875 USD · MX$57,500 |
| UKZ-DPE-004 | Secure API Design | 2 | SMB | From $950 USD · MX$19,000 |
| UKZ-DPE-005 | CI/CD Pipeline Automation | 2 | SMB | From $350 USD · MX$7,000 |
| UKZ-DPE-006 | Managed Maintenance | 2 | SMB, IND | From $250 USD · MX$5,000/month |

### 10. Index by Audience

**SMEs & Businesses (SMB)** — 20 offerings: UKZ-ITS-001, UKZ-ITS-002, UKZ-ITS-003, UKZ-ITS-004, UKZ-ITS-005, UKZ-AIA-001, UKZ-AIA-003, UKZ-AIA-004, UKZ-AIA-005, UKZ-CAM-001, UKZ-CAM-002, UKZ-CAM-003, UKZ-CAM-004, UKZ-CAM-005, UKZ-DPE-001, UKZ-DPE-002, UKZ-DPE-003, UKZ-DPE-004, UKZ-DPE-005, UKZ-DPE-006

**Schools & Education (EDU)** — 8 offerings: UKZ-ITS-001, UKZ-ITS-003, UKZ-ITS-004, UKZ-ITS-005, UKZ-AIA-004, UKZ-CAM-001, UKZ-CAM-003, UKZ-CAM-005

**Individuals & Pros (IND)** — 5 offerings: UKZ-AIA-001, UKZ-AIA-003, UKZ-DPE-001, UKZ-DPE-002, UKZ-DPE-006

### 11. Index by Engagement Type

**Audit** — UKZ-ITS-001, UKZ-ITS-005, UKZ-CAM-002

**Retainer** — UKZ-ITS-002, UKZ-DPE-006

**Engagement** — UKZ-ITS-003

**Roadmap** — UKZ-ITS-004

**Build** — UKZ-AIA-001, UKZ-AIA-004, UKZ-AIA-005, UKZ-DPE-002, UKZ-DPE-003, UKZ-DPE-004

**Integration** — UKZ-AIA-003

**Migration** — UKZ-CAM-001

**Implementation** — UKZ-CAM-003, UKZ-CAM-004, UKZ-CAM-005, UKZ-DPE-005

**Sprint** — UKZ-DPE-001

### 12. Flagship Offerings (Tier 1)

- **UKZ-ITS-002 · Fractional CTO Engagement** — Part-time technical leadership: roadmaps and hiring guidance.
- **UKZ-ITS-004 · Digital Transformation Roadmap** — Step-by-step migrations from paper and spreadsheets to automated platforms.
- **UKZ-AIA-001 · Custom AI Assistants & WhatsApp Bots** — LLM assistants trained on your brand voice and documents, deployed on WhatsApp Business, your website, or both — from answering FAQs to qualifying and routing every new lead.
- **UKZ-AIA-004 · Internal RAG Knowledge Base** — Private corporate search engines built on vector databases (Pinecone).
- **UKZ-CAM-001 · On-Premise to Cloud Migration** — Safely move physical office servers to AWS, Azure or GCP.
- **UKZ-DPE-002 · MVP Web App Development** — Fast, working minimum viable products built on modern ecosystems.

---

## PART III — OFFERING DETAIL

### 13. Category ITS — IT Strategy Consulting

Cut wasted software spend and get a clear, sequenced technology roadmap your team can execute.

---

**UKZ-ITS-001 · Software Stack Audit**
*Tier 2 · Audit · $750 USD · MX$15,000 · 2–3 weeks · SMB, EDU*
**Outcome:** Review of existing licences to eliminate duplicate subscriptions and cut waste.
**Includes:** Licence and subscription inventory · Duplicate / unused tooling report · Savings estimate · Consolidation plan.
**Often built together with:** Digital Transformation Roadmap, Cloud Bill Optimisation.

**UKZ-ITS-002 · Fractional CTO Engagement**
*Tier 1 · Retainer · From $775 USD · MX$15,500/month · Ongoing · 3-month minimum · SMB*
**Outcome:** Part-time technical leadership: roadmaps and hiring guidance.
**Includes:** Weekly leadership cadence · Technology roadmap ownership · Hiring rubrics and interviews · Vendor and architecture decisions.
**At the starting price:** Covers a light-advisory cadence: weekly leadership sync, roadmap ownership, and vendor/architecture decisions for one product line, up to about 6 hours a week. Billed monthly in advance, 3-month minimum, then cancel with 30 days' notice.
**Price increases with:** More hours per week (10–20h, standard leadership cadence) · More than one product line or team · Hands-on hiring panels beyond rubric design · On-site days in CDMX or Estado de México.
**Often built together with:** Digital Transformation Roadmap, Vendor Evaluation & RFP.

**UKZ-ITS-003 · Vendor Evaluation & RFP**
*Tier 2 · Engagement · From $900 USD · MX$18,000 · 3–6 weeks · SMB, EDU*
**Outcome:** Independent expert review of third-party software offers for fairness.
**Includes:** Requirements definition · RFP drafting and management · Comparison matrix · Contract review and recommendation.
**At the starting price:** Covers one RFP cycle for a single software category: requirements definition, a shortlist of up to five vendors, one comparison matrix, and a recommendation.
**Price increases with:** More than five vendors shortlisted · Multiple software categories evaluated in parallel · Live demo coordination and reference calls · Contract negotiation support beyond the written review.
**Often built together with:** Software Stack Audit, Digital Transformation Roadmap.

**UKZ-ITS-004 · Digital Transformation Roadmap**
*Tier 1 · Roadmap · From $950 USD · MX$19,000 · 4–6 weeks · SMB, EDU*
**Outcome:** Step-by-step migrations from paper and spreadsheets to automated platforms.
**Includes:** Process and systems audit · Prioritised opportunity matrix · 12-month sequenced roadmap · Budget and change-management plan.
**At the starting price:** Covers the audit and twelve-month roadmap for one department or campus, one stakeholder workshop, and the written plan.
**Price increases with:** Multi-department or multi-campus scope · Additional stakeholder workshops · A detailed change-management or training-rollout plan · Budget modelling across multiple vendor scenarios.
**Often built together with:** Software Stack Audit, Fractional CTO Engagement, MVP Web App Development, On-Premise to Cloud Migration.

**UKZ-ITS-005 · Compliance & Risk Assessment**
*Tier 2 · Audit · $750 USD · MX$15,000 · 2–3 weeks · SMB, EDU*
**Outcome:** Architecture audit to comply with Mexican privacy law (LFPDPPP).
**Includes:** Data inventory and flow map · LFPDPPP gap analysis · Risk register · Remediation roadmap.
**Often built together with:** Zero-Trust Security Hardening, Internal RAG Knowledge Base.

### 14. Category AIA — AI Integration & Workflow Automation

Answer customers faster, sync leads automatically, and turn documents into clean data without adding headcount.

---

**UKZ-AIA-001 · Custom AI Assistants & WhatsApp Bots**
*Tier 1 · Build · From $950 USD · MX$19,000 · 2–4 weeks · SMB, IND*
**Outcome:** LLM assistants trained on your brand voice and documents, deployed on WhatsApp Business, your website, or both — from answering FAQs to qualifying and routing every new lead.
**Includes:** WhatsApp Business API setup · Voice and tone guide ingestion · Assistant with guardrails · Qualification flow and CRM sync (HubSpot, Zoho or sheet) · Web, WhatsApp, or in-app chat deployment · Evaluation set, monitoring, and handover to a human.
**At the starting price:** One assistant on one primary channel (WhatsApp Business or web chat), trained on the documents you provide, with guardrails and CRM sync to one system (HubSpot, Zoho, or a sheet).
**Price increases with:** Deploying on more than one channel at once (web + WhatsApp + app) · Syncing to more than one CRM or data source · Custom escalation and handoff workflows · Multilingual response sets · High message-volume infrastructure.
**Often built together with:** Cross-Platform API Pipelines, Managed Maintenance.

**UKZ-AIA-003 · Cross-Platform API Pipelines**
*Tier 2 · Integration · From $300 USD · MX$6,000 · 1–3 weeks · SMB, IND*
**Outcome:** Connect disconnected tools (e.g. payments, Slack, email) with Make or Zapier.
**Includes:** Integration map · Make / Zapier scenarios · Error handling and alerts · Runbook.
**At the starting price:** Covers one integration path between two tools (for example, payments to Slack), built in Make or Zapier, with basic error alerts.
**Price increases with:** Each additional tool or integration path · Custom code instead of Make/Zapier scenarios · High-volume or real-time processing needs · Separate staging and production environments.
**Often built together with:** MVP Web App Development, Custom AI Assistants & WhatsApp Bots, Data Extraction Workflows.

**UKZ-AIA-004 · Internal RAG Knowledge Base**
*Tier 1 · Build · From $1,925 USD · MX$38,500 · 4–8 weeks · SMB, EDU*
**Outcome:** Private corporate search engines built on vector databases (Pinecone).
**Includes:** Document ingestion pipeline · Vector index (Pinecone) · Search / chat interface with citations · Access control.
**At the starting price:** Covers ingestion of one document set, a Pinecone vector index, and a search/chat interface with citations for one team.
**Price increases with:** Multiple document sets or data sources · Role-based access control across teams · A custom interface beyond the standard chat UI · An ongoing re-indexing pipeline for frequently changing documents.
**Often built together with:** Zero-Trust Security Hardening, Compliance & Risk Assessment.

**UKZ-AIA-005 · Data Extraction Workflows**
*Tier 2 · Build · From $950 USD · MX$19,000 · 2–4 weeks · SMB*
**Outcome:** Tools that parse PDFs, invoices or forms into clean spreadsheets.
**Includes:** Document classifier · Field extraction with validation · Spreadsheet / database output · Exception review queue.
**At the starting price:** Covers one document type (for example, invoices), with field extraction, validation, and a single spreadsheet or database output.
**Price increases with:** Additional document types or formats · Higher accuracy or validation requirements needing human-in-the-loop review · Direct write-back to an ERP or accounting system instead of a spreadsheet · High monthly document volume.
**Often built together with:** Cross-Platform API Pipelines, Managed Maintenance.

### 15. Category CAM — Cloud Architecture & Infrastructure Migration

Retire the office server, pay only for the cloud capacity you use, and know your backups actually restore.

---

**UKZ-CAM-001 · On-Premise to Cloud Migration**
*Tier 1 · Migration · From $2,875 USD · MX$57,500 · 6–12 weeks · SMB, EDU*
**Outcome:** Safely move physical office servers to AWS, Azure or GCP.
**Includes:** Migration assessment · Landing zone (VPC, IAM) · Workload migration and cutover · Post-migration support.
**At the starting price:** Covers migration of one office server or workload to a single cloud provider, with a landing zone and one rehearsed cutover.
**Price increases with:** Multiple servers or workloads migrated together · Multi-region or multi-cloud architecture · Legacy application refactoring beyond a lift-and-shift · An extended post-migration support window.
**Often built together with:** Disaster Recovery Planning, Zero-Trust Security Hardening, Cloud Bill Optimisation.

**UKZ-CAM-002 · Cloud Bill Optimisation**
*Tier 2 · Audit · $450 USD · MX$9,000 · 1–2 weeks · SMB*
**Outcome:** Audit configurations to right-size servers and remove capacity you pay for but never use.
**Includes:** Billing analysis · Right-sizing recommendations · Reserved / committed-use plan · Savings tracker.
**Often built together with:** On-Premise to Cloud Migration.

**UKZ-CAM-003 · Disaster Recovery Planning**
*Tier 2 · Implementation · From $725 USD · MX$14,500 · 2–4 weeks · SMB, EDU*
**Outcome:** Automated, encrypted backups with failover.
**Includes:** RPO / RTO definition · Encrypted backup automation · Failover configuration · Restore drill and runbook.
**At the starting price:** Covers RPO/RTO definition, encrypted backup automation, and one live restore drill for a single environment.
**Price increases with:** Multiple environments or regions · Sub-hour RTO requirements (hot standby / active-active) · Compliance-driven audit documentation (LFPDPPP or industry-specific) · A recurring quarterly drill program.
**Often built together with:** On-Premise to Cloud Migration, Compliance & Risk Assessment.

**UKZ-CAM-004 · Docker & Containerisation**
*Tier 2 · Implementation · From $725 USD · MX$14,500 · 2–4 weeks · SMB*
**Outcome:** Package legacy applications into containers for fast deployments.
**Includes:** Dockerfiles and compose / orchestration · Environment parity · Registry and deployment flow · Documentation.
**At the starting price:** Covers containerizing one application and its environments, with a basic registry and deployment flow.
**Price increases with:** Multiple applications or microservices · Full orchestration (Kubernetes) instead of single-host Docker Compose · Multi-environment parity (dev/staging/prod) with automated promotion · Legacy application refactoring to containerize cleanly.
**Often built together with:** CI/CD Pipeline Automation, On-Premise to Cloud Migration.

**UKZ-CAM-005 · Zero-Trust Security Hardening**
*Tier 2 · Implementation · From $1,075 USD · MX$21,500 · 3–5 weeks · SMB, EDU*
**Outcome:** Enterprise-grade access controls for remote work.
**Includes:** Identity and MFA rollout · Device and network policies · Least-privilege access review · Security baseline report.
**At the starting price:** Covers identity and MFA rollout and a device/network policy baseline for one office or up to about 50 users.
**Price increases with:** More than about 50 users or devices · Multiple office locations · Custom compliance reporting beyond the baseline report · An ongoing quarterly policy review.
**Often built together with:** On-Premise to Cloud Migration, Compliance & Risk Assessment.

### 16. Category DPE — End-to-End Digital Product Engineering

Validate before you build, ship an MVP in weeks, and keep it patched and improving every month.

---

**UKZ-DPE-001 · Interactive UI/UX Wireframing**
*Tier 2 · Sprint · $900 USD · MX$18,000 · 1–2 weeks · SMB, IND*
**Outcome:** High-fidelity clickable prototypes before writing any backend.
**Includes:** User flows · Clickable Figma prototype · Design tokens · Handoff notes.
**Often built together with:** MVP Web App Development.

**UKZ-DPE-002 · MVP Web App Development**
*Tier 1 · Build · From $1,925 USD · MX$38,500 · 4–10 weeks · SMB, IND*
**Outcome:** Fast, working minimum viable products built on modern ecosystems.
**Includes:** Scoped MVP backlog · Web application (React + API) · Auth and payments if needed · Deployment and 30-day support.
**At the starting price:** Covers a scoped MVP backlog and a working web app (React + API) with core auth, deployed with thirty days of support.
**Price increases with:** Payment processing integration · Third-party integrations beyond authentication · A native mobile companion app · Multi-tenant or multi-role permission systems · An extended support window beyond thirty days.
**Often built together with:** Interactive UI/UX Wireframing, Cross-Platform API Pipelines, CI/CD Pipeline Automation, Managed Maintenance.

**UKZ-DPE-003 · Cross-Platform Mobile Apps**
*Tier 2 · Build · From $2,875 USD · MX$57,500 · 6–12 weeks · SMB*
**Outcome:** A single codebase for iOS and Android.
**Includes:** React Native / Expo app · Store-ready builds · Push notifications and analytics · Release pipeline.
**At the starting price:** Covers one React Native / Expo app with store-ready builds for iOS and Android, push notifications, and a release pipeline.
**Price increases with:** Offline-first or complex local-data sync · Native module work outside Expo's managed workflow · Multiple user roles or white-label variants · App Store / Play Store review handling beyond submission.
**Often built together with:** Cross-Platform API Pipelines, Secure API Design, Managed Maintenance.

**UKZ-DPE-004 · Secure API Design**
*Tier 2 · Build · From $950 USD · MX$19,000 · 2–6 weeks · SMB*
**Outcome:** Fast, well-documented backend APIs that link business applications.
**Includes:** API contract (OpenAPI) · Auth, rate limiting, audit logs · Implementation and tests · Developer documentation.
**At the starting price:** Covers one API contract (OpenAPI), authentication and rate limiting, implementation, and developer documentation.
**Price increases with:** Multiple services or microservices · Complex authorization models (multi-tenant, role hierarchies) · Third-party API consumers requiring versioning or SLAs · Load-testing and performance tuning beyond the baseline.
**Often built together with:** MVP Web App Development, CI/CD Pipeline Automation.

**UKZ-DPE-005 · CI/CD Pipeline Automation**
*Tier 2 · Implementation · From $350 USD · MX$7,000 · 1–3 weeks · SMB*
**Outcome:** Automated, zero-downtime deployment scripts.
**Includes:** Pipeline (GitHub Actions or similar) · Automated tests and checks · Zero-downtime deploy strategy · Rollback procedure.
**At the starting price:** Covers one deployment pipeline (GitHub Actions or similar), automated tests, and a documented rollback procedure.
**Price increases with:** Multiple environments or services in the same pipeline · Blue-green or canary deployment strategies · Infrastructure-as-code setup alongside the pipeline · Multi-repo or monorepo orchestration.
**Often built together with:** MVP Web App Development, Docker & Containerisation.

**UKZ-DPE-006 · Managed Maintenance**
*Tier 2 · Retainer · From $250 USD · MX$5,000/month · Monthly · no minimum term · SMB, IND*
**Outcome:** Recurring monthly support: fixes, patches and feature rollouts.
**Includes:** Bug fixes and security patches · Dependency updates · Feature deployment slots · Monthly report.
**At the starting price:** Covers bug fixes, security patches, and dependency updates for one application, with one feature-deployment slot a month. Billed monthly in advance; cancel with 30 days' notice, no minimum term.
**Price increases with:** Additional feature-deployment slots per month · Multiple applications under the same retainer · A faster response SLA than standard business hours · After-hours, on-call incident coverage.
**Often built together with:** MVP Web App Development, Custom AI Assistants & WhatsApp Bots.

---

## PART IV — PACKAGES & PRICING

### 21. How Pricing Works

Every offering shows an indicative starting price in both US dollars and Mexican pesos, based on a $30 USD/hour minimum rate. Audits and the wireframing sprint are fixed price; bespoke builds, migrations, and retainers show a starting price, confirmed in the written proposal once scope is set.

| Pricing model | What it means |
|----------------|----------------|
| Fixed | Fixed scope, fixed price — confirmed in the written proposal. |
| From quote | Quoted after the discovery call, once scope is confirmed. |
| Retainer | Monthly, billed in advance. Minimum term noted per offering. |

The 20 offerings in Part III each show a starting price in both US dollars and Mexican pesos, based on a $30 USD/hour minimum rate (see the pricing methodology note in src/data/servicesCatalogue.js) — Fixed offerings are settled figures, everything else is a floor confirmed in the written proposal once scope is set. The audience Packages below are the only offerings sold at a fixed, published list price through checkout at mustaphaukizuru.com/store.

### 22. Audience Packages

#### Professional — For independent experts

For consultants, freelancers, and solo professionals building a credible digital presence.

| Tier | Monthly price (USD) | Monthly price (MXN) |
|------|----------------------|----------------------|
| Basic | $290 USD/mo | $5,800 USD/mo |
| Medium (most popular) | $590 USD/mo | $11,800 USD/mo |
| Advanced | $990 USD/mo | $19,800 USD/mo |

#### Business — For SMBs and growth-stage teams

For growing companies that need a complete digital operating system: brand, web, infrastructure, and operations.

| Tier | Monthly price (USD) | Monthly price (MXN) |
|------|----------------------|----------------------|
| Basic | $890 USD/mo | $17,800 USD/mo |
| Medium (most popular) | $1,890 USD/mo | $37,800 USD/mo |
| Advanced | $3,500 USD/mo | $70,000 USD/mo |

#### Schools — For K-12, higher ed, and training institutions

For schools, colleges, and training institutions modernizing teaching, learning, and operations end to end.

| Tier | Monthly price (USD) | Monthly price (MXN) |
|------|----------------------|----------------------|
| Basic | $1,200 USD/mo | $24,000 USD/mo |
| Medium (most popular) | $2,400 USD/mo | $48,000 USD/mo |
| Advanced | $4,500 USD/mo | $90,000 USD/mo |

---

## PART V — HOW WE WORK

### 23. Engagement Process

01. **30-minute call** — Free. We diagnose the situation and agree on whether there is a fit.
02. **Written proposal** — Scope, timeline and price in one document, usually within 3 business days.
03. **Delivery** — Weekly sync, written status every Friday, runbooks at handover.

### 24. Credentials

- **Google Certified Educator L2** — Google
- **Google IT Support Professional** — Google
- **Meta Front-End Developer** — Meta
- **MSc · Software Engineering (in progress)** — UNEATLANTICO
- **BEd · IT, Distinction** — AUCA, Rwanda
- **Colegio de Excelencia Raindrop** — IT Manager · CS Teacher
- **Intellectual Schools, Ethiopia** — ICT Director (2021)
- **Design Office of Africa** — Project Manager (2022)

### 25. Why This Practice

- **Four countries, three continents, one delivery standard** — Production track record across Rwanda, Turkey, Ethiopia, and Mexico, with over eight years of shipping reliable systems.
- **Bilingual delivery as a default, not an upcharge** — Technical artifacts in English, Spanish, or Turkish. You choose the language, with no translation overhead.
- **You brief me; I write the code and the runbooks.** — No junior handoffs, no agency overhead, no telephone game between specs and shipping.
- **Every engagement ends with runbooks, not just code** — Architecture diagrams, deployment runbooks, and clean knowledge transfer included by default.

---

## PART VI — APPENDICES

### Appendix A — Glossary

**Offering.** An atomic, independently sellable service as defined in this catalog.
**Package.** A recurring monthly plan sold directly through checkout, not project-based.
**Tier.** Offering prominence level (1 Flagship, 2 Standard).
**Retainer.** Recurring monthly engagement with a defined minimum term.
**LFPDPPP.** Mexican federal law on data protection (Ley Federal de Protección de Datos Personales en Posesión de los Particulares).

### Appendix B — Document Revision History

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 1.0 | 29 April 2026 | Mustapha Ukizuru | Initial publication of the six-category service catalog with 82 services and 8 flagship Solutions. |
| 2.0 | September 04, 2026 | Mustapha Ukizuru | Rebuilt against the production 4-category / 20-offering taxonomy. Retired the six-category, 82-SKU structure and the invented Solution bundles in full. Removed every unsourced figure. Added starting prices to all offerings, shown in both US dollars and Mexican pesos, at a $30 USD/hour minimum rate. Folded WhatsApp Lead Qualifiers into Custom AI Assistants & WhatsApp Bots (21 -> 20 offerings). Added a Related-offerings cross-reference so buyers see what else a given offering commonly needs to complete. Generated directly from `src/data/servicesCatalogue.js` so this document cannot drift from the live site. |

### Appendix C — Contact

- **Book a 30-min call** — Free · no commitment · clear next step.
- **Email me directly** — hello@mustaphaukizuru.com
- **WhatsApp / Telegram** — Async-friendly, fast turnaround.

---

*End of catalog. 4 categories · 20 offerings · 6 flagship.*