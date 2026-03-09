'use client'

import { formatPercent, formatTitle } from '@/core/engine/report'
import type { AdminCandidatePage } from '@/core/domain/views'
import { AdminAvatar } from './AdminAvatar'
import { useRouter } from 'next/navigation'

function timeAgo (ts: number) {
  const diff = Date.now() - ts
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function AdminTableView ({ data }: { data: AdminCandidatePage }) {
  const router = useRouter()

  function goNext () {
    if (!data.nextCursor || data.isDone) return
    const params = new URLSearchParams()
    params.set('cursor', data.nextCursor)
    params.set('start', String(data.startRank + data.rows.length))
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <section className='admin-panel'>
      <div className='section-heading'>
        <div>
          <p className='eyebrow'>Internal Operations</p>
          <h1>Candidate Board</h1>
        </div>
        <p className='admin-count'>{data.totalEntries} candidates</p>
      </div>

      <div className='admin-table-wrap'>
        <table className='admin-table'>
          <thead>
            <tr>
              <th className='col-rank'>#</th>
              <th className='col-callsign'>Callsign</th>
              <th className='col-title'>Classification</th>
              <th className='col-efficiency'>Efficiency</th>
              <th className='col-score'>Score</th>
              <th className='col-shifts'>Shifts</th>
              <th className='col-contact'>Contact</th>
              <th className='col-active'>Last Active</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr
                key={row.github}
                className='admin-table-row'
                onClick={() => { router.push(`/admin?candidate=${encodeURIComponent(row.github)}`) }}
              >
                <td className='col-rank'>
                  {data.startRank + i + 1}
                </td>
                <td className='col-callsign'>
                  <div className='callsign-cell'>
                    <AdminAvatar github={row.github} size='sm' />
                    <span>{row.github}</span>
                  </div>
                </td>
                <td className='col-title'>
                  <span className={`title-badge title-badge--${row.title}`}>
                    {formatTitle(row.title)}
                  </span>
                </td>
                <td className='col-efficiency'>{formatPercent(row.boardEfficiency)}</td>
                <td className='col-score'>{row.hiddenScore}</td>
                <td className='col-shifts'>{row.shiftCount}</td>
                <td className='col-contact'>
                  {row.hasContact
                    ? <span className='contact-dot contact-dot--yes' title='Contact submitted' />
                    : <span className='contact-dot contact-dot--no' title='No contact' />}
                </td>
                <td className='col-active'>{timeAgo(row.lastActive)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='admin-pagination'>
        {data.startRank > 0 && (
          <button
            className='app-button app-button--sm'
            onClick={() => { router.push('/admin') }}
          >
            ← First page
          </button>
        )}
        <span className='pagination-info'>
          Showing {data.startRank + 1}–{data.startRank + data.rows.length} of {data.totalEntries}
        </span>
        <button
          className='app-button app-button--sm'
          disabled={data.isDone}
          onClick={goNext}
        >
          Next
        </button>
      </div>
    </section>
  )
}
