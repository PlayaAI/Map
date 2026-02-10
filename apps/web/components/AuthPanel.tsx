"use client";

import { useState } from "react";
import { apiBase } from "../lib/api";

interface AuthPanelProps {
  onToken: (token: string) => void;
}

export function AuthPanel({ onToken }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function requestOtp() {
    setMessage(null);
    const response = await fetch(`${apiBase()}/api/auth/request-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = (await response.json()) as { debugCode?: string; error?: unknown };
    if (!response.ok) {
      setMessage("Could not request OTP. Check email format and try again.");
      return;
    }

    if (data.debugCode) {
      setCode(data.debugCode);
      setMessage(`OTP generated. Debug code: ${data.debugCode}`);
    } else {
      setMessage("OTP requested. Check your email.");
    }
  }

  async function verifyOtp() {
    setMessage(null);
    const response = await fetch(`${apiBase()}/api/auth/verify-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    const data = (await response.json()) as { token?: string; error?: unknown };
    if (!response.ok || !data.token) {
      setMessage("OTP verification failed.");
      return;
    }

    setToken(data.token);
    onToken(data.token);
    setMessage("Authenticated. Token set for this page session.");
  }

  return (
    <div className="panel stack-sm">
      <h3>Email OTP</h3>
      <label className="field">
        <span>Email</span>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@camp.org"
          type="email"
        />
      </label>
      <div className="inline-actions">
        <button type="button" onClick={requestOtp} className="btn-secondary">
          Request OTP
        </button>
      </div>

      <label className="field">
        <span>OTP Code</span>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="6 digits"
          inputMode="numeric"
        />
      </label>
      <div className="inline-actions">
        <button type="button" onClick={verifyOtp} className="btn-primary">
          Verify OTP
        </button>
      </div>

      {token ? (
        <label className="field">
          <span>Current Token</span>
          <textarea value={token} readOnly rows={3} />
        </label>
      ) : null}

      {message ? <p className="note">{message}</p> : null}
    </div>
  );
}
