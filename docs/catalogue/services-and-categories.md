---
title: Services & Categories Reference
purpose: Full current-state reference of the live service catalogue — 4 categories, 20 offerings, pricing, deliverables and cross-references — generated from web/src/data/servicesCatalogue.js (source of truth). For briefs, proposals and sales conversations, and as a companion to engagement-process-content.md.
status: generated — run `cd web && npm run catalog:generate` after any catalogue edit; never hand-edit this file
pricing_basis: USD $30/hour minimum rate, converted at a flat 20 MXN/USD. "Fixed" = settled price. "From quote" / "Retainer" = starting price, confirmed in the written proposal once scope is set.
last_updated: 2026-09-04
---

# Service Catalogue — Reference

**4 categories · 20 offerings · every price shown in USD and MXN**

| # | Category | Offerings | Primary audience |
|---|---|---|---|
| 1 | IT Strategy Consulting | 5 | SMEs & Businesses · Schools & Education |
| 2 | AI Integration & Workflow Automation | 4 | SMEs & Businesses · Schools & Education · Individuals & Pros |
| 3 | Cloud Architecture & Infrastructure Migration | 5 | SMEs & Businesses · Schools & Education |
| 4 | End-to-End Digital Product Engineering | 6 | SMEs & Businesses · Individuals & Pros |

---

## 1 · IT Strategy Consulting
*Consultoría Estratégica de TI*

**Promise:** Independent senior advice on what to keep, what to cut, and what to build next.
**Outcome:** Cut wasted software spend and get a clear, sequenced technology roadmap your team can execute.
**Primary audience:** SMEs & Businesses · Schools & Education

### Software Stack Audit
`UKZ-ITS-001` · $750 USD · MX$15,000 · 2–3 weeks · Audit
Review of existing licences to eliminate duplicate subscriptions and cut waste.
**Deliverables:** Licence and subscription inventory · Duplicate / unused tooling report · Savings estimate · Consolidation plan.
**Often paired with:** Digital Transformation Roadmap, Cloud Bill Optimisation.

### Fractional CTO Engagement — flagship
`UKZ-ITS-002` · From $775 USD/month · MX$15,500/month · Ongoing · 3-month minimum · Retainer
Part-time technical leadership: roadmaps and hiring guidance.
**Includes at this price:** Covers a light-advisory cadence: weekly leadership sync, roadmap ownership, and vendor/architecture decisions for one product line, up to about 6 hours a week. Billed monthly in advance, 3-month minimum, then cancel with 30 days' notice.
**Price increases with:** More hours per week (10–20h, standard leadership cadence) · More than one product line or team · Hands-on hiring panels beyond rubric design · On-site days in CDMX or Estado de México.
**Deliverables:** Weekly leadership cadence · Technology roadmap ownership · Hiring rubrics and interviews · Vendor and architecture decisions.
**Often paired with:** Digital Transformation Roadmap, Vendor Evaluation & RFP.

### Vendor Evaluation & RFP
`UKZ-ITS-003` · From $900 USD · MX$18,000 · 3–6 weeks · Engagement
Independent expert review of third-party software offers for fairness.
**Includes at this price:** Covers one RFP cycle for a single software category: requirements definition, a shortlist of up to five vendors, one comparison matrix, and a recommendation.
**Price increases with:** More than five vendors shortlisted · Multiple software categories evaluated in parallel · Live demo coordination and reference calls · Contract negotiation support beyond the written review.
**Deliverables:** Requirements definition · RFP drafting and management · Comparison matrix · Contract review and recommendation.
**Often paired with:** Software Stack Audit, Digital Transformation Roadmap.

### Digital Transformation Roadmap — flagship
`UKZ-ITS-004` · From $950 USD · MX$19,000 · 4–6 weeks · Roadmap
Step-by-step migrations from paper and spreadsheets to automated platforms.
**Includes at this price:** Covers the audit and twelve-month roadmap for one department or campus, one stakeholder workshop, and the written plan.
**Price increases with:** Multi-department or multi-campus scope · Additional stakeholder workshops · A detailed change-management or training-rollout plan · Budget modelling across multiple vendor scenarios.
**Deliverables:** Process and systems audit · Prioritised opportunity matrix · 12-month sequenced roadmap · Budget and change-management plan.
**Often paired with:** Software Stack Audit, Fractional CTO Engagement, MVP Web App Development, On-Premise to Cloud Migration.

