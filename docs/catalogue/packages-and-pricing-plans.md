---
title: Packages & Pricing Plans Reference
purpose: Full current-state reference of the 3 checkout subscription tracks that back /checkout/service?audience=<code>&tier=<key> — generated from web/src/data/servicesCatalogue.js (AUDIENCE_PRICING_PLANS, source of truth). Companion to services-and-categories.md, which covers the 20 individually-booked offerings; these are a separate, monthly, audience-segmented pricing model.
status: generated — run `cd web && npm run catalog:generate` after any edit to AUDIENCE_PRICING_PLANS; never hand-edit this file
pricing_basis: USD $30/hour minimum rate, converted at a flat 20 MXN/USD. "Fixed" = settled price. "From quote" / "Retainer" = starting price, confirmed in the written proposal once scope is set.
last_updated: 2026-09-04
---

# Packages & Pricing Plans — Reference

**3 audience tracks × 3 tiers = 9 monthly packages.** Ongoing monthly subscriptions, distinct from the 20 project-based offerings in `services-and-categories.md`: a package is a subscription, an offering is a scoped, delivered project.

**These prices are the static catalogue's.** The live site reads prices from `GET /services/plans` (the database, edited in /admin/services) and takes only names, descriptions and the feature matrix from the static file. When the two disagree, the site shows the database and this document shows the code.

| Track | Audience | Basic | Medium | Advanced |
|---|---|---|---|---|
| Professional | For independent experts | $290 USD/month · MX$5,800 | $590 USD/month · MX$11,800 | $990 USD/month · MX$19,800 |
| Business | For SMBs and growth-stage teams | $890 USD/month · MX$17,800 | $1,890 USD/month · MX$37,800 | $3,500 USD/month · MX$70,000 |
| Schools | For K-12, higher ed, and training institutions | $1,200 USD/month · MX$24,000 | $2,400 USD/month · MX$48,000 | $4,500 USD/month · MX$90,000 |

Tiers at or above MX$50,000/month, and the Business and Schools top tiers whatever their price, are **quote-only**: they link to the booking page rather than the checkout, and scope is agreed on a call before anything is charged (T2-4).

---

## Professional
*For independent experts*

### Basic — $290 USD/month · MX$5,800
_Best to start · self-serve — /checkout/service?audience=professional&tier=basic_

- ✓ Custom personal-brand identity and visual system
- ✓ Premium domain and production website (up to 8 pages)
- ✓ SEO architecture, schema markup, and search optimization
- ✓ Privacy-compliant analytics and conversion dashboards
- ✓ Email newsletter and automated lead-capture funnel
- ✓ Portfolio and case-study showcase pages
- ✓ Online booking and calendar integration
- ✗ Automated client-onboarding workflow
- ✗ Invoicing and payment-processor setup (PayPal + MercadoPago)
- ✗ AI-assisted content production system and prompt library
- ✗ Multi-platform social presence kit and templates
- ✗ Conversion-optimized landing pages and A/B testing
- ✗ Quarterly brand-strategy and positioning review
- ✗ Monthly performance, growth, and traffic report
- ✗ Priority email support, next-business-day response
- ✗ Dedicated 1:1 monthly strategy session

### Medium — $590 USD/month · MX$11,800
_most popular · Save 20% · self-serve — /checkout/service?audience=professional&tier=medium_

- ✓ Custom personal-brand identity and visual system
- ✓ Premium domain and production website (up to 8 pages)
- ✓ SEO architecture, schema markup, and search optimization
- ✓ Privacy-compliant analytics and conversion dashboards
- ✓ Email newsletter and automated lead-capture funnel
- ✓ Portfolio and case-study showcase pages
- ✓ Online booking and calendar integration
- ✓ Automated client-onboarding workflow
- ✓ Invoicing and payment-processor setup (PayPal + MercadoPago)
- ✓ AI-assisted content production system and prompt library
- ✓ Multi-platform social presence kit and templates
- ✓ Conversion-optimized landing pages and A/B testing
- ✗ Quarterly brand-strategy and positioning review
- ✗ Monthly performance, growth, and traffic report
- ✗ Priority email support, next-business-day response
- ✗ Dedicated 1:1 monthly strategy session

### Advanced — $990 USD/month · MX$19,800
_All-inclusive · self-serve — /checkout/service?audience=professional&tier=advanced_

