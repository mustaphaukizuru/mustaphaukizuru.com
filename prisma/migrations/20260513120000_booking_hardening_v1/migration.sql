-- ─────────────────────────────────────────────────────────────────────────────
-- Booking Hardening v1 — migration.sql
--
-- This migration captures every database change in the Booking Hardening v1
-- patch. It is safe to run multiple times (every statement uses
-- IF NOT EXISTS / IF EXISTS / a guard on existence) but you should review
-- the EXCLUDE-constraint section before running on a hot production table.
--
-- HOW TO APPLY:
--
--   Path A — you stay on `prisma db push` (current setup)
--   ───────────────────────────────────────────────────────
--   1) Run `npx prisma db push`. Prisma will add the new columns
--      (bookingCancellationNoticeHours, bookingRescheduleNoticeHours,
--      revision) and drop the @@unique([assignedAdminId, scheduledAt])
--      constraint because schema.prisma no longer declares it.
--   2) Apply the EXCLUDE-constraint section of this file MANUALLY:
--        psql "$DATABASE_URL" -f prisma/migrations/20260513120000_booking_hardening_v1/migration.sql
--      The column-add statements are idempotent so re-running is safe.
--
--   Path B — you switch to `prisma migrate`
--   ───────────────────────────────────────
--   1) Confirm `prisma/migrations/` is checked into git.
--   2) Run `npx prisma migrate resolve --applied <prior schema as baseline>`
--      to record the existing DB state without re-applying it.
--   3) Run `npx prisma migrate deploy` (or `migrate dev` locally).
--
-- WHY EXCLUDE INSTEAD OF UNIQUE:
--   The previous @@unique([assignedAdminId, scheduledAt]) only blocked
--   same-start collisions. A 60-min booking at 09:00 and a 60-min booking
--   at 09:30 against the same host would both succeed under the unique
--   constraint and silently overlap. The EXCLUDE constraint below uses
--   tstzrange(scheduledAt, endsAt) with the && (overlap) operator —
--   PostgreSQL rejects any active booking that overlaps an existing one.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Extension prerequisites ───────────────────────────────────────────────
-- btree_gist is required so that the equality predicate on assignedAdminId
-- (a non-range type) can participate in an EXCLUDE constraint alongside
-- the range-overlap operator. Ships with PostgreSQL contrib; idempotent.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── 2. New columns on "Service" (booking policy) ─────────────────────────────
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "bookingCancellationNoticeHours" INTEGER NOT NULL DEFAULT 12;

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "bookingRescheduleNoticeHours" INTEGER NOT NULL DEFAULT 12;

-- ── 3. New column on "Consultation" (revision counter for ICS SEQUENCE) ──────
ALTER TABLE "Consultation"
  ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 0;

-- Backfill: any consultation that was created as a reschedule (rescheduledFromId
-- is set) should already be at sequence 1 under the old boolean rule. Walk the
-- chain depth so SEQUENCE numbers match what the icsGenerator will emit going
-- forward. Idempotent — only updates rows where revision is still 0.
WITH RECURSIVE chain AS (
  SELECT id, "rescheduledFromId", 0 AS depth
    FROM "Consultation"
   WHERE "rescheduledFromId" IS NULL
  UNION ALL
  SELECT c.id, c."rescheduledFromId", chain.depth + 1
    FROM "Consultation" c
    JOIN chain ON c."rescheduledFromId" = chain.id
)
UPDATE "Consultation" c
   SET "revision" = chain.depth
  FROM chain
 WHERE c.id = chain.id
   AND c."revision" = 0
   AND chain.depth > 0;

-- ── 4. Drop the legacy same-start unique constraint ──────────────────────────
-- The EXCLUDE constraint below covers every case the unique did, plus
-- variable-duration overlaps. The constraint name follows Prisma's
-- conventional auto-generated form for @@unique on [assignedAdminId, scheduledAt].
ALTER TABLE "Consultation"
  DROP CONSTRAINT IF EXISTS "Consultation_assignedAdminId_scheduledAt_key";

-- ── 5. Overlap-prevention EXCLUDE constraint ─────────────────────────────────
-- Predicate-filtered: only ACTIVE bookings (pending/confirmed/scheduled)
-- consume host capacity. cancelled/completed/rescheduled/no_show rows do
-- not block new bookings — that's the correct product behaviour.
--
-- Range bound rule:
--   lower = scheduledAt
--   upper = endsAt (COALESCE'd to scheduledAt + durationMin*1min if NULL)
--   '[)' = half-open: a booking that ENDS at T does not collide with one
--          that STARTS at T. This matches the booking calendar UX where
--          back-to-back slots are allowed when buffer = 0.
--
-- Wrap in a DO block so that re-applying the migration after a prior
-- successful run does not raise "constraint already exists".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'consultation_no_overlap'
       AND conrelid = '"Consultation"'::regclass
  ) THEN
    ALTER TABLE "Consultation"
      ADD CONSTRAINT consultation_no_overlap
      EXCLUDE USING gist (
        "assignedAdminId" WITH =,
        tstzrange(
          "scheduledAt",
          COALESCE("endsAt", "scheduledAt" + ("durationMin" * interval '1 minute')),
          '[)'
        ) WITH &&
      )
      WHERE ("status" IN ('pending', 'confirmed', 'scheduled'));
  END IF;
END
$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (manual — keep alongside the migration in case you need it):
--
--   BEGIN;
--     ALTER TABLE "Consultation" DROP CONSTRAINT IF EXISTS consultation_no_overlap;
--     ALTER TABLE "Consultation"
--       ADD CONSTRAINT "Consultation_assignedAdminId_scheduledAt_key"
--       UNIQUE ("assignedAdminId", "scheduledAt");
--     ALTER TABLE "Consultation" DROP COLUMN IF EXISTS "revision";
--     ALTER TABLE "Service"      DROP COLUMN IF EXISTS "bookingRescheduleNoticeHours";
--     ALTER TABLE "Service"      DROP COLUMN IF EXISTS "bookingCancellationNoticeHours";
--   COMMIT;
--
-- The btree_gist extension is left in place because nothing forces its
-- removal and it has no behavioural side-effects on unrelated tables.
-- ─────────────────────────────────────────────────────────────────────────────