### Compliance & Risk Assessment
`UKZ-ITS-005` · $750 USD · MX$15,000 · 2–3 weeks · Audit
Architecture audit to comply with Mexican privacy law (LFPDPPP).
**Deliverables:** Data inventory and flow map · LFPDPPP gap analysis · Risk register · Remediation roadmap.
**Often paired with:** Zero-Trust Security Hardening, Internal RAG Knowledge Base.

---

## 2 · AI Integration & Workflow Automation
*Integración con IA y Automatización de Flujos de Trabajo*

**Promise:** Assistants, agents and pipelines that remove repetitive work from your team's week.
**Outcome:** Answer customers faster, sync leads automatically, and turn documents into clean data without adding headcount.
**Primary audience:** SMEs & Businesses · Schools & Education · Individuals & Pros

### Custom AI Assistants & WhatsApp Bots — flagship
`UKZ-AIA-001` · From $950 USD · MX$19,000 · 2–4 weeks · Build
LLM assistants trained on your brand voice and documents, deployed on WhatsApp Business, your website, or both — from answering FAQs to qualifying and routing every new lead.
**Includes at this price:** One assistant on one primary channel (WhatsApp Business or web chat), trained on the documents you provide, with guardrails and CRM sync to one system (HubSpot, Zoho, or a sheet).
**Price increases with:** Deploying on more than one channel at once (web + WhatsApp + app) · Syncing to more than one CRM or data source · Custom escalation and handoff workflows · Multilingual response sets · High message-volume infrastructure.
**Deliverables:** WhatsApp Business API setup · Voice and tone guide ingestion · Assistant with guardrails · Qualification flow and CRM sync (HubSpot, Zoho or sheet) · Web, WhatsApp, or in-app chat deployment · Evaluation set, monitoring, and handover to a human.
**Often paired with:** Cross-Platform API Pipelines, Managed Maintenance.

### Cross-Platform API Pipelines
`UKZ-AIA-003` · From $300 USD · MX$6,000 · 1–3 weeks · Integration
Connect disconnected tools (e.g. payments, Slack, email) with Make or Zapier.
**Includes at this price:** Covers one integration path between two tools (for example, payments to Slack), built in Make or Zapier, with basic error alerts.
**Price increases with:** Each additional tool or integration path · Custom code instead of Make/Zapier scenarios · High-volume or real-time processing needs · Separate staging and production environments.
**Deliverables:** Integration map · Make / Zapier scenarios · Error handling and alerts · Runbook.
**Often paired with:** MVP Web App Development, Custom AI Assistants & WhatsApp Bots, Data Extraction Workflows.

### Internal RAG Knowledge Base — flagship
`UKZ-AIA-004` · From $1,925 USD · MX$38,500 · 4–8 weeks · Build
Private corporate search engines built on vector databases (Pinecone).
**Includes at this price:** Covers ingestion of one document set, a Pinecone vector index, and a search/chat interface with citations for one team.
**Price increases with:** Multiple document sets or data sources · Role-based access control across teams · A custom interface beyond the standard chat UI · An ongoing re-indexing pipeline for frequently changing documents.
**Deliverables:** Document ingestion pipeline · Vector index (Pinecone) · Search / chat interface with citations · Access control.
**Often paired with:** Zero-Trust Security Hardening, Compliance & Risk Assessment.

### Data Extraction Workflows
`UKZ-AIA-005` · From $950 USD · MX$19,000 · 2–4 weeks · Build
Tools that parse PDFs, invoices or forms into clean spreadsheets.
**Includes at this price:** Covers one document type (for example, invoices), with field extraction, validation, and a single spreadsheet or database output.
**Price increases with:** Additional document types or formats · Higher accuracy or validation requirements needing human-in-the-loop review · Direct write-back to an ERP or accounting system instead of a spreadsheet · High monthly document volume.
**Deliverables:** Document classifier · Field extraction with validation · Spreadsheet / database output · Exception review queue.
**Often paired with:** Cross-Platform API Pipelines, Managed Maintenance.

