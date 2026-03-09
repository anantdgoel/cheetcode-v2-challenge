'use client'

export default function RootError ({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className='report-shell' style={{ textAlign: 'center', paddingTop: '120px' }}>
      <h2 style={{ color: 'var(--ink)', marginBottom: '12px' }}>Something went wrong</h2>
      <p style={{ color: 'var(--muted-ink)', marginBottom: '24px' }}>
        {error.message || 'An unexpected error occurred.'}
      </p>
      <button className='app-button' onClick={reset}>Try again</button>
    </main>
  )
}
