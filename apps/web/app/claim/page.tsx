"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthPanel } from "../../components/AuthPanel";
import { apiBase } from "../../lib/api";

export default function ClaimPage() {
  const [token, setToken] = useState("");
  const [entityId, setEntityId] = useState("");
  const [proof, setProof] = useState("");
  const [notes, setNotes] = useState("");
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  async function submitClaim(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResponseMessage(null);

    const response = await fetch(`${apiBase()}/api/claims`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ entityId, proof, notes }),
    });

    const body = (await response.json()) as { error?: unknown; claim?: { id: string } };

    if (!response.ok) {
      setResponseMessage(`Claim failed: ${JSON.stringify(body.error)}`);
      return;
    }

    setResponseMessage(`Claim queued for moderation: ${body.claim?.id}`);
  }

  return (
    <main className="form-shell">
      <Link href="/">Back to map</Link>
      <h1>Claim a Camp or Art Listing</h1>
      <p className="note">Claims are reviewed by admins before ownership is assigned.</p>

      <AuthPanel onToken={setToken} />

      <form className="panel stack-sm" style={{ padding: 16 }} onSubmit={submitClaim}>
        <label className="field">
          <span>Entity ID (UUID)</span>
          <input value={entityId} onChange={(event) => setEntityId(event.target.value)} required />
        </label>

        <label className="field">
          <span>Proof of ownership</span>
          <textarea
            rows={3}
            value={proof}
            onChange={(event) => setProof(event.target.value)}
            placeholder="Camp announcement URL, org email, or placement record"
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>

        <button type="submit" className="btn-primary">
          Submit claim
        </button>
      </form>

      {responseMessage ? <p className="panel" style={{ padding: 12 }}>{responseMessage}</p> : null}
    </main>
  );
}
