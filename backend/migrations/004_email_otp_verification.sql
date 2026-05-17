BEGIN;

CREATE TABLE IF NOT EXISTS public.user_email_otps
(
    otp_id bigserial PRIMARY KEY,
    user_id integer NOT NULL,
    email character varying(100) NOT NULL,
    otp_hash character varying(255) NOT NULL,
    purpose character varying(50) NOT NULL DEFAULT 'REGISTER_VERIFY',
    attempts_count integer NOT NULL DEFAULT 0,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_sent_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'user_email_otps_user_id_fkey'
    ) THEN
        ALTER TABLE public.user_email_otps
            ADD CONSTRAINT user_email_otps_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES public.users (user_id)
            ON UPDATE NO ACTION
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_email_otps_lookup
    ON public.user_email_otps (user_id, purpose, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_email_otps_active
    ON public.user_email_otps (user_id, email, purpose)
    WHERE consumed_at IS NULL;

COMMIT;
