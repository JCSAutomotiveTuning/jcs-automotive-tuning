-- JCS Automotive Tuning
-- Make technical checkout recording safe when a Stripe webhook
-- confirms payment before the checkout route finishes.

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
    IF p_attempt_id IS NULL
       OR p_session_id IS NULL
       OR p_session_id = ''
       OR p_expires_at IS NULL THEN
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

    IF v_request.payment_status = 'paid'
       AND v_request.status = 'paid'
       AND v_request.checkout_attempt_id = p_attempt_id
       AND v_request.stripe_session_id = p_session_id
       AND v_request.checkout_session_id = p_session_id THEN
        RETURN true;
    END IF;

    IF v_request.status <> 'awaiting_payment'
       OR v_request.payment_status <> 'unpaid'
       OR v_request.checkout_attempt_id IS DISTINCT FROM p_attempt_id THEN
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