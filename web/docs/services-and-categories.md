---
title: Services & Categories Reference
purpose: Full current-state reference of the live service catalogue — 4 categories, 20 offerings, pricing, deliverables, and cross-references — generated from web/src/data/servicesCatalogue.js (source of truth). For briefs, proposals, sales conversations, and as a companion to engagement-process-content.md.
status: reference — regenerate from servicesCatalogue.js after any pricing or catalogue edit; do not hand-edit prices here
pricing_basis: USD $30/hour minimum rate, converted at a flat 20 MXN/USD. "Fixed" = settled price. "From quote" / "Retainer" = starting price, confirmed in the written proposal once scope is set.
last_updated: 2026-09-04
---

# Service Catalogue — Reference

**4 categories · 20 offerings · every price shown in USD and MXN**

| # | Category | Offerings | Primary audience |
|---|---|---|---|
| 1 | IT Strategy Consulting | 5 | SMEs, Schools |
| 2 | AI Integration & Workflow Automation | 4 | SMEs, Individuals |
| 3 | Cloud Architecture & Infrastructure Migration | 5 | SMEs, Schools |
| 4 | End-to-End Digital Product Engineering | 6 | SMEs, Individuals |

---

## 1 · IT Strategy Consulting
*Consultoría Estratégica de TI*

**Promise:** independent senior advice on what to keep, what to cut, and what to build next.
**Outcome:** cut wasted software spend and get a clear, sequenced technology roadmap your team can execute.
**Primary audience:** SMEs & Businesses · Schools & Education

### Software Stack Audit
Fixed · $750 USD · MX$15,000 · 2–3 weeks · Audit
Review of existing licences to eliminate duplicate subscriptions and cut waste.
**Deliverables:** licence and subscription inventory · duplicate/unused tooling report · savings estimate · consolidation plan.
**Often paired with:** Digital Transformation Roadmap, Cloud Bill Optimisation.

### Fractional CTO Engagement — flagship
Retainer · From $775 USD/mo · MX$15,500/mo · Ongoing, 3-month minimum
Part-time technical leadership: roadmaps and hiring guidance.
**Includes at this price:** weekly leadership sync, roadmap ownership, and vendor/architecture decisions for one product line, up to ~6 hours/week. Billed monthly in advance, 3-month minimum, then cancel with 30 days' notice.
**Price increases with:** more hours/week (10–20h standard cadence) · more than one product line or team · hands-on hiring panels beyond rubric design · on-site days in CDMX or Estado de México.
**Deliverables:** weekly leadership cadence · technology roadmap ownership · hiring rubrics and interviews · vendor and architecture decisions.
**Often paired with:** Digital Transformation Roadmap, Vendor Evaluation & RFP.

### Vendor Evaluation & RFP
From quote · From $900 USD · MX$18,000 · 3–6 weeks · Engagement
Independent expert review of third-party software offers for fairness.
**Includes at this price:** one RFP cycle for a single software category — requirements definition, a shortlist of up to five vendors, one comparison matrix, one recommendation.
**Price increases with:** more than five vendors shortlisted · multiple categories evaluated in parallel · live demo coordination and reference calls · contract negotiation support beyond the written review.
**Deliverables:** requirements definition · RFP drafting and management · comparison matrix · contract review and recommendation.
**Often paired with:** Software Stack Audit, Digital Transformation Roadmap.

### Digital Transformation Roadmap — flagship
From quote · From $950 USD · MX$19,000 · 4–6 weeks · Roadmap
Step-by-step migrations from paper and spreadsheets to automated platforms.
**Includes at this price:** the audit and twelve-month roadmap for one department or campus, one stakeholder workshop, the written plan.
**Price increases with:** multi-department or multi-campus scope · additional stakeholder workshops · a detailed change-management/training-rollout plan · budget modelling across multiple vendor scenarios.
**Deliverables:** process and systems audit · prioritised opportunity matrix · 12-month sequenced roadmap · budget and change-management plan.
**Often paired with:** Software Stack Audit, Fractional CTO, MVP Web App Development, On-Premise to Cloud Migration.

### Compliance & Risk Assessment
Fixed · $750 USD · MX$15,000 · 2–3 weeks · Audit
Architecture audit to comply with Mexican privacy law (LFPDPPP).
**Deliverables:** data inventory and flow map · LFPDPPP gap analysis · risk register · remediation roadmap.
**Often paired with:** Zero-Trust Security Hardening, Internal RAG Knowledge Base.

---

## 2 · AI Integration & Workflow Automation
*Integración con IA y Automatización de Flujos de Trabajo*

**Promise:** assistants, agents and pipelines that remove repetitive work from your team's week.
**Outcome:** answer customers faster, sync leads automatically, and turn documents into clean data without adding headcount.
**Primary audience:** SMEs & Businesses · Individuals & Pros