- ✓ Custom personal-brand identity and visual system
- ✓ Premium domain and production website (up to 8 pages)
- ✓ SEO architecture, schema markup, and search optimization
- ✓ Privacy-compliant analytics and conversion dashboards
- ✓ Email newsletter and automated lead-capture funnel
- ✓ Portfolio and case-study showcase pages
- ✓ Online booking and calendar integration
- ✓ Automated client-onboarding workflow
- ✓ Invoicing and payment-processor setup (PayPal + MercadoPago)
- ✓ AI-assisted content production system and prompt library
- ✓ Multi-platform social presence kit and templates
- ✓ Conversion-optimized landing pages and A/B testing
- ✓ Quarterly brand-strategy and positioning review
- ✓ Monthly performance, growth, and traffic report
- ✓ Priority email support, next-business-day response
- ✓ Dedicated 1:1 monthly strategy session


---

## Business
*For SMBs and growth-stage teams*

### Basic — $890 USD/month · MX$17,800
_Launch-ready · self-serve — /checkout/service?audience=business&tier=basic_

- ✓ Custom corporate website with multi-language headless CMS
- ✓ Full brand identity and corporate visual system
- ✓ Branded email, professional domain, and DNS configuration
- ✓ CRM integration and contact-pipeline automation
- ✓ SEO program and inbound content strategy
- ✓ Marketing automation, nurture flows, and segmented campaigns
- ✓ Payment-processor integration (MercadoPago + PayPal + invoicing)
- ✓ E-commerce storefront, product catalog, and checkout funnel
- ✓ Customer-support helpdesk and ticket workflows
- ✗ Team collaboration, file-sharing, and intranet platform
- ✗ Identity and access management (SSO + MFA + RBAC)
- ✗ Cloud hosting with monitored uptime and CDN
- ✗ Automated backups, restores, and disaster-recovery runbooks
- ✗ Real-time analytics and business-intelligence dashboards
- ✗ Quarterly business review and strategic roadmap session
- ✗ Dedicated account manager and customer-success contact
- ✗ 4-hour target on production-down incidents, business hours
- ✗ On-demand strategic advisory and architecture hours

### Medium — $1,890 USD/month · MX$37,800
_most popular · Save 20% · self-serve — /checkout/service?audience=business&tier=medium_

- ✓ Custom corporate website with multi-language headless CMS
- ✓ Full brand identity and corporate visual system
- ✓ Branded email, professional domain, and DNS configuration
- ✓ CRM integration and contact-pipeline automation
- ✓ SEO program and inbound content strategy
- ✓ Marketing automation, nurture flows, and segmented campaigns
- ✓ Payment-processor integration (MercadoPago + PayPal + invoicing)
- ✓ E-commerce storefront, product catalog, and checkout funnel
- ✓ Customer-support helpdesk and ticket workflows
- ✓ Team collaboration, file-sharing, and intranet platform
- ✓ Identity and access management (SSO + MFA + RBAC)
- ✓ Cloud hosting with monitored uptime and CDN
- ✓ Automated backups, restores, and disaster-recovery runbooks
- ✓ Real-time analytics and business-intelligence dashboards
- ✗ Quarterly business review and strategic roadmap session
- ✗ Dedicated account manager and customer-success contact
- ✗ 4-hour target on production-down incidents, business hours
- ✗ On-demand strategic advisory and architecture hours

### Advanced — $3,500 USD/month · MX$70,000
_Enterprise-grade · quote-only — book a call_

- ✓ Custom corporate website with multi-language headless CMS
- ✓ Full brand identity and corporate visual system
- ✓ Branded email, professional domain, and DNS configuration
- ✓ CRM integration and contact-pipeline automation
- ✓ SEO program and inbound content strategy
- ✓ Marketing automation, nurture flows, and segmented campaigns
- ✓ Payment-processor integration (MercadoPago + PayPal + invoicing)
- ✓ E-commerce storefront, product catalog, and checkout funnel
- ✓ Customer-support helpdesk and ticket workflows
- ✓ Team collaboration, file-sharing, and intranet platform
- ✓ Identity and access management (SSO + MFA + RBAC)
- ✓ Cloud hosting with monitored uptime and CDN
- ✓ Automated backups, restores, and disaster-recovery runbooks
- ✓ Real-time analytics and business-intelligence dashboards
- ✓ Quarterly business review and strategic roadmap session
- ✓ Dedicated account manager and customer-success contact
- ✓ 4-hour target on production-down incidents, business hours
- ✓ On-demand strategic advisory and architecture hours


---

## Schools
*For K-12, higher ed, and training institutions*

### Basic — $1,200 USD/month · MX$24,000
_Foundations · self-serve — /checkout/service?audience=schools&tier=basic_

