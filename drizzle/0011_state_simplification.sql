-- State simplification: remove schedule_review_pending, schedule_review_confirmed statuses
-- and remove completed phase.
-- PostgreSQL doesn't support removing enum values, so we cast to text, drop/recreate, cast back.

-- 1. member_status_enum: remove schedule_review_pending, schedule_review_confirmed
UPDATE member SET status = 'preferences_set' WHERE status IN ('schedule_review_pending', 'schedule_review_confirmed');
ALTER TABLE member ALTER COLUMN status TYPE text;
DROP TYPE member_status_enum;
CREATE TYPE member_status_enum AS ENUM ('pending_approval', 'denied', 'joined', 'preferences_set');
ALTER TABLE member ALTER COLUMN status TYPE member_status_enum USING status::member_status_enum;

-- 2. group_phase_enum: remove completed
UPDATE groups SET phase = 'schedule_review' WHERE phase = 'completed';
ALTER TABLE groups ALTER COLUMN phase TYPE text;
DROP TYPE group_phase_enum;
CREATE TYPE group_phase_enum AS ENUM ('preferences', 'schedule_review');
ALTER TABLE groups ALTER COLUMN phase TYPE group_phase_enum USING phase::group_phase_enum;
