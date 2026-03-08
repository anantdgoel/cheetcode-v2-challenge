import { Fragment } from 'react'
import type { ActionStep } from '../types'

export function ShiftConsoleActionBar ({ steps }: { steps: ActionStep[] }) {
  return (
    <div className='console-action-bar'>
      {steps.map((step, index) => (
        <Fragment key={step.number}>
          {index > 0 && <span className='action-bar__chevron'>&rarr;</span>}
          <button
            type='button'
            className={`action-step action-step--${step.state}${step.emphasized ? ' action-step--emphasized' : ''}`}
            disabled={
              step.state === 'disabled' ||
              step.state === 'completed' ||
              step.state === 'upcoming' ||
              step.loading
            }
            onClick={() => { step.action() }}
          >
            {step.loading ? step.loadingLabel : step.state === 'completed' ? `${step.label} \u2713` : step.label}
          </button>
        </Fragment>
      ))}
    </div>
  )
}
