/**
 * projectHealthService.js · is this project on time? (T5-12)
 *
 * A tracking page that shows a phase and a percentage answers "where is it"
 * and not "will it be ready when you said". This answers the second, in the
 * three words a carrier uses.
 *
 *   on_track  nothing open is past its date, and nothing is expected to be
 *   at_risk   an estimate has moved past its commitment, but nothing is late
 *             YET — the state that is worth telling a client about, because
 *             it is the only one they can still do something about
 *   late      an open milestone's due date is in the past
 *
 * TWO DATES, AND WHY BOTH
 *
 * `dueDate` is the COMMITMENT: what was agreed, and what a slip is measured
 * against. `estimatedAt` is the current honest belief. Keeping only one would
 * lose the thing that matters — a client who sees both knows a date has
 * moved; a client who sees one discovers it on the day it does not arrive.
 *
 * Closed milestones are ignored throughout. A milestone that was two weeks
 * late and is now finished is history, not a risk, and leaving it in would
 * mean every project that ever slipped reads "late" forever.
 */

const CLOSED_MILESTONE_STATUSES = new Set(["completed", "approved"])

/** Health values, worst first — the order `worst()` relies on. */
const HEALTH = ["late", "at_risk", "on_track"]

const isOpen = (m) => !CLOSED_MILESTONE_STATUSES.has(m?.status) && !m?.completedAt && !m?.approvedAt

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * The health of one milestone.
 *
 * @returns {"on_track"|"at_risk"|"late"}
 */
function milestoneHealth(milestone, now = new Date()) {
  if (!isOpen(milestone)) return "on_track"
  const due = toDate(milestone.dueDate)
  const estimate = toDate(milestone.estimatedAt)

  // Late is about the COMMITMENT, not the estimate. A milestone whose agreed
  // date has passed is late whatever we now believe about it.
  if (due && due < now) return "late"
  // At risk is the estimate having moved past the commitment. Only meaningful
  // when there is a commitment to move past.
  if (due && estimate && estimate > due) return "at_risk"
  // An estimate already in the past with no due date is late in every sense
  // that matters to the person waiting.
  if (!due && estimate && estimate < now) return "late"
  return "on_track"
}

/** The worst health among several. */
function worst(values) {
  for (const level of HEALTH) {
    if (values.includes(level)) return level
  }
  return "on_track"
}

/**
 * The project's health, and the next thing expected.
 *
 * `expectedAt` is the soonest date still ahead among open milestones —
 * the estimate if there is one, otherwise the commitment. That is the "your
 * parcel arrives Tuesday" line, and it is null rather than a guess when
 * nothing has a date: a made-up expectation is worse than none.
 *
 * @param {Array} milestones
 * @param {Date} [now]
 * @returns {{health: string, expectedAt: string|null, lateCount: number, openCount: number}}
 */
function projectHealth(milestones = [], now = new Date()) {
  const open = (milestones || []).filter(isOpen)
  if (!open.length) {
    return { health: "on_track", expectedAt: null, lateCount: 0, openCount: 0 }
  }

  const healths = open.map((m) => milestoneHealth(m, now))
  const upcoming = open
    .map((m) => toDate(m.estimatedAt) || toDate(m.dueDate))
    .filter((d) => d && d >= now)
    .sort((a, b) => a - b)

  return {
    health: worst(healths),
    expectedAt: upcoming[0] ? upcoming[0].toISOString() : null,
    lateCount: healths.filter((h) => h === "late").length,
    openCount: open.length,
  }
}

/**
 * Has an estimate moved far enough to be worth telling the client?
 *
 * Two days, because a date that wobbles by an afternoon is not news and an
 * event for every such wobble trains a client to ignore the timeline. Two
 * days is also roughly the point at which a slip stops being absorbable
 * inside a week.
 */
const RESCHEDULE_THRESHOLD_DAYS = 2

function isMeaningfulReschedule(before, after) {
  const from = toDate(before)
  const to = toDate(after)
  // Setting an estimate for the first time is not a reschedule — there was
  // nothing to move. Clearing one is not either: it says "we no longer
  // know", which is a different message and not this one.
  if (!from || !to) return false
  const days = Math.abs(to - from) / 86_400_000
  return days > RESCHEDULE_THRESHOLD_DAYS
}

module.exports = {
  HEALTH,
  CLOSED_MILESTONE_STATUSES,
  RESCHEDULE_THRESHOLD_DAYS,
  milestoneHealth,
  projectHealth,
  isMeaningfulReschedule,
}
