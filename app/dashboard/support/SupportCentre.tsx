"use client";

import { useCallback, useEffect, useState } from "react";

type OrderOption = {
  id: string;
  service_name: string;
  vehicle_make: string;
  vehicle_model: string;
  engine_code: string | null;
};

type Ticket = {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  order_id: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
};

type Props = {
  orders: OrderOption[];
};

const categories = [
  { value: "general", label: "General enquiry" },
  { value: "ecu_tuning", label: "ECU tuning" },
  { value: "dsg_tcu", label: "DSG / TCU tuning" },
  { value: "diagnostics", label: "Diagnostics and fault codes" },
  { value: "file_upload", label: "File upload or download" },
  { value: "payment", label: "Payment or order" },
  { value: "other", label: "Other" },
];

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid var(--border, #d1d5db)",
  borderRadius: "8px",
  font: "inherit",
  color: "#111827",
  background: "#ffffff",
  boxSizing: "border-box",
};

function readable(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateLabel(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-GB");
}

export default function SupportCentre({ orders }: Props) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("normal");
  const [orderId, setOrderId] = useState("");
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTickets = useCallback(async () => {

    try {
      const response = await fetch("/api/support/tickets", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not load your tickets.");
      }

      setTickets(result.tickets ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load your support tickets."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = Promise.resolve().then(() => loadTickets());

    void timer;
  }, [loadTickets]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          category,
          priority,
          orderId: orderId || null,
          message,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not create your ticket.");
      }

      setSubject("");
      setCategory("general");
      setPriority("normal");
      setOrderId("");
      setMessage("");

      setSuccess(
        `Your support ticket has been created. Reference: ${result.ticket.id}`
      );

      await loadTickets();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="two" style={{ alignItems: "start" }}>
      <section className="card">
        <div className="eyebrow">CUSTOMER SUPPORT</div>
        <h2>Open a ticket</h2>
        <p>
          Tell us what you need help with. Include relevant fault codes,
          software IDs and diagnostic details in your message.
        </p>

        <form
          onSubmit={handleSubmit}
          style={{ display: "grid", gap: "16px" }}
        >
          <label style={{ display: "grid", gap: "6px" }}>
            <strong>Subject</strong>
            <input
              style={fieldStyle}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              minLength={5}
              maxLength={200}
              placeholder="e.g. DSG 1â€“2 shift issue"
              required
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <strong>Support category</strong>
            <select
              style={fieldStyle}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <strong>Priority</strong>
            <select
              style={fieldStyle}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <strong>Related order (optional)</strong>
            <select
              style={fieldStyle}
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
            >
              <option value="">Not related to an order</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.service_name} â€” {order.vehicle_make}{" "}
                  {order.vehicle_model} ({order.id.slice(0, 8)})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <strong>Describe the issue</strong>
            <textarea
              style={{ ...fieldStyle, minHeight: "150px", resize: "vertical" }}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              minLength={1}
              maxLength={10000}
              placeholder="Explain the issue and what you have already checked..."
              required
            />
          </label>

          {error && (
            <p role="alert" style={{ color: "#dc2626" }}>
              {error}
            </p>
          )}

          {success && (
            <p role="status" style={{ overflowWrap: "anywhere" }}>
              {success}
            </p>
          )}

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Creating ticket..." : "Submit support ticket"}
          </button>
        </form>
      </section>

      <section className="card">
        <div className="eyebrow">YOUR REQUESTS</div>
        <h2>My support tickets</h2>
        <p>View the status and latest activity of your support requests.</p>

        {loading ? (
          <p>Loading your tickets...</p>
        ) : tickets.length === 0 ? (
          <p>You have not created any support tickets yet.</p>
        ) : (
          <div className="stack">
            {tickets.map((ticket) => (
              <article className="order-entry" key={ticket.id}>
                <div className="row">
                  <strong>{ticket.subject}</strong>
                  <span className="order-badge">
                    {readable(ticket.status)}
                  </span>
                </div>

                <p className="order-detail">
                  Category: {readable(ticket.category)}
                </p>

                <p className="order-detail">
                  Priority: {readable(ticket.priority)}
                </p>

                {ticket.order_id && (
                  <p className="order-detail">
                    Related order: {ticket.order_id.slice(0, 8)}
                  </p>
                )}

                <small>
                  Ticket {ticket.id.slice(0, 8)} Â· Created{" "}
                  {dateLabel(ticket.created_at)}
                </small>
              </article>
            ))}
          </div>
        )}

        <button
          className="btn secondary"
          type="button"
          onClick={() => void loadTickets()}
          disabled={loading}
          style={{ marginTop: "16px" }}
        >
          Refresh tickets
        </button>
      </section>
    </div>
  );
}