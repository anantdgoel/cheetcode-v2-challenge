const SOURCE_MAX_BYTES = 16_000

export function validateDraftSource (
  raw: string
): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.replace(/\r\n/g, '\n').trim()
  if (!value) return { ok: false, error: 'Paste a `connect(input)` policy first.' }
  if (new TextEncoder().encode(value).length > SOURCE_MAX_BYTES) {
    return { ok: false, error: 'Operator policy exceeds the 16 KB draft limit.' }
  }
  return { ok: true, value }
}