### Custom AI Assistants & WhatsApp Bots — flagship
From quote · From $950 USD · MX$19,000 · 2–4 weeks · Build
LLM assistants trained on your brand voice and documents, deployed on WhatsApp Business, your website, or both — from answering FAQs to qualifying and routing every new lead. *(Merged Sept 2026 — this offering absorbed the former standalone WhatsApp Lead Qualifiers listing; same capability, one entry.)*
**Includes at this price:** one assistant on one primary channel (WhatsApp Business or web chat), trained on your documents, guardrails, CRM sync to one system (HubSpot, Zoho, or a sheet).
**Price increases with:** deploying on more than one channel at once (web + WhatsApp + app) · syncing to more than one CRM/data source · custom escalation and handoff workflows · multilingual response sets · high message-volume infrastructure.
**Deliverables:** WhatsApp Business API setup · voice and tone guide ingestion · assistant with guardrails · qualification flow and CRM sync · web/WhatsApp/in-app deployment · evaluation set, monitoring, and human handover.
**Often paired with:** Cross-Platform API Pipelines, Managed Maintenance.

### Cross-Platform API Pipelines
From quote · From $300 USD · MX$6,000 · 1–3 weeks · Integration
Connect disconnected tools (e.g. payments, Slack, email) with Make or Zapier.
**Includes at this price:** one integration path between two tools, built in Make or Zapier, with basic error alerts.
**Price increases with:** each additional tool/integration path · custom code instead of Make/Zapier scenarios · high-volume or real-time processing · separate staging/production environments.
**Deliverables:** integration map · Make/Zapier scenarios · error handling and alerts · runbook.
**Often paired with:** MVP Web App Development, Custom AI Assistants, Data Extraction Workflows.
**Note:** this is the offering an MVP build reaches for when it needs to connect payments, CRM, or email — see Digital Product Engineering below.

### Internal RAG Knowledge Base
From quote · From $1,925 USD · MX$38,500 · 4–8 weeks · Build
Private corporate search engines built on vector databases (Pinecone).
**Includes at this price:** ingestion of one document set, a Pinecone vector index, a search/chat interface with citations for one team.
**Price increases with:** multiple document sets/data sources · role-based access control across teams · a custom interface beyond the standard chat UI · an ongoing re-indexing pipeline.
**Deliverables:** document ingestion pipeline · vector index (Pinecone) · search/chat interface with citations · access control.
**Often paired with:** Zero-Trust Security Hardening, Compliance & Risk Assessment.

### Data Extraction Workflows
From quote · From $950 USD · MX$19,000 · 2–4 weeks · Build
Tools that parse PDFs, invoices or forms into clean spreadsheets.
**Includes at this price:** one document type (e.g. invoices), field extraction, validation, a single spreadsheet/database output.
**Price increases with:** additional document types/formats · higher accuracy/validation needing human-in-the-loop review · direct write-back to an ERP/accounting system · high monthly document volume.
**Deliverables:** document classifier · field extraction with validation · spreadsheet/database output · exception review queue.
**Often paired with:** Cross-Platform API Pipelines, Managed Maintenance.

---

## 3 · Cloud Architecture & Infrastructure Migration
*Arquitectura en la Nube y Migración de Infraestructura*

**Promise:** move to the cloud safely, pay less for it, and survive the bad day.
**Outcome:** retire the office server, pay only for the cloud capacity you use, and know your backups actually restore.
**Primary audience:** SMEs & Businesses · Schools & Education

### On-Premise to Cloud Migration — flagship
From quote · From $2,875 USD · MX$57,500 · 6–12 weeks · Migration
Safely move physical office servers to AWS, Azure or GCP. **On-site work typically required** for physical network hardware assessment.
**Includes at this price:** migration of one office server/workload to a single cloud provider, a landing zone, one rehearsed cutover.
**Price increases with:** multiple servers/workloads migrated together · multi-region or multi-cloud architecture · legacy application refactoring beyond lift-and-shift · an extended post-migration support window.
**Deliverables:** migration assessment · landing zone (VPC, IAM) · workload migration and cutover · post-migration support.
**Often paired with:** Disaster Recovery Planning, Zero-Trust Security Hardening, Cloud Bill Optimisation.

### Cloud Bill Optimisation
Fixed · $450 USD · MX$9,000 · 1–2 weeks · Audit
Audit configurations to right-size servers and remove capacity you pay for but never use.
**Deliverables:** billing analysis · right-sizing recommendations · reserved/committed-use plan · savings tracker.
**Often paired with:** On-Premise to Cloud Migration.

