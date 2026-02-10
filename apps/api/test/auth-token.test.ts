import { describe, expect, it } from "vitest";
import { createAuthToken, verifyAuthToken } from "../src/lib/auth-token.js";

describe("auth token", () => {
  it("creates and verifies token", () => {
    const token = createAuthToken(
      { id: "user-1", role: "user", email: "u@example.com" },
      "secret",
      60,
    );

    const payload = verifyAuthToken(token, "secret");
    expect(payload?.sub).toBe("user-1");
    expect(payload?.email).toBe("u@example.com");
  });

  it("rejects invalid signature", () => {
    const token = createAuthToken(
      { id: "user-1", role: "user", email: "u@example.com" },
      "secret",
      60,
    );
    expect(verifyAuthToken(token, "wrong")).toBeNull();
  });
});
