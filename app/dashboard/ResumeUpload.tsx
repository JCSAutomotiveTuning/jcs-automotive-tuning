"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_FILE_BYTES = 16 * 1024 * 1024;
const EXTENSIONS = new Set([
  "bin", "ori", "hex", "frf", "odx", "txt", "csv", "log", "zip"
]);

export default function ResumeUpload({
  orderId
}: {
  orderId: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function uploadFile() {
    if (busy) return;

    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (!ext || !EXTENSIONS.has(ext)) {
      setMessage("Unsupported file type.");
      return;
    }

    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      setMessage("File must be between 1 byte and 16 MB.");
      return;
    }

    setBusy(true);
    setMessage("Preparing secure upload...");

    try {
      const up = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || "application/octet-stream"
        })
      });

      const signed = await up.json();

      if (!up.ok) {
        throw new Error(signed.error || "Could not prepare upload.");
      }

      setMessage("Uploading your file...");

      const transfer = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "false"
        },
        body: file
      });

      if (!transfer.ok) {
        throw new Error("File transfer failed.");
      }

      setMessage("Confirming file and wallet payment...");

      const complete = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          path: signed.path,
          fileName: file.name,
          fileSize: file.size
        })
      });

      const result = await complete.json();

      if (!complete.ok) {
        throw new Error(result.error || "Could not complete upload.");
      }

      setMessage("File submitted successfully. Refreshing order...");
      setFile(null);
      router.refresh();

    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Upload failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      border: "1px solid #64748b55",
      borderRadius: 12,
      padding: 14,
      marginTop: 14,
      display: "grid",
      gap: 10
    }}>
      <strong>Resume existing order</strong>

      <input
        type="file"
        accept=".bin,.ori,.hex,.frf,.odx,.txt,.csv,.log,.zip"
        disabled={busy}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button
        type="button"
        className="btn"
        disabled={busy || !file}
        onClick={uploadFile}
      >
        {busy ? "Uploading..." : "Resume Upload"}
      </button>

      {message && (
        <p role="status" aria-live="polite">{message}</p>
      )}
    </div>
  );
}
