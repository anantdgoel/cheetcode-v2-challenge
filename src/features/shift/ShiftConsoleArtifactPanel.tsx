import type { ReactNode } from 'react'
import type { ArtifactName } from '@/lib/domain/game'
import {
  SHIFT_ARTIFACT_LABELS,
  SHIFT_ARTIFACTS,
  type ActiveTab,
  type SavingState
} from './shift-console-state'
import { useShiftConsoleTiming } from './shift-console-timing'

function inlineCode (text: string): ReactNode {
  const parts = text.split(/`([^`]+)`/)
  if (parts.length === 1) return text
  return parts.map((part, index) => (index % 2 === 1 ? <code key={index}>{part}</code> : part))
}

function renderManual (raw: string) {
  const lines = raw.split('\n')
  const elements: ReactNode[] = []
  let index = 0
  let key = 0

  while (index < lines.length) {
    const line = lines[index]

    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={key++} className="console-manual__title">
          {line.slice(2)}
        </h2>
      )
      index += 1
      continue
    }

    if (line.startsWith('## ')) {
      elements.push(
        <p key={key++} className="console-manual__heading">
          {line.slice(3).replace(/^\d+\.\s*/, '')}
        </p>
      )
      index += 1
      continue
    }

    if (line.startsWith('    ')) {
      const codeLines: string[] = []
      while (
        index < lines.length &&
        (lines[index].startsWith('    ') || lines[index].trim() === '')
      ) {
        codeLines.push(lines[index].slice(4))
        index += 1
      }
      while (codeLines.at(-1)?.trim() === '') codeLines.pop()
      elements.push(
        <pre key={key++} className="console-manual__code">
          {codeLines.join('\n')}
        </pre>
      )
      continue
    }

    if (line.startsWith('- ')) {
      const items: string[] = []
      while (index < lines.length && lines[index].startsWith('- ')) {
        items.push(lines[index].slice(2))
        index += 1
      }
      elements.push(
        <ul key={key++} className="console-manual__list">
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{inlineCode(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (line.trim() === '') {
      index += 1
      continue
    }

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !lines[index].startsWith('#') &&
      !lines[index].startsWith('- ') &&
      !lines[index].startsWith('    ')
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }
    elements.push(
      <p key={key++} className="console-manual__para">
        {inlineCode(paragraphLines.join('\n'))}
      </p>
    )
  }

  return elements
}

function EditorNotice ({ type, message }: { message: string; type: 'success' | 'error' | 'warning' }) {
  return (
    <div className="console-editor__notice">
      <span className={`console-editor__notice-dot console-editor__notice-dot--${type}`} />
      <span className={`console-editor__notice-text console-editor__notice-text--${type}`}>
        {message}
      </span>
    </div>
  )
}

export function ShiftConsoleArtifactPanel (props: {
  activeTab: ActiveTab;
  artifactContents: Partial<Record<ArtifactName, string>>;
  draft: string;
  isCompleted: boolean;
  isEvaluating: boolean;
  latestValidationError?: string;
  onDraftChange: (value: string) => void;
  onTabChange: (tab: ActiveTab) => void;
  savingState: SavingState;
}) {
  const timing = useShiftConsoleTiming()
  const activeArtifact = props.activeTab === 'editor' ? null : props.activeTab
  const notice = props.latestValidationError
    ? (
    <EditorNotice type="error" message={props.latestValidationError} />
      )
    : timing.statusNotice
      ? (
    <EditorNotice type={timing.statusNoticeTone} message={timing.statusNotice} />
        )
      : null

  return (
    <>
      <div className="console-tabs">
        {SHIFT_ARTIFACTS.map((artifact) => (
          <button
            key={artifact}
            type="button"
            className={`console-tab${props.activeTab === artifact ? ' console-tab--active' : ''}`}
            onClick={() => props.onTabChange(artifact)}
          >
            {SHIFT_ARTIFACT_LABELS[artifact]}
          </button>
        ))}
        <button
          type="button"
          className={`console-tab console-tab--editor${props.activeTab === 'editor' ? ' console-tab--editor-active' : ' console-tab--editor-inactive'}`}
          onClick={() => props.onTabChange('editor')}
        >
          Editor
        </button>
      </div>

      {activeArtifact
        ? (
        <div className="console-content">
          {props.artifactContents[activeArtifact]
            ? activeArtifact === 'manual.md'
              ? renderManual(props.artifactContents[activeArtifact])
              : <pre>{props.artifactContents[activeArtifact]}</pre>
            : <p className="console-supervisor__empty">Loading artifact...</p>}
        </div>
          )
        : (
        <div className="console-editor">
          <div className="console-editor__header">
            <span className="eyebrow">Operator Policy</span>
            {props.savingState !== 'idle' && (
              <span className="console-editor__save">
                <span className={`console-editor__save-dot console-editor__save-dot--${props.savingState}`} />
                {props.savingState === 'saved' ? 'Saved' : 'Saving...'}
              </span>
            )}
          </div>
          <div className="console-editor__textarea-wrap">
            <textarea
              className={`console-editor__textarea${props.isCompleted ? ' console-editor__textarea--readonly' : ''}`}
              value={props.draft}
              readOnly={props.isCompleted || props.isEvaluating}
              spellCheck={false}
              onChange={(event) => props.onDraftChange(event.target.value)}
            />
          </div>
          {notice}
        </div>
          )}
    </>
  )
}
