"use client";

import Link from "next/link";
import { useState } from "react";
import { apiBase } from "../../../lib/api";

type QueueItem = {
  type: "submission" | "claim";
  id: string;
  created_at: string;
  payload: unknown;
  reason: string | null;
  entity_id: string;
  entity_name: string;
  user_id: string;
  user_email: string;
};

export default function ModerationPage() {
  const [token, setToken] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [trustById, setTrustById] = useState<Record<string, boolean>>({});

  async function loadQueue() {
    setMessage(null);
    const response = await fetch(`${apiBase()}/api/moderation/queue`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    const body = (await response.json()) as { queue?: QueueItem[]; error?: unknown };
    if (!response.ok || !body.queue) {
      setMessage(`Failed to load queue: ${JSON.stringify(body.error)}`);
      return;
    }

    setQueue(body.queue);
  }

  async function decide(item: QueueItem, decision: "approve" | "reject") {
    setMessage(null);
    const response = await fetch(`${apiBase()}/api/moderation/${item.id}/${decision}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: item.type,
        note: noteById[item.id] ?? "",
        trustUser: trustById[item.id] ?? false,
      }),
    });

    const body = (await response.json()) as { ok?: boolean; error?: unknown };
    if (!response.ok || !body.ok) {
      setMessage(`Decision failed: ${JSON.stringify(body.error)}`);
      return;
    }

    setQueue((current) => current.filter((queued) => queued.id !== item.id));
    setMessage(`Decision saved for ${item.id}`);
  }

  return (
    <main className="form-shell">
      <Link href="/">Back to map</Link>
      <h1>Admin Moderation Queue</h1>

      <section className="panel stack-sm" style={{ padding: 16 }}>
        <label className="field">
          <span>Admin Bearer Token</span>
          <textarea
            rows={3}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Bearer token from OTP auth"
          />
        </label>
        <button type="button" className="btn-primary" onClick={loadQueue}>
          Load queue
        </button>
      </section>

      {message ? <p className="panel" style={{ padding: 12 }}>{message}</p> : null}

      <section className="stack-sm">
        {queue.map((item) => (
          <article key={item.id} className="panel stack-sm" style={{ padding: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>{item.type.toUpperCase()}</h2>
              <p className="meta">
                {item.entity_name} ({item.entity_id}) by {item.user_email}
              </p>
              <p className="meta">Created: {new Date(item.created_at).toLocaleString()}</p>
            </div>

            <pre
              style={{
                margin: 0,
                overflowX: "auto",
                border: "1px solid var(--border)",
                borderRadius: 12,
                background: "#f7f3e8",
                padding: 10,
                fontSize: 12,
              }}
            >
              {JSON.stringify(item.payload, null, 2)}
            </pre>

            <label className="field">
              <span>Moderator note</span>
              <textarea
                rows={2}
                value={noteById[item.id] ?? ""}
                onChange={(event) =>
                  setNoteById((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
              />
            </label>

            {item.type === "claim" ? (
              <label>
                <input
                  type="checkbox"
                  checked={trustById[item.id] ?? false}
                  onChange={(event) =>
                    setTrustById((current) => ({
                      ...current,
                      [item.id]: event.target.checked,
                    }))
                  }
                />
                Mark user as trusted
              </label>
            ) : null}

            <div className="inline-actions">
              <button type="button" className="btn-primary" onClick={() => decide(item, "approve")}>
                Approve
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => decide(item, "reject")}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
