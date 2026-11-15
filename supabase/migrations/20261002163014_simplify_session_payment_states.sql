-- Retire tentative bookings, preserving money, recurrence and sharing choices.
-- This relabelling does not change the performance schedule: avoid false notifications.
ALTER TABLE public.sessions DISABLE TRIGGER notify_session_updates;
UPDATE public.sessions SET status = 'confirmed' WHERE status = 'pending' OR status IS NULL;
ALTER TABLE public.sessions ENABLE TRIGGER notify_session_updates;
ALTER TABLE public.sessions ALTER COLUMN status SET DEFAULT 'confirmed';

-- Older clients and series RPCs may still submit 'pending'. Keep one active state.
CREATE OR REPLACE FUNCTION public.normalize_session_active_state()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF NEW.status IS NULL OR NEW.status = 'pending' THEN NEW.status := 'confirmed'; END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.normalize_session_active_state() FROM PUBLIC;
CREATE TRIGGER normalize_session_active_state
BEFORE INSERT OR UPDATE OF status ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.normalize_session_active_state();