### Disaster Recovery Planning
From quote · From $725 USD · MX$14,500 · 2–4 weeks · Implementation
Automated, encrypted backups with failover.
**Includes at this price:** RPO/RTO definition, encrypted backup automation, one live restore drill for a single environment.
**Price increases with:** multiple environments/regions · sub-hour RTO requirements (hot standby/active-active) · compliance-driven audit documentation (LFPDPPP or industry-specific) · a recurring quarterly drill program.
**Deliverables:** RPO/RTO definition · encrypted backup automation · failover configuration · restore drill and runbook.
**Often paired with:** On-Premise to Cloud Migration, Compliance & Risk Assessment.

### Docker & Containerisation
From quote · From $725 USD · MX$14,500 · 2–4 weeks · Implementation
Package legacy applications into containers for fast deployments.
**Includes at this price:** containerizing one application and its environments, a basic registry and deployment flow.
**Price increases with:** multiple applications/microservices · full Kubernetes orchestration instead of single-host Docker Compose · multi-environment parity with automated promotion · legacy refactoring to containerize cleanly.
**Deliverables:** Dockerfiles and compose/orchestration · environment parity · registry and deployment flow · documentation.
**Often paired with:** CI/CD Pipeline Automation, On-Premise to Cloud Migration.

### Zero-Trust Security Hardening
From quote · From $1,075 USD · MX$21,500 · 3–5 weeks · Implementation
Enterprise-grade access controls for remote work. **On-site work typically required** for network hardware.
**Includes at this price:** identity and MFA rollout, a device/network policy baseline for one office or up to ~50 users.
**Price increases with:** more than ~50 users/devices · multiple office locations · custom compliance reporting beyond the baseline report · an ongoing quarterly policy review.
**Deliverables:** identity and MFA rollout · device and network policies · least-privilege access review · security baseline report.
**Often paired with:** On-Premise to Cloud Migration, Compliance & Risk Assessment.

---

## 4 · End-to-End Digital Product Engineering
*Ingeniería de Producto Digital de Extremo a Extremo*

**Promise:** from clickable prototype to shipped product, with the pipeline and maintenance to keep it running.
**Outcome:** validate before you build, ship an MVP in weeks, and keep it patched and improving every month.
**Primary audience:** SMEs & Businesses · Individuals & Pros

### Interactive UI/UX Wireframing
Fixed · $900 USD · MX$18,000 · 1–2 weeks · Sprint
High-fidelity clickable prototypes before writing any backend.
**Deliverables:** user flows · clickable Figma prototype · design tokens · handoff notes.
**Often paired with:** MVP Web App Development (natural predecessor — de-risks scope before the build starts).

### MVP Web App Development — flagship
From quote · From $1,925 USD · MX$38,500 · 4–10 weeks · Build
Fast, working minimum viable products built on modern ecosystems.
**Includes at this price:** a scoped MVP backlog and a working web app (React + API) with core auth, deployed with 30 days of support.
**Price increases with:** payment processing integration · third-party integrations beyond authentication · a native mobile companion app · multi-tenant or multi-role permission systems · an extended support window beyond 30 days.
**Deliverables:** scoped MVP backlog · web application (React + API) · auth and payments if needed · deployment and 30-day support.
**Requires / often paired with:** Interactive UI/UX Wireframing (before), Cross-Platform API Pipelines (for payments/CRM/email integrations), CI/CD Pipeline Automation, Managed Maintenance (after launch). *This is the "main service, four things needed to complete it" case — the MVP build routinely composes with a wireframing sprint up front, an API-pipeline offering for third-party connections, a CI/CD pipeline for deployment, and a maintenance retainer once it ships.*

### Cross-Platform Mobile Apps
From quote · From $2,875 USD · MX$57,500 · 6–12 weeks · Build
A single codebase for iOS and Android.
**Includes at this price:** one React Native/Expo app with store-ready builds for iOS and Android, push notifications, a release pipeline.
**Price increases with:** offline-first or complex local-data sync · native module work outside Expo's managed workflow · multiple user roles or white-label variants · App Store/Play Store review handling beyond submission.
**Deliverables:** React Native/Expo app · store-ready builds · push notifications and analytics · release pipeline.
**Often paired with:** Cross-Platform API Pipelines, Secure API Design, Managed Maintenance.

### Secure API Design
From quote · From $950 USD · MX$19,000 · 2–6 weeks · Build
Fast, well-documented backend APIs that link business applications.
**Includes at this price:** one API contract (OpenAPI), authentication and rate limiting, implementation, developer documentation.
**Price increases with:** multiple services/microservices · complex authorization models (multi-tenant, role hierarchies) · third-party API consumers requiring versioning/SLAs · load-testing and performance tuning beyond baseline.
**Deliverables:** API contract (OpenAPI) · auth, rate limiting, audit logs · implementation and tests · developer documentation.
**Often paired with:** MVP Web App Development, CI/CD Pipeline Automation.