- ✓ LMS deployment, configuration, and content migration program
- ✓ Google Workspace for Education tenant setup and policies
- ✓ Smart classroom configuration and AV integration
- ✓ STEM lab, robotics, and maker-space curriculum implementation
- ✓ Faculty professional-development cohort (8 sessions)
- ✓ Student onboarding and digital-literacy curriculum
- ✓ Bilingual content library (English and Spanish)
- ✓ AI acceptable-use policy and ethics framework
- ✓ Parent and community engagement portal
- ✗ Attendance, gradebook, and SIS automation and integration
- ✗ Network security, content filtering, and CIPA compliance
- ✗ Device management for Chromebooks, iPads, and BYOD
- ✗ Data privacy audit and FERPA / GDPR compliance program
- ✗ Bilingual leadership development and admin training
- ✗ Quarterly board-level strategic review
- ✗ Six-month post-deployment administrative support
- ✗ Remote-first incident response; on-site by arrangement
- ✗ Innovation lab and maker-space program design

### Medium — $2,400 USD/month · MX$48,000
_most popular · Save 20% · self-serve — /checkout/service?audience=schools&tier=medium_

- ✓ LMS deployment, configuration, and content migration program
- ✓ Google Workspace for Education tenant setup and policies
- ✓ Smart classroom configuration and AV integration
- ✓ STEM lab, robotics, and maker-space curriculum implementation
- ✓ Faculty professional-development cohort (8 sessions)
- ✓ Student onboarding and digital-literacy curriculum
- ✓ Bilingual content library (English and Spanish)
- ✓ AI acceptable-use policy and ethics framework
- ✓ Parent and community engagement portal
- ✓ Attendance, gradebook, and SIS automation and integration
- ✓ Network security, content filtering, and CIPA compliance
- ✓ Device management for Chromebooks, iPads, and BYOD
- ✓ Data privacy audit and FERPA / GDPR compliance program
- ✓ Bilingual leadership development and admin training
- ✗ Quarterly board-level strategic review
- ✗ Six-month post-deployment administrative support
- ✗ Remote-first incident response; on-site by arrangement
- ✗ Innovation lab and maker-space program design

### Advanced — $4,500 USD/month · MX$90,000
_Whole-institution · quote-only — book a call_

- ✓ LMS deployment, configuration, and content migration program
- ✓ Google Workspace for Education tenant setup and policies
- ✓ Smart classroom configuration and AV integration
- ✓ STEM lab, robotics, and maker-space curriculum implementation
- ✓ Faculty professional-development cohort (8 sessions)
- ✓ Student onboarding and digital-literacy curriculum
- ✓ Bilingual content library (English and Spanish)
- ✓ AI acceptable-use policy and ethics framework
- ✓ Parent and community engagement portal
- ✓ Attendance, gradebook, and SIS automation and integration
- ✓ Network security, content filtering, and CIPA compliance
- ✓ Device management for Chromebooks, iPads, and BYOD
- ✓ Data privacy audit and FERPA / GDPR compliance program
- ✓ Bilingual leadership development and admin training
- ✓ Quarterly board-level strategic review
- ✓ Six-month post-deployment administrative support
- ✓ Remote-first incident response; on-site by arrangement
- ✓ Innovation lab and maker-space program design

---

## Sold both ways — open pricing decision

These capabilities are sold twice: bundled into a monthly package, and as a scoped project in `services-and-categories.md`. A client comparing the two pages reaches different numbers for what looks like the same thing, so both pages now name the relationship (T2-11) — but **whether the prices should differ is not decided**.

The choice is between (a) the package is the audience default and the standalone price is the single-piece price, deliberately higher per unit, and (b) the two are parallel and these features get repriced. It becomes ADR 0007, and the Schools row also waits on T4-2's school-director interviews.

| Capability | Bundled from | Sold standalone as | Standalone price |
|---|---|---|---|
| CRM integration and contact-pipeline automation | Business Basic | Cross-Platform API Pipelines | From $300 USD · MX$6,000 |
| E-commerce storefront, product catalog, and checkout funnel | Business Basic | MVP Web App Development | From $1,925 USD · MX$38,500 |
| Identity and access management (SSO + MFA + RBAC) | Business Medium | Zero-Trust Security Hardening | From $1,075 USD · MX$21,500 |
| Automated backups, restores, and disaster-recovery runbooks | Business Medium | Disaster Recovery Planning | From $725 USD · MX$14,500 |
| Data privacy audit and FERPA / GDPR compliance program | Schools Medium | Compliance & Risk Assessment | $750 USD · MX$15,000 |

---

_Generated from web/src/data/servicesCatalogue.js by web/scripts/generate-service-catalog.mjs. Do not hand-edit — `npm run catalog:check` fails when this file differs from a fresh run._
