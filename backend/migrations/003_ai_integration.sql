-- =============================================================================
-- Migration 003: AI Integration Support Tables
-- Run this in pgAdmin 4 Query Tool against your alaga database.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Add device_token_hash to the existing device_whitelist table.
--    Each ESP32 device gets a unique hashed token for API authentication.
--    The plaintext token is stored in .env or provisioned to the device firmware.
--    [OWASP A07] Per-device authentication — replaces the single shared API key.
-- -----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.device_whitelist
    ADD COLUMN IF NOT EXISTS device_token_hash character varying(64);

COMMENT ON COLUMN public.device_whitelist.device_token_hash
    IS '[OWASP A07] SHA-256 hash of the device-specific API token. The plaintext token is provisioned to the ESP32 firmware and NEVER stored.';

-- -----------------------------------------------------------------------------
-- 2. Create patient_baselines table.
--    Persists the adaptive baseline learned from caregiver "Flag as Normal" actions.
--    Without this, the OC-SVM baseline resets on every Python service restart.
--    [DPA Art. 12 / GDPR Art. 5(1)(e)] Data is scoped per-patient and per-vital only.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patient_baselines
(
    baseline_id     SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL REFERENCES public.patients(patient_id) ON DELETE CASCADE,
    vital_name      VARCHAR(30) NOT NULL,
    flag_count      INTEGER NOT NULL DEFAULT 0,
    flagged_values  JSONB NOT NULL DEFAULT '[]'::jsonb,
    mean_value      NUMERIC(6, 2),
    upper_bound     NUMERIC(6, 2),
    lower_bound     NUMERIC(6, 2),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT patient_baselines_patient_vital_key UNIQUE (patient_id, vital_name)
);

COMMENT ON TABLE public.patient_baselines
    IS 'Stores the personalized adaptive baseline for the OC-SVM anomaly suppression layer. Each row tracks one vital sign (heart_rate, temperature, spo2) per patient.';

COMMENT ON COLUMN public.patient_baselines.flagged_values
    IS 'JSONB array of numeric readings the caregiver has flagged as normal. Used to compute mean/bounds after FLAG_THRESHOLD is reached.';

CREATE INDEX IF NOT EXISTS idx_patient_baselines_patient_id
    ON public.patient_baselines(patient_id);

COMMIT;
