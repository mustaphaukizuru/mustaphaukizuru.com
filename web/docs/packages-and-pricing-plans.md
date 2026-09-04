---
title: Packages & Pricing Plans Reference
purpose: Full current-state reference of the 3 checkout subscription packages (Professional / Business / Schools) that back /checkout/service?audience=<code>&tier=<key> — generated from web/src/data/servicesCatalogue.js (AUDIENCE_PRICING_PLANS, source of truth). Companion to services-and-categories.md, which covers the 20 individually-booked offerings — these are a separate, monthly, audience-segmented pricing model.
status: reference — regenerate after any pricing/feature edit to AUDIENCE_PRICING_PLANS; do not hand-edit prices here
open_question: Business Medium/Advanced and Schools tiers bundle capabilities (CRM integration, disaster recovery, SSO/MFA/RBAC, e-commerce) that are also sold as standalone offerings in the main catalogue at different price points. Not yet resolved whether packages replace or sit alongside the relevant à la carte offerings for that audience — see note at the end.
last_updated: 2026-09-04
---

# Packages & Pricing Plans — Reference

**3 audience tracks × 3 tiers each = 9 monthly packages.** All-inclusive digital operating systems, distinct from the 20 project-based offerings in `services-and-categories.md` — a package is an ongoing monthly subscription; an offering is a scoped, delivered project.

| Track | Audience | Basic | Medium (most popular) | Advanced |
|---|---|---|---|---|
| Professional | Independent experts, consultants, freelancers | $290/mo · MX$5,800 | $590/mo · MX$11,800 | $990/mo · MX$19,800 |
| Business | SMBs and growth-stage teams | $890/mo · MX$17,800 | $1,890/mo · MX$37,800 | $3,500/mo · MX$70,000 |
| Schools | K-12, higher ed, training institutions | $1,200/mo · MX$24,000 | $2,400/mo · MX$48,000 | $4,500/mo · MX$90,000 |

All tiers are billed monthly. The Medium tier is marked "popular" and priced at a stated 20% saving across all three tracks — Basic and Advanced are not discounted.

---

## Professional
*For independent experts — consultants, freelancers, and solo professionals building a credible digital presence.*

### Basic — $290/mo · MX$5,800/mo — "Best to start"
- Custom personal-brand identity and visual system
- Premium domain and production website (up to 8 pages)
- SEO architecture, schema markup, and search optimization
- Privacy-compliant analytics and conversion dashboards
- Email newsletter and automated lead-capture funnel
- Portfolio and case-study showcase pages
- Online booking and calendar integration

### Medium — $590/mo · MX$11,800/mo — "Save 20%" (popular)
Everything in Basic, plus:
- Automated client-onboarding workflow
- Invoicing and payment-processor setup (PayPal + MercadoPago)
- AI-assisted content production system and prompt library
- Multi-platform social presence kit and templates
- Conversion-optimized landing pages and A/B testing

### Advanced — $990/mo · MX$19,800/mo — "All-inclusive"
Everything in Medium, plus:
- Quarterly brand-strategy and positioning review
- Monthly performance, growth, and traffic report
- Priority email support with 24-hour response SLA
- Dedicated 1:1 monthly strategy session

---

## Business
*For SMBs and growth-stage teams — a complete digital operating system: brand, web, infrastructure, and operations.*

### Basic — $890/mo · MX$17,800/mo — "Launch-ready"
- Custom corporate website with multi-language headless CMS
- Full brand identity and corporate visual system
- Branded email, professional domain, and DNS configuration
- CRM integration and contact-pipeline automation
- SEO program and inbound content strategy
- Marketing automation, nurture flows, and segmented campaigns
- Payment-processor integration (MercadoPago + PayPal + invoicing)
- E-commerce storefront, product catalog, and checkout funnel
- Customer-support helpdesk and ticket workflows

### Medium — $1,890/mo · MX$37,800/mo — "Save 20%" (popular)
Everything in Basic, plus:
- Team collaboration, file-sharing, and intranet platform
- Identity and access management (SSO + MFA + RBAC)
- Cloud hosting with monitored uptime and CDN
- Automated backups, restores, and disaster-recovery runbooks
- Real-time analytics and business-intelligence dashboards

### Advanced — $3,500/mo · MX$70,000/mo — "Enterprise-grade"
Everything in Medium, plus:
- Quarterly business review and strategic roadmap session
- Dedicated account manager and customer-success contact
- 24/7 incident response with 4-hour critical SLA
- On-demand strategic advisory and architecture hours

---

## Schools
*For schools, colleges, and training institutions modernizing teaching, learning, and operations end to end.*

### Basic — $1,200/mo · MX$24,000/mo — "Foundations"
- LMS deployment, configuration, and content migration program
- Google Workspace for Education tenant setup and policies
- Smart classroom configuration and AV integration
- STEM lab, robotics, and maker-space curriculum implementation
- Faculty professional-development cohort (8 sessions)
- Student onboarding and digital-literacy curriculum
- Bilingual content library (English and Spanish)
- AI acceptable-use policy and ethics framework
- Parent and community engagement portal

### Medium — $2,400/mo · MX$48,000/mo — "Save 20%" (popular)
Everything in Basic, plus:
- Attendance, gradebook, and SIS automation and integration
- Network security, content filtering, and CIPA compliance
- Device management for Chromebooks, iPads, and BYOD
- Data privacy audit and FERPA / GDPR compliance program
- Bilingual leadership development and admin training

### Advanced — $4,500/mo · MX$90,000/mo — "Whole-institution"
Everything in Medium, plus:
- Quarterly board-level strategic review
- Six-month post-deployment administrative support
- Emergency response with same-day on-site SLA
- Innovation lab and maker-space program design

---

## Open question: packages vs. à la carte offerings

Several Business and Schools tier features are also sold as standalone, individually-priced offerings in the main catalogue:

| Package feature | Overlapping standalone offering | Standalone price |
|---|---|---|
| CRM integration and contact-pipeline automation (Business Basic) | Cross-Platform API Pipelines | From $300 USD |
| Automated backups, restores, disaster-recovery runbooks (Business Medium) | Disaster Recovery Planning | From $725 USD |
| Identity and access management — SSO/MFA/RBAC (Business Medium) | Zero-Trust Security Hardening | From $1,075 USD |
| Data privacy audit — FERPA/GDPR (Schools Medium) | Compliance & Risk Assessment | $750 USD fixed |
| E-commerce storefront and checkout funnel (Business Basic) | MVP Web App Development (payments as a scale factor) | From $1,925 USD |

This isn't necessarily wrong — a bundled monthly subscription reasonably prices differently than a one-off project — but it means a client comparing both pages could reach different effective prices for the same capability depending on which entry point they use. Worth an explicit decision (documented here once made): either (a) packages are the audience-appropriate default and the standalone offering exists for clients who want only that one piece, priced accordingly higher per-unit for the lack of bundling, or (b) the two catalogues should cross-reference each other explicitly so the pricing logic reads as intentional rather than inconsistent. Not something to silently resolve in this file — flagging for your call.

## Source

Generated from `web/src/data/servicesCatalogue.js` → `AUDIENCE_PRICING_PLANS` / `AUDIENCE_PRICING_ORDER` (lines ~719-904). Backs the existing checkout route `/checkout/service?audience=<code>&tier=<key>` — unchanged by this documentation pass. Regenerate this file after any feature or price edit there; don't hand-edit it independently of the source.
