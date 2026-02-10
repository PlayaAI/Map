"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AuthPanel } from "../../components/AuthPanel";
import { apiBase } from "../../lib/api";

export default function SubmitPage() {
  const [token, setToken] = useState("");
  const [entityId, setEntityId] = useState("");
  const [usesAi, setUsesAi] = useState(true);
  const [techFreeZone, setTechFreeZone] = useState(false);
  const [categories, setCategories] = useState<string[]>(["ai_art"]);
  const [toolsText, setToolsText] = useState("");
  const [humanLeadDescription, setHumanLeadDescription] = useState("");
  const [disclosureText, setDisclosureText] = useState("");
  const [reason, setReason] = useState("");
  const [responseMessage, setResponseMessage] = useState<string | null>(null);

  const tools = useMemo(
    () =>
      toolsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [toolsText],
  );

  function toggleCategory(category: string) {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  async function submitDisclosure(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResponseMessage(null);

    const response = await fetch(`${apiBase()}/api/submissions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        entityId,
        reason,
        aiDisclosure: {
          usesAi,
          aiCategories: categories,
          tools,
          humanLeadDescription,
          techFreeZone,
          disclosureText,
        },
      }),
    });

    const body = (await response.json()) as { error?: unknown; submission?: { id: string } };

    if (!response.ok) {
      setResponseMessage(`Submission failed: ${JSON.stringify(body.error)}`);
      return;
    }

    setResponseMessage(`Submission created and queued for moderation: ${body.submission?.id}`);
  }

  return (
    <main className="form-shell">
      <Link href="/">Back to map</Link>
      <h1>Submit AI Disclosure Update</h1>
      <p className="note">All submissions are pre-moderated before becoming public.</p>

      <AuthPanel onToken={setToken} />

      <form className="panel stack-sm" style={{ padding: 16 }} onSubmit={submitDisclosure}>
        <label className="field">
          <span>Entity ID (UUID)</span>
          <input value={entityId} onChange={(event) => setEntityId(event.target.value)} required />
        </label>

        <label className="field">
          <span>Reason for update</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why this disclosure should be updated"
          />
        </label>

        <div className="checkbox-row">
          <label>
            <input type="checkbox" checked={usesAi} onChange={(event) => setUsesAi(event.target.checked)} />
            Uses AI
          </label>
          <label>
            <input
              type="checkbox"
              checked={techFreeZone}
              onChange={(event) => setTechFreeZone(event.target.checked)}
            />
            Tech-Free Zone
          </label>
        </div>

        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={categories.includes("ai_art")}
              onChange={() => toggleCategory("ai_art")}
            />
            AI Art
          </label>
          <label>
            <input
              type="checkbox"
              checked={categories.includes("workshop")}
              onChange={() => toggleCategory("workshop")}
            />
            Workshop
          </label>
        </div>

        <label className="field">
          <span>Tools (comma-separated)</span>
          <input
            value={toolsText}
            onChange={(event) => setToolsText(event.target.value)}
            placeholder="ComfyUI, Midjourney, custom model"
          />
        </label>

        <label className="field">
          <span>Human-led process note</span>
          <textarea
            rows={3}
            value={humanLeadDescription}
            onChange={(event) => setHumanLeadDescription(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Disclosure text shown publicly</span>
          <textarea
            rows={3}
            value={disclosureText}
            onChange={(event) => setDisclosureText(event.target.value)}
          />
        </label>

        <button type="submit" className="btn-primary">
          Submit for review
        </button>
      </form>

      {responseMessage ? <p className="panel" style={{ padding: 12 }}>{responseMessage}</p> : null}
    </main>
  );
}
