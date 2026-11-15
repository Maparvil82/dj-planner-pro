-- Existing sessions start with zero recorded payments: historical earnings
-- do not prove that money was received.
ALTER TABLE public.sessions
    ADD COLUMN amount_paid numeric(12,2) NOT NULL DEFAULT 0
    CHECK (amount_paid >= 0 AND amount_paid <> 'NaN'::numeric);

COMMENT ON COLUMN public.sessions.amount_paid IS 'Total received for this session, in its currency. Explicitly recorded by the owner.';

-- The app already offers quarterly and six-month recurrence, but the legacy
-- database constraint rejected both.
ALTER TABLE public.sessions DROP CONSTRAINT sessions_recurrence_type_check;
ALTER TABLE public.sessions ADD CONSTRAINT sessions_recurrence_type_check
    CHECK (recurrence_type IN ('none', 'daily', 'weekly', 'monthly', 'quarterly', 'biannually', 'yearly'));
