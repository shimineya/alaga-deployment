-- ============================================================================
-- Migration: Add invite_status and invited_by to patient_access
--
-- Purpose:
--   Supports the new caregiver assignment acceptance workflow.
--   When a parent/admin invites a caregiver, a 'Pending' record is inserted.
--   The caregiver must Accept or Decline via the mobile app.
--   Only 'Active' records grant monitoring access.
--
-- [DPA] This implements an explicit consent step before linking a caregiver
--   to a patient's health data, satisfying the DPA of 2012 principle of
--   Legitimate Purpose and Consent.
-- [HIPAA] Audit trail entries are recorded on Pending, Accept, and Decline.
--
-- Run this ONCE against the ALAGA PostgreSQL database:
--   psql -U <your_user> -d <your_db> -f add_invite_status_to_patient_access.sql
-- ============================================================================

BEGIN;

-- Add invite_status: 'Active' (immediate/legacy), 'Pending' (awaiting response), 'Declined'
ALTER TABLE public.patient_access
    ADD COLUMN IF NOT EXISTS invite_status VARCHAR(20) NOT NULL DEFAULT 'Active';

-- Add invited_by: FK to the user who sent the invite (admin/parent)
ALTER TABLE public.patient_access
    ADD COLUMN IF NOT EXISTS invited_by INTEGER REFERENCES public.users(user_id) ON DELETE SET NULL;

-- All existing records are treated as already-accepted Active assignments
UPDATE public.patient_access SET invite_status = 'Active' WHERE invite_status IS NULL;

-- Index for fast lookup of pending invites per user (used by GET /pending-invites)
CREATE INDEX IF NOT EXISTS idx_patient_access_pending
    ON public.patient_access (user_id, invite_status)
    WHERE invite_status = 'Pending';

COMMIT;

-- NOTE: The GET /my-assignments query must be updated to filter WHERE invite_status = 'Active'
-- so that pending invitations do not appear in the active care list until accepted.
-- This is handled in the application layer in assignmentRoutes.js.