---

## 3 · Cloud Architecture & Infrastructure Migration
*Arquitectura en la Nube y Migración de Infraestructura*

**Promise:** Move to the cloud safely, pay less for it, and survive the bad day.
**Outcome:** Retire the office server, pay only for the cloud capacity you use, and know your backups actually restore.
**Primary audience:** SMEs & Businesses · Schools & Education

### On-Premise to Cloud Migration — flagship
`UKZ-CAM-001` · From $2,875 USD · MX$57,500 · 6–12 weeks · Migration
Safely move physical office servers to AWS, Azure or GCP.
**Includes at this price:** Covers migration of one office server or workload to a single cloud provider, with a landing zone and one rehearsed cutover.
**Price increases with:** Multiple servers or workloads migrated together · Multi-region or multi-cloud architecture · Legacy application refactoring beyond a lift-and-shift · An extended post-migration support window.
**Deliverables:** Migration assessment · Landing zone (VPC, IAM) · Workload migration and cutover · Post-migration support.
**Often paired with:** Disaster Recovery Planning, Zero-Trust Security Hardening, Cloud Bill Optimisation.

### Cloud Bill Optimisation
`UKZ-CAM-002` · $450 USD · MX$9,000 · 1–2 weeks · Audit
Audit configurations to right-size servers and remove capacity you pay for but never use.
**Deliverables:** Billing analysis · Right-sizing recommendations · Reserved / committed-use plan · Savings tracker.
**Often paired with:** On-Premise to Cloud Migration.

### Disaster Recovery Planning
`UKZ-CAM-003` · From $725 USD · MX$14,500 · 2–4 weeks · Implementation
Automated, encrypted backups with failover.
**Includes at this price:** Covers RPO/RTO definition, encrypted backup automation, and one live restore drill for a single environment.
**Price increases with:** Multiple environments or regions · Sub-hour RTO requirements (hot standby / active-active) · Compliance-driven audit documentation (LFPDPPP or industry-specific) · A recurring quarterly drill program.
**Deliverables:** RPO / RTO definition · Encrypted backup automation · Failover configuration · Restore drill and runbook.
**Often paired with:** On-Premise to Cloud Migration, Compliance & Risk Assessment.

### Docker & Containerisation
`UKZ-CAM-004` · From $725 USD · MX$14,500 · 2–4 weeks · Implementation
Package legacy applications into containers for fast deployments.
**Includes at this price:** Covers containerizing one application and its environments, with a basic registry and deployment flow.
**Price increases with:** Multiple applications or microservices · Full orchestration (Kubernetes) instead of single-host Docker Compose · Multi-environment parity (dev/staging/prod) with automated promotion · Legacy application refactoring to containerize cleanly.
**Deliverables:** Dockerfiles and compose / orchestration · Environment parity · Registry and deployment flow · Documentation.
**Often paired with:** CI/CD Pipeline Automation, On-Premise to Cloud Migration.

### Zero-Trust Security Hardening
`UKZ-CAM-005` · From $1,075 USD · MX$21,500 · 3–5 weeks · Implementation
Enterprise-grade access controls for remote work.
**Includes at this price:** Covers identity and MFA rollout and a device/network policy baseline for one office or up to about 50 users.
**Price increases with:** More than about 50 users or devices · Multiple office locations · Custom compliance reporting beyond the baseline report · An ongoing quarterly policy review.
**Deliverables:** Identity and MFA rollout · Device and network policies · Least-privilege access review · Security baseline report.
**Often paired with:** On-Premise to Cloud Migration, Compliance & Risk Assessment.

---

## 4 · End-to-End Digital Product Engineering
*Ingeniería de Producto Digital de Extremo a Extremo*

**Promise:** From clickable prototype to shipped product, with the pipeline and maintenance to keep it running.
**Outcome:** Validate before you build, ship an MVP in weeks, and keep it patched and improving every month.
**Primary audience:** SMEs & Businesses · Individuals & Pros

