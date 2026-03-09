'use client'

import Image from 'next/image'
import { formatPercent, formatTitle } from '@/core/engine/report'
import type { AdminCandidatePage } from '@/core/domain/views'
import { useRouter, useSearchParams } from 'next/navigation'

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
  const searchParams = useSearchParams()
  const currentPage = data.page

  function goToPage (page: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    params.delete('candidate')
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
                onClick={() => router.push(`/admin?candidate=${encodeURIComponent(row.github)}`)}
              >
                <td className='col-rank'>
                  {currentPage * 25 + i + 1}
                </td>
                <td className='col-callsign'>
                  <div className='callsign-cell'>
                    <Image
                      className='admin-avatar'
                      src={`https://github.com/${row.github}.png?size=40`}
                      alt=''
                      width={20}
                      height={20}
                      unoptimized
                    />
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

      {data.totalPages > 1 && (
        <div className='admin-pagination'>
          <button
            className='app-button app-button--sm'
            disabled={currentPage === 0}
            onClick={() => goToPage(currentPage - 1)}
          >
            Previous
          </button>
          <span className='pagination-info'>
            Page {currentPage + 1} of {data.totalPages}
          </span>
          <button
            className='app-button app-button--sm'
            disabled={currentPage >= data.totalPages - 1}
            onClick={() => goToPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  )
}
