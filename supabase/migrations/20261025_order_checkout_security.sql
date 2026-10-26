-- Apply in Supabase SQL Editor BEFORE deploying matching application code.
-- Review and back up production first. No existing paid orders are modified.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_session_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS stripe_payment_session_id text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_session_id_unique ON public.orders(checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_payment_session_id_unique ON public.orders(stripe_payment_session_id) WHERE stripe_payment_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.register_order_checkout(
 p_order_id uuid, p_user_id uuid, p_session_id text, p_amount_pence integer
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.orders%ROWTYPE;
BEGIN
 IF p_session_id IS NULL OR p_session_id !~ '^cs_(test|live)_' OR p_amount_pence <= 0 THEN RETURN 'invalid'; END IF;
 SELECT * INTO v FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v.user_id <> p_user_id OR v.currency <> 'GBP' OR v.amount_pence <> p_amount_pence THEN RETURN 'mismatch'; END IF;
 IF v.payment_status = 'paid' AND v.stripe_payment_session_id = p_session_id THEN RETURN 'already_confirmed'; END IF;
 IF v.payment_status <> 'unpaid' OR v.status <> 'awaiting_payment' THEN RETURN 'not_payable'; END IF;
 IF v.checkout_session_id IS NOT NULL AND v.checkout_session_id <> p_session_id THEN RETURN 'session_mismatch'; END IF;
 UPDATE public.orders SET checkout_session_id=p_session_id, updated_at=now() WHERE id=p_order_id;
 RETURN CASE WHEN v.checkout_session_id = p_session_id THEN 'already_registered' ELSE 'registered' END;
END $$;

CREATE OR REPLACE FUNCTION public.confirm_order_payment(
 p_order_id uuid, p_user_id uuid, p_session_id text, p_amount_pence integer
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.orders%ROWTYPE;
BEGIN
 IF p_session_id IS NULL OR p_session_id !~ '^cs_(test|live)_' OR p_amount_pence <= 0 THEN RETURN 'invalid'; END IF;
 SELECT * INTO v FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR v.user_id <> p_user_id OR v.currency <> 'GBP' OR v.amount_pence <> p_amount_pence THEN RETURN 'mismatch'; END IF;
 IF v.payment_status = 'paid' THEN
   IF v.stripe_payment_session_id = p_session_id THEN RETURN 'already_confirmed'; END IF;
   RETURN 'different_payment';
 END IF;
 IF v.payment_status <> 'unpaid' OR v.status <> 'awaiting_payment' THEN RETURN 'not_payable'; END IF;
 IF v.checkout_session_id IS DISTINCT FROM p_session_id THEN RETURN 'session_mismatch'; END IF;
 UPDATE public.orders SET checkout_session_id=p_session_id, stripe_payment_session_id=p_session_id,
   payment_status='paid', status='paid', updated_at=now() WHERE id=p_order_id;
 RETURN 'confirmed';
END $$;
REVOKE ALL ON FUNCTION public.register_order_checkout(uuid,uuid,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_order_payment(uuid,uuid,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_order_checkout(uuid,uuid,text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid,uuid,text,integer) TO service_role;
COMMIT;

