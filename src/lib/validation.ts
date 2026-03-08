const GITHUB_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const GITHUB_MAX = 39;
const SOURCE_MAX_BYTES = 16_000;

export function validateGithub(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: "GitHub username is required" };
  if (value.length > GITHUB_MAX) {
    return { ok: false, error: `GitHub usernames max out at ${GITHUB_MAX} characters` };
  }
  if (!GITHUB_RE.test(value)) {
    return {
      ok: false,
      error: "GitHub usernames may only contain letters, numbers, and hyphens",
    };
  }
  return { ok: true, value };
}

export function validateDraftSource(
  raw: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.replace(/\r\n/g, "\n").trim();
  if (!value) return { ok: false, error: "Paste a `connect(input)` policy first." };
  if (new TextEncoder().encode(value).length > SOURCE_MAX_BYTES) {
    return { ok: false, error: "Operator policy exceeds the 16 KB draft limit." };
  }
  return { ok: true, value };
}

export function isDesktopUserAgent(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent,
  );
}

export function normalizeSearchParam(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  return value.length ? value : null;
}
