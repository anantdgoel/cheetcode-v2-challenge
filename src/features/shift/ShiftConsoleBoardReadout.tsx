import type { ReadoutField } from './shift-console-state'

export function ShiftConsoleBoardReadout ({ readoutFields }: { readoutFields: ReadoutField[][] }) {
  return (
    <div className="console-readout">
      <p className="console-card-eyebrow">Board Readout</p>
      <h2 className="console-readout__title">Operational State</h2>
      <div className="console-readout__grid">
        {readoutFields.map((row, rowIndex) => (
          <div key={rowIndex} className="console-readout__row">
            {row.map((field) => (
              <div key={field.label} className="console-readout__field">
                <span className="console-readout__label">{field.label}</span>
                <span className={`console-readout__value${field.modifier ?? ''}`}>{field.value}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
