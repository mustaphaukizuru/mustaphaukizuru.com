# 0007 · Whether a package and a standalone offering may price the same work differently

**Date:** 2026-09-04 · **Status:** proposed — NOT DECIDED (owner's call) · **Item:** T2-11

> This is a pricing decision with revenue consequences, and it is the owner's.
> The record states the five cases and the two options; it does not choose.
> Whoever decides edits this file to `accepted` and says which option and why.

## Context

Five capabilities are sold twice, at different prices, depending on which page
the buyer came in through. A monthly package bundles the capability; the
catalogue sells the same work as a scoped project.

| Capability | Bundled from | Sold standalone as | Standalone price |
|---|---|---|---|
| CRM integration and contact-pipeline automation | Business Basic (MX$17,800/mo) | Cross-Platform API Pipelines | from MX$6,000 |
| E-commerce storefront, product catalog, checkout funnel | Business Basic (MX$17,800/mo) | MVP Web App Development | from MX$38,500 |
| Identity and access management (SSO + MFA + RBAC) | Business Medium (MX$37,800/mo) | Zero-Trust Security Hardening | from MX$21,500 |
| Automated backups, restores, disaster-recovery runbooks | Business Medium (MX$37,800/mo) | Disaster Recovery Planning | from MX$14,500 |
| Data privacy audit and FERPA / GDPR compliance program | Schools Medium (MX$48,000/mo) | Compliance & Risk Assessment | MX$15,000 |

The relation is now authored once, in `PACKAGE_OFFERING_OVERLAPS`, and
rendered from both ends (T2-11): the offering row says which packages include
it, the checkout's feature list links back to the offering, and the generated
packages reference prints the table above. **That is the part that holds
either way** — a reader has to be able to explain the difference from the page
in front of them.

What is unresolved is whether the difference is intentional.

## Options

**(a) The package is the audience default; the standalone price is the
single-piece price.** Buying one capability alone costs more per unit than
having it inside a subscription, which is ordinary bundle economics and easy
to say out loud. The offering pages say so explicitly. Nothing is repriced.

**(b) The two are parallel tracks, and the five features get repriced or
reworded** until the per-unit logic holds from both directions.

The awkward case for (a) is the second row: MVP Web App Development starts at
MX$38,500 as a project, while Business Basic bundles "e-commerce storefront,
product catalog, and checkout funnel" inside MX$17,800/month. Two months of
the package is cheaper than the standalone build, which reads as the package
being underpriced or the feature being overstated — not as a bundle discount.
Whichever option is chosen, that row needs an answer of its own.

## What this blocks and what it does not

- Does not block: the cross-references, which are shipped.
- Does block: calling the current prices intentional in a proposal.
- The **Schools** row additionally waits on T4-2's school-director interviews,
  which are meant to establish whether a monthly plan or a fixed audit is the
  entry a director would actually buy. Deciding it before those conversations
  would be guessing at the one audience the practice has least data on.
- T5-18 (hours ledger) assumes the package is the retainer vehicle with
  `includedHoursPerMonth` on `ServicePackage`. Option (a) makes that natural;
  option (b) means the Fractional CTO and Managed Maintenance offerings need
  an allowance field too.