### Interactive UI/UX Wireframing
`UKZ-DPE-001` · $900 USD · MX$18,000 · 1–2 weeks · Sprint
High-fidelity clickable prototypes before writing any backend.
**Deliverables:** User flows · Clickable Figma prototype · Design tokens · Handoff notes.
**Often paired with:** MVP Web App Development.

### MVP Web App Development — flagship
`UKZ-DPE-002` · From $1,925 USD · MX$38,500 · 4–10 weeks · Build
Fast, working minimum viable products built on modern ecosystems.
**Includes at this price:** Covers a scoped MVP backlog and a working web app (React + API) with core auth, deployed with thirty days of support.
**Price increases with:** Payment processing integration · Third-party integrations beyond authentication · A native mobile companion app · Multi-tenant or multi-role permission systems · An extended support window beyond thirty days.
**Deliverables:** Scoped MVP backlog · Web application (React + API) · Auth and payments if needed · Deployment and 30-day support.
**Often paired with:** Interactive UI/UX Wireframing, Cross-Platform API Pipelines, CI/CD Pipeline Automation, Managed Maintenance.

### Cross-Platform Mobile Apps
`UKZ-DPE-003` · From $2,875 USD · MX$57,500 · 6–12 weeks · Build
A single codebase for iOS and Android.
**Includes at this price:** Covers one React Native / Expo app with store-ready builds for iOS and Android, push notifications, and a release pipeline.
**Price increases with:** Offline-first or complex local-data sync · Native module work outside Expo's managed workflow · Multiple user roles or white-label variants · App Store / Play Store review handling beyond submission.
**Deliverables:** React Native / Expo app · Store-ready builds · Push notifications and analytics · Release pipeline.
**Often paired with:** Cross-Platform API Pipelines, Secure API Design, Managed Maintenance.

### Secure API Design
`UKZ-DPE-004` · From $950 USD · MX$19,000 · 2–6 weeks · Build
Fast, well-documented backend APIs that link business applications.
**Includes at this price:** Covers one API contract (OpenAPI), authentication and rate limiting, implementation, and developer documentation.
**Price increases with:** Multiple services or microservices · Complex authorization models (multi-tenant, role hierarchies) · Third-party API consumers requiring versioning or SLAs · Load-testing and performance tuning beyond the baseline.
**Deliverables:** API contract (OpenAPI) · Auth, rate limiting, audit logs · Implementation and tests · Developer documentation.
**Often paired with:** MVP Web App Development, CI/CD Pipeline Automation.

### CI/CD Pipeline Automation
`UKZ-DPE-005` · From $350 USD · MX$7,000 · 1–3 weeks · Implementation
Automated, zero-downtime deployment scripts.
**Includes at this price:** Covers one deployment pipeline (GitHub Actions or similar), automated tests, and a documented rollback procedure.
**Price increases with:** Multiple environments or services in the same pipeline · Blue-green or canary deployment strategies · Infrastructure-as-code setup alongside the pipeline · Multi-repo or monorepo orchestration.
**Deliverables:** Pipeline (GitHub Actions or similar) · Automated tests and checks · Zero-downtime deploy strategy · Rollback procedure.
**Often paired with:** MVP Web App Development, Docker & Containerisation.

### Managed Maintenance
`UKZ-DPE-006` · From $250 USD/month · MX$5,000/month · Monthly · no minimum term · Retainer
Recurring monthly support: fixes, patches and feature rollouts.
**Includes at this price:** Covers bug fixes, security patches, and dependency updates for one application, with one feature-deployment slot a month. Billed monthly in advance; cancel with 30 days' notice, no minimum term.
**Price increases with:** Additional feature-deployment slots per month · Multiple applications under the same retainer · A faster response SLA than standard business hours · After-hours, on-call incident coverage.
**Deliverables:** Bug fixes and security patches · Dependency updates · Feature deployment slots · Monthly report.
**Often paired with:** MVP Web App Development, Custom AI Assistants & WhatsApp Bots.

---

_Generated from web/src/data/servicesCatalogue.js by web/scripts/generate-service-catalog.mjs. Do not hand-edit — `npm run catalog:check` fails when this file differs from a fresh run._
