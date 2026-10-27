"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminArea, Panel, Feedback, apiJson, dateTime } from "../_components/AdminArea";

type FileRow = {
  id: string;
  order_id: string;
  user_id: string;
  original_filename: string;
  size_bytes: number | null;
  kind: string | null;
  scan_status: string | null;
  delivery_status: string | null;
  created_at: string;
  customer_email: string;
  order: { id: string; service_name: string; vehicle_make: string; vehicle_model: string } | null;
};

function bytes(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export default function FilesManager() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [busyFile, setBusyFile] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiJson<{ files: FileRow[] }>("/api/admin/files");
      setFiles(result.files);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load files.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount; the promise callbacks update state asynchronously.
  // Keep reload() for the explicit Refresh button and post-adjustment refresh.
  useEffect(() => {
    let active = true;
    void apiJson<{ files: FileRow[] }>("/api/admin/files")
      .then((result) => {
        if (active) setFiles(result.files);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load files.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);
  const kinds = useMemo(() => Array.from(new Set(files.map((f) => f.kind ?? "unknown"))).sort(), [files]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files.filter((f) =>
      (kind === "all" || (f.kind ?? "unknown") === kind) &&
      (!needle || [f.original_filename, f.customer_email, f.order?.service_name ?? "", f.order?.vehicle_make ?? "", f.order?.vehicle_model ?? "", f.order_id]
        .some((value) => value.toLowerCase().includes(needle)))
    );
  }, [files, kind, query]);

  const changeApproval = async (
    file: FileRow,
    action: "approve" | "reject" | "reset"
  ) => {
    if (busyFile) return;

    const confirmed = window.confirm(
      `${action === "approve" ? "Approve" : action === "reject" ? "Reject" : "Reset to pending"} ${file.original_filename}?`
    );

    if (!confirmed) return;

    setBusyFile(file.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/admin/files/${encodeURIComponent(file.id)}/approval`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ action }),
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error || `Approval request failed (${response.status}).`
        );
      }

      await reload();

      setNotice(
        `${file.original_filename} ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "reset to pending"} successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update file approval."
      );
    } finally {
      setBusyFile(null);
    }
  };
  return (
    <AdminArea active="files" title="Tuning files" description="Review uploaded and completed ECU/TCU files. File downloads are deliberately not enabled without verifying storage permissions.">
      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-lg font-bold">File register</h2><p className="mt-1 text-xs text-slate-400">Most recent 300 files from your database</p></div>
          <button onClick={() => void reload()} disabled={loading} className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Refresh</button>
        </div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input aria-label="Search files" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search file, order or customer" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#090d14] px-4 py-3 text-sm text-white outline-none focus:border-sky-400" />
          <select aria-label="File kind" value={kind} onChange={(event) => setKind(event.target.value)} className="rounded-xl border border-white/10 bg-[#090d14] px-4 py-3 text-sm text-white">
            <option value="all">All file types</option>{kinds.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        {error && <Feedback message={error} error />}
        {notice && <Feedback message={notice} />}
        {loading ? <p className="py-10 text-center text-slate-400" role="status">Loading files…</p> : (
          <>
            <p className="mb-3 text-xs text-slate-400">Showing {filtered.length} of {files.length} files</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-3 pr-4">File</th><th className="py-3 pr-4">Customer</th><th className="py-3 pr-4">Vehicle / service</th><th className="py-3 pr-4">Type</th><th className="py-3 pr-4">Size</th><th className="py-3 pr-4">Scan</th><th className="py-3 pr-4">Approval</th><th className="py-3">Uploaded</th></tr></thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filtered.map((file) => <tr key={file.id} className="align-top text-slate-300">
                    <td className="py-4 pr-4"><span className="block max-w-[250px] break-all font-semibold text-white">{file.original_filename}</span><Link href="/admin/orders" className="mt-1 inline-block text-xs text-sky-300 hover:underline">View orders →</Link></td>
                    <td className="py-4 pr-4 break-all">{file.customer_email}</td>
                    <td className="py-4 pr-4">{file.order ? `${file.order.vehicle_make} ${file.order.vehicle_model} · ${file.order.service_name}` : "Order unavailable"}</td>
                    <td className="py-4 pr-4">{file.kind ?? "—"}</td><td className="py-4 pr-4">{bytes(file.size_bytes)}</td><td className="py-4 pr-4">{file.scan_status ?? "—"}</td><td className="py-4 pr-4">
  {file.kind === "completed_output" ? (
    <div className="flex min-w-[180px] flex-col gap-2">
      <span className="text-xs font-semibold">
        {file.delivery_status ?? "pending"}
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={
            busyFile !== null ||
            file.scan_status !== "clean" ||
            file.delivery_status === "approved"
          }
          title={
            file.scan_status !== "clean"
              ? "File has not passed safety validation."
              : "Approve finished file"
          }
          onClick={() => void changeApproval(file, "approve")}
          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busyFile === file.id ? "Working..." : "Approve"}
        </button>
        <button
          type="button"
          disabled={
            busyFile !== null ||
            file.delivery_status === "rejected"
          }
          onClick={() => void changeApproval(file, "reject")}
          className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-semibold text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reject
        </button>
        {file.delivery_status === "rejected" && (
          <button
            type="button"
            disabled={busyFile !== null}
            title="Return rejected file to pending review"
            onClick={() => void changeApproval(file, "reset")}
            className="rounded-lg border border-sky-400/40 px-3 py-1.5 text-xs font-semibold text-sky-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset to pending
          </button>
        )}
      </div>
    </div>
  ) : (
    <span className="text-xs text-slate-500">Not applicable</span>
  )}
</td><td className="py-4">{dateTime(file.created_at)}</td>
                  </tr>)}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No matching files.</p>}
            </div>
          </>
        )}
      </Panel>
    </AdminArea>
  );
}
