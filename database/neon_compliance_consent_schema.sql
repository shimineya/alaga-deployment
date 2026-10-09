-- ==============================================================================
-- ALAGA HEALTHCARE MONITORING SYSTEM — NEON DB COMPLIANCE & CONSENT MIGRATION
-- Target: Neon PostgreSQL (Lakebase / Cloud PostgreSQL)
-- Description: Adds persistent compliance consent tracking, agreement versioning,
--              and audit logs for Terms of Service, Privacy Policy, Telemetry Consent,
--              AI Decision-Support Disclaimer, Staff NDA/AUA, and Emergency Protocols.
-- ==============================================================================

-- 1. Add consent tracking columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS consent_agreed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS consent_version VARCHAR(20) DEFAULT NULL;

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS must_accept_terms BOOLEAN DEFAULT TRUE;

-- 2. Create user_consents audit table
CREATE TABLE IF NOT EXISTS public.user_consents (
    consent_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    consent_version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
    forms_accepted JSONB NOT NULL DEFAULT '[]'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    agreed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_agreed_at ON public.user_consents(agreed_at);

-- 3. Comments for Clinical & Legal Auditability (Philippine DPA / HIPAA Compliance)
COMMENT ON TABLE public.user_consents IS 'Permanent audit log of legal, privacy, and clinical telemetry consents accepted by users.';
COMMENT ON COLUMN public.user_consents.forms_accepted IS 'Array of accepted form keys: terms_and_conditions, privacy_policy, telemetry_authorization, ai_decision_support_disclaimer, staff_nda_acceptable_use, emergency_escalation_protocol.';
COMMENT ON COLUMN public.users.must_accept_terms IS 'Flag indicating whether a newly provisioned or active user is required to scroll and accept compliance agreements before entering the system.';
