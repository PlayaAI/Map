import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

function toLocalPath(input: string): string | null {
  if (input.startsWith("file://")) {
    try {
      return fileURLToPath(input);
    } catch {
      return null;
    }
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input)) {
    return null;
  }

  return input;
}

export async function fetchJson<T>(url: string): Promise<T> {
  const localPath = toLocalPath(url);
  if (localPath) {
    const content = await readFile(localPath, "utf8");
    return JSON.parse(content) as T;
  }

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchText(url: string): Promise<string> {
  const localPath = toLocalPath(url);
  if (localPath) {
    return readFile(localPath, "utf8");
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

export async function resourceExists(url: string): Promise<boolean> {
  const localPath = toLocalPath(url);
  if (localPath) {
    try {
      await access(localPath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  try {
    const response = await fetch(url, { method: "HEAD" });
    if (response.ok) {
      return true;
    }
    if (response.status === 403 || response.status === 405) {
      const fallback = await fetch(url, { method: "GET" });
      return fallback.ok;
    }
    return false;
  } catch {
    return false;
  }
}
