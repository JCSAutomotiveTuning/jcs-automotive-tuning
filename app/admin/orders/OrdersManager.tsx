
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Order = {
  id: string;
  user_id: string;
  service_code: string;
  service_name: string;
  amount_pence: number;
  currency: string;
  status: string;
  payment_status: string;
  vehicle_make: string;
  vehicle_model: string;
  engine_code: string | null;
  software_id: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  customer_email: string;
};

const statuses = [
  "awaiting_review",
  "awaiting_payment",
  "in_progress",
  "needs_customer_info",
  "qa_review",
  "completed",
  "cancelled",
  "failed",
] as const;

const quoteableServices = [
  "custom_ecu",
  "custom_tcu",
  "ecu_tcu_package",
];

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
}

function pounds(pence: number) {
  return (pence / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
  });
}

export default function OrdersManager({
  initialOrders,
}: {
  initialOrders: Order[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [selectedStatuses, setSelectedStatuses] = useState<
    Record<string, string>
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [quoteAmounts, setQuoteAmounts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function sendAction(
    order: Order,
    payload: Record<string, string | number | null>
  ) {
    setBusyId(order.id);
    setMessage("");

    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, ...payload }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Could not save this order.");
        return false;
      }

      if (result.order) {
        setOrders((current) =>
          current.map((item) =>
            item.id === order.id
              ? {
                  ...item,
                  amount_pence:
                    result.order.amount_pence ?? item.amount_pence,
                  status: result.order.status ?? item.status,
                  payment_status:
                    result.order.payment_status ?? item.payment_status,
                  admin_notes:
                    result.order.admin_notes ?? item.admin_notes,
                }
              : item
          )
        );
      }

      router.refresh();
      return true;
    } catch {
      setMessage("Network error. Please try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function saveOrder(order: Order) {
    const payload: Record<string, string | null> = {};
    const nextStatus = selectedStatuses[order.id];
    const nextNotes = notes[order.id];

    if (nextStatus !== undefined) payload.status = nextStatus;
    if (nextNotes !== undefined) {
      payload.adminNotes = nextNotes.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      setMessage("Make a status or notes change before saving.");
      return;
    }

    if (await sendAction(order, payload)) {
      setSelectedStatuses((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });

      setNotes((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });

      setMessage("Order saved successfully.");
    }
  }

  async function saveQuote(order: Order) {
    const raw = (
      quoteAmounts[order.id] ??
      (order.amount_pence / 100).toFixed(2)
    ).trim();

    if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
      setMessage("Enter a valid price, such as 180 or 180.00.");
      return;
    }

    const amountPence = Math.round(Number(raw) * 100);

    if (!Number.isSafeInteger(amountPence) || amountPence <= 0) {
      setMessage("The quote must be greater than £0.");
      return;
    }

    if (
      await sendAction(order, {
        action: "save_quote",
        quoteAmountPence: amountPence,
      })
    ) {
      setQuoteAmounts((current) => ({
        ...current,
        [order.id]: (amountPence / 100).toFixed(2),
      }));
      setMessage(`Quote saved: ${pounds(amountPence)}.`);
    }
  }

  async function requestPayment(order: Order) {
    if (
      !window.confirm(
        `Request payment of ${pounds(order.amount_pence)} for this order?`
      )
    ) {
      return;
    }

    if (
      await sendAction(order, {
        action: "request_payment",
      })
    ) {
      setMessage("Order is now awaiting payment.");
    }
  }

  if (orders.length === 0) {
    return <p className="muted">No customer orders found yet.</p>;
  }

  return (
    <div className="orders-manager">
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {orders.map((order) => {
        const canQuote = quoteableServices.includes(order.service_code);
        const canRequestPayment =
          order.status === "awaiting_review" &&
          order.payment_status === "unpaid" &&
          order.amount_pence > 0;

        const quoteEditingAllowed =
          order.status === "awaiting_review" &&
          order.payment_status === "unpaid";

        return (
          <article className="order-card" key={order.id}>
            <div className="order-card-header">
              <div>
                <h3>{order.service_name}</h3>
                <p className="muted">{order.customer_email}</p>
                <p className="muted">
                  Submitted {new Date(order.created_at).toLocaleString("en-GB")}
                </p>
              </div>
              <strong>{pounds(order.amount_pence)}</strong>
            </div>

            <div className="order-details">
              <p>
                <strong>Vehicle:</strong> {order.vehicle_make}{" "}
                {order.vehicle_model}
              </p>
              <p>
                <strong>Engine:</strong> {order.engine_code || "Not supplied"}
              </p>
              <p>
                <strong>Software ID:</strong>{" "}
                {order.software_id || "Not supplied"}
              </p>
              <p>
                <strong>Order status:</strong> {readable(order.status)}
              </p>
              <p>
                <strong>Payment:</strong> {readable(order.payment_status)}
              </p>
              <p>
                <strong>Order ID:</strong>{" "}
                <span className="order-id">{order.id}</span>
              </p>
            </div>

            {order.customer_notes && (
              <div className="order-notes">
                <strong>Customer notes</strong>
                <p>{order.customer_notes}</p>
              </div>
            )}

            <div className="order-edit">
              {canQuote && (
                <>
                  <label htmlFor={`quote-${order.id}`}>
                    Agreed quote (GBP)
                  </label>
                  <input
                    id={`quote-${order.id}`}
                    type="number"
                    min="0.01"
                    max="1000000"
                    step="0.01"
                    disabled={!quoteEditingAllowed || busyId === order.id}
                    placeholder="e.g. 180.00"
                    value={
                      quoteAmounts[order.id] ??
                      (order.amount_pence / 100).toFixed(2)
                    }
                    onChange={(event) =>
                      setQuoteAmounts((current) => ({
                        ...current,
                        [order.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={!quoteEditingAllowed || busyId === order.id}
                    onClick={() => saveQuote(order)}
                  >
                    {busyId === order.id ? "Saving..." : "Save quote"}
                  </button>
                  <p className="muted">
                    Save the agreed price before requesting payment.
                  </p>
                </>
              )}

              <label htmlFor={`status-${order.id}`}>Order status</label>
              <select
                id={`status-${order.id}`}
                value={selectedStatuses[order.id] ?? order.status}
                disabled={busyId === order.id}
                onChange={(event) =>
                  setSelectedStatuses((current) => ({
                    ...current,
                    [order.id]: event.target.value,
                  }))
                }
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {readable(status)}
                  </option>
                ))}
              </select>

              <label htmlFor={`notes-${order.id}`}>Internal admin notes</label>
              <textarea
                id={`notes-${order.id}`}
                rows={3}
                maxLength={3000}
                placeholder="Add internal notes about this job..."
                value={notes[order.id] ?? order.admin_notes ?? ""}
                disabled={busyId === order.id}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [order.id]: event.target.value,
                  }))
                }
              />

              <button
                className="button button-primary"
                type="button"
                disabled={busyId === order.id}
                onClick={() => saveOrder(order)}
              >
                {busyId === order.id ? "Saving..." : "Save order"}
              </button>

              {canRequestPayment && (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => requestPayment(order)}
                >
                  Request payment — {pounds(order.amount_pence)}
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
