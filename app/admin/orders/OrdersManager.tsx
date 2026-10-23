
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Order = {
  id: string;
  user_id: string;
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
  "paid",
  "in_progress",
  "needs_customer_info",
  "qa_review",
  "completed",
  "cancelled",
  "failed",
] as const;

function readable(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function saveOrder(order: Order) {
    setBusyId(order.id);
    setMessage("");

    const payload: {
      orderId: string;
      status?: string;
      adminNotes?: string | null;
    } = { orderId: order.id };

    const nextStatus = selectedStatuses[order.id];
    const nextNotes = notes[order.id];

    if (nextStatus !== undefined) payload.status = nextStatus;
    if (nextNotes !== undefined) payload.adminNotes = nextNotes.trim() || null;

    if (payload.status === undefined && payload.adminNotes === undefined) {
      setMessage("Make a status or notes change before saving.");
      setBusyId(null);
      return;
    }

    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Could not save this order.");
        setBusyId(null);
        return;
      }

      setOrders((current) =>
        current.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: result.order.status,
                admin_notes: result.order.admin_notes,
              }
            : item
        )
      );

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
      router.refresh();
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setBusyId(null);
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

      {orders.map((order) => (
        <article className="order-card" key={order.id}>
          <div className="order-card-header">
            <div>
              <h3>{order.service_name}</h3>
              <p className="muted">{order.customer_email}</p>
              <p className="muted">
                Submitted {new Date(order.created_at).toLocaleString("en-GB")}
              </p>
            </div>
            <strong>
              {(order.amount_pence / 100).toLocaleString("en-GB", {
                style: "currency",
                currency: order.currency || "GBP",
              })}
            </strong>
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
              <strong>Software ID:</strong> {order.software_id || "Not supplied"}
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
            <label htmlFor={`status-${order.id}`}>Order status</label>
            <select
              id={`status-${order.id}`}
              value={selectedStatuses[order.id] ?? order.status}
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
          </div>
        </article>
      ))}
    </div>
  );
}
