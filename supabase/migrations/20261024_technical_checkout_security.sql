-- JCS Automotive Tuning
-- Technical request Checkout security
-- Additive migration; safe for existing technical request records.

ALTER TABLE public.technical_requests
    ADD COLUMN IF NOT EXISTS checkout_session_id text,
    ADD COLUMN IF NOT EXISTS checkout_session_expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS checkout_attempt_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS technical_requests_checkout_session_unique
    ON public.technical_requests (checkout_session_id)
    WHERE checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS technical_requests_checkout_expiry_idx
    ON public.technical_requests (checkout_session_expires_at)
    WHERE payment_status = 'unpaid';

CREATE OR REPLACE FUNCTION public.reserve_technical_checkout(
    p_request_id uuid,
    p_user_id uuid
)
RETURNS TABLE (
    attempt_id uuid,
    session_id text,
    session_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request public.technical_requests%ROWTYPE;
    v_attempt uuid;
BEGIN
    SELECT *
    INTO v_request
    FROM public.technical_requests
    WHERE id = p_request_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Technical request not found';
    END IF;

    IF v_request.status <> 'awaiting_payment'
       OR v_request.payment_status <> 'unpaid'
       OR v_request.amount_pence <> 1500
       OR v_request.currency <> 'GBP' THEN
        RAISE EXCEPTION 'Technical request is not payable';
    END IF;

    IF v_request.checkout_attempt_id IS NOT NULL THEN
        RETURN QUERY
        SELECT
            v_request.checkout_attempt_id,
            v_request.checkout_session_id,
            v_request.checkout_session_expires_at;
        RETURN;
    END IF;

    v_attempt := gen_random_uuid();

    UPDATE public.technical_requests
    SET checkout_attempt_id = v_attempt,
        checkout_session_id = NULL,
        checkout_session_expires_at = NULL,
        updated_at = now()
    WHERE id = p_request_id;

    RETURN QUERY
    SELECT v_attempt, NULL::text, NULL::timestamptz;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_technical_checkout(uuid, uuid)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reserve_technical_checkout(uuid, uuid)
    TO service_role;

CREATE OR REPLACE FUNCTION public.record_technical_checkout(
    p_request_id uuid,
    p_user_id uuid,
    p_attempt_id uuid,
    p_session_id text,
    p_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request public.technical_requests%ROWTYPE;
BEGIN
    SELECT *
    INTO v_request
    FROM public.technical_requests
    WHERE id = p_request_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_request.status <> 'awaiting_payment'
       OR v_request.payment_status <> 'unpaid'
       OR v_request.checkout_attempt_id IS DISTINCT FROM p_attempt_id
       OR p_session_id IS NULL
       OR p_expires_at IS NULL THEN
        RETURN false;
    END IF;

    IF v_request.checkout_session_id IS NOT NULL
       AND v_request.checkout_session_id <> p_session_id THEN
        RETURN false;
    END IF;

    UPDATE public.technical_requests
    SET checkout_session_id = p_session_id,
        checkout_session_expires_at = p_expires_at,
        updated_at = now()
    WHERE id = p_request_id;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_technical_checkout(
    uuid, uuid, uuid, text, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.record_technical_checkout(
    uuid, uuid, uuid, text, timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_technical_payment(
    p_request_id uuid,
    p_user_id uuid,
    p_attempt_id uuid,
    p_session_id text,
    p_amount_pence integer,
    p_currency text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request public.technical_requests%ROWTYPE;
BEGIN
    IF p_session_id IS NULL OR length(p_session_id) < 5
       OR p_attempt_id IS NULL THEN
        RETURN 'invalid_reference';
    END IF;

    SELECT *
    INTO v_request
    FROM public.technical_requests
    WHERE id = p_request_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN 'not_found';
    END IF;

    IF v_request.user_id <> p_user_id
       OR v_request.amount_pence <> p_amount_pence
       OR v_request.currency <> upper(p_currency)
       OR p_amount_pence <> 1500
       OR upper(p_currency) <> 'GBP' THEN
        RETURN 'payment_mismatch';
    END IF;

    IF v_request.payment_status = 'paid' THEN
        IF v_request.stripe_session_id = p_session_id
           AND v_request.checkout_attempt_id = p_attempt_id THEN
            RETURN 'already_confirmed';
        END IF;

        RETURN 'different_payment';
    END IF;

    IF v_request.payment_status <> 'unpaid'
       OR v_request.status <> 'awaiting_payment' THEN
        RETURN 'invalid_state';
    END IF;

    IF v_request.checkout_attempt_id IS DISTINCT FROM p_attempt_id THEN
        RETURN 'attempt_mismatch';
    END IF;

    IF v_request.checkout_session_id IS NOT NULL
       AND v_request.checkout_session_id <> p_session_id THEN
        RETURN 'session_mismatch';
    END IF;

    UPDATE public.technical_requests
    SET payment_status = 'paid',
        status = 'paid',
        stripe_session_id = p_session_id,
        checkout_session_id = p_session_id,
        updated_at = now()
    WHERE id = p_request_id;

    RETURN 'confirmed';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_technical_payment(
    uuid, uuid, uuid, text, integer, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_technical_payment(
    uuid, uuid, uuid, text, integer, text
) TO service_role;

-- Reset an expired and unpaid Checkout attempt.
-- The calling server must first verify the session with Stripe.

CREATE OR REPLACE FUNCTION public.reset_expired_technical_checkout(
    p_request_id uuid,
    p_user_id uuid,
    p_attempt_id uuid,
    p_session_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_request public.technical_requests%ROWTYPE;
BEGIN
    IF p_attempt_id IS NULL
       OR p_session_id IS NULL
       OR p_session_id = '' THEN
        RETURN false;
    END IF;

    SELECT *
    INTO v_request
    FROM public.technical_requests
    WHERE id = p_request_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_request.status <> 'awaiting_payment'
       OR v_request.payment_status <> 'unpaid'
       OR v_request.checkout_attempt_id IS DISTINCT FROM p_attempt_id
       OR v_request.checkout_session_id IS DISTINCT FROM p_session_id
       OR v_request.checkout_session_expires_at IS NULL
       OR v_request.checkout_session_expires_at > now() THEN
        RETURN false;
    END IF;

    UPDATE public.technical_requests
    SET checkout_attempt_id = NULL,
        checkout_session_id = NULL,
        checkout_session_expires_at = NULL,
        updated_at = now()
    WHERE id = p_request_id;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_expired_technical_checkout(
    uuid, uuid, uuid, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reset_expired_technical_checkout(
    uuid, uuid, uuid, text
) TO service_role;