### CI/CD Pipeline Automation
From quote · From $350 USD · MX$7,000 · 1–3 weeks · Implementation
Automated, zero-downtime deployment scripts.
**Includes at this price:** one deployment pipeline (GitHub Actions or similar), automated tests, a documented rollback procedure.
**Price increases with:** multiple environments/services in the same pipeline · blue-green or canary deployment strategies · infrastructure-as-code setup alongside the pipeline · multi-repo or monorepo orchestration.
**Deliverables:** pipeline (GitHub Actions or similar) · automated tests and checks · zero-downtime deploy strategy · rollback procedure.
**Often paired with:** MVP Web App Development, Docker & Containerisation.

### Managed Maintenance
Retainer · From $250 USD/mo · MX$5,000/mo · Monthly, no minimum term
Recurring monthly support: fixes, patches and feature rollouts.
**Includes at this price:** bug fixes, security patches, and dependency updates for one application, with one feature-deployment slot a month. Billed monthly in advance; cancel with 30 days' notice, no minimum term.
**Price increases with:** additional feature-deployment slots per month · multiple applications under the same retainer · a faster response SLA than standard business hours · after-hours, on-call incident coverage.
**Deliverables:** bug fixes and security patches · dependency updates · feature deployment slots · monthly report.
**Often paired with:** MVP Web App Development, Custom AI Assistants & WhatsApp Bots.

---

## Flagship offerings (tier 1, actively led with)

Fractional CTO Engagement · Digital Transformation Roadmap · Custom AI Assistants & WhatsApp Bots · On-Premise to Cloud Migration · MVP Web App Development.

## Pricing model key

- **Fixed** — settled price, no variables: Software Stack Audit, Compliance & Risk Assessment, Cloud Bill Optimisation, Interactive UI/UX Wireframing. (4 offerings)
- **From quote** — starting price shown, confirmed in the written proposal once scope is set. Every offering not listed as Fixed or Retainer. (14 offerings)
- **Retainer** — monthly, billed in advance: Fractional CTO Engagement, Managed Maintenance. (2 offerings)

## Full price table (USD → MXN, ascending)

| Offering | Category | Model | USD | MXN |
|---|---|---|---|---|
| Cross-Platform API Pipelines | AIA | From quote | $300 | MX$6,000 |
| CI/CD Pipeline Automation | DPE | From quote | $350 | MX$7,000 |
| Cloud Bill Optimisation | CAM | Fixed | $450 | MX$9,000 |
| Software Stack Audit | ITS | Fixed | $750 | MX$15,000 |
| Compliance & Risk Assessment | ITS | Fixed | $750 | MX$15,000 |
| Disaster Recovery Planning | CAM | From quote | $725 | MX$14,500 |
| Docker & Containerisation | CAM | From quote | $725 | MX$14,500 |
| Fractional CTO Engagement | ITS | Retainer/mo | $775 | MX$15,500 |
| Vendor Evaluation & RFP | ITS | From quote | $900 | MX$18,000 |
| Interactive UI/UX Wireframing | DPE | Fixed | $900 | MX$18,000 |
| Digital Transformation Roadmap | ITS | From quote | $950 | MX$19,000 |
| Custom AI Assistants & WhatsApp Bots | AIA | From quote | $950 | MX$19,000 |
| Data Extraction Workflows | AIA | From quote | $950 | MX$19,000 |
| Secure API Design | DPE | From quote | $950 | MX$19,000 |
| Zero-Trust Security Hardening | CAM | From quote | $1,075 | MX$21,500 |
| MVP Web App Development | DPE | From quote | $1,925 | MX$38,500 |
| Internal RAG Knowledge Base | AIA | From quote | $1,925 | MX$38,500 |
| On-Premise to Cloud Migration | CAM | From quote | $2,875 | MX$57,500 |
| Cross-Platform Mobile Apps | DPE | From quote | $2,875 | MX$57,500 |
| Managed Maintenance | DPE | Retainer/mo | $250 | MX$5,000 |

---

## Source & regeneration

Generated from `web/src/data/servicesCatalogue.js` (903 lines, single source of truth for the live site, checkout, and the PDF/HTML catalogue generator at `web/scripts/generate-service-catalog.mjs`). Any offering, price, or cross-reference change belongs there first — this file, `engagement-process-content.md`, and the PDF catalogue are all downstream of it and should be regenerated after an edit, not hand-patched independently.

Not covered here (see the source file directly if needed): `AUDIENCE_PRICING_PLANS` (3 checkout packages), per-category FAQ (`CATEGORY_FAQS`), trust-strip credentials, differentiation pillars, and the services-wide FAQ.
