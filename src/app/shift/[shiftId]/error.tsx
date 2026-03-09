'use client'

export default function ShiftError ({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className='report-shell' style={{ textAlign: 'center', paddingTop: '120px' }}>
      <h2 style={{ color: 'var(--ink)', marginBottom: '12px' }}>Connection lost</h2>
      <p style={{ color: 'var(--muted-ink)', marginBottom: '24px' }}>
        Your work is saved. Reload to reconnect.
      </p>
      <button className='app-button' onClick={reset}>Reload</button>
    </main>
  )
}
