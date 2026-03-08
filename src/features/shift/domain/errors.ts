export type ShiftServiceErrorCode =
  | 'active_shift_exists'
  | 'all_probes_exhausted'
  | 'evaluation_in_progress'
  | 'final_evaluation_unavailable'
  | 'probe_already_submitted'
  | 'probe_summary_unavailable'
  | 'shift_expired'
  | 'shift_not_editable'
  | 'shift_not_found'
  | 'starter_policy_invalid'
  | 'trial_window_closed'
  | 'valid_module_required'

type ShiftServiceErrorOptions = {
  activeShiftId?: string;
  message?: string;
}

const SHIFT_SERVICE_ERROR_MESSAGES: Record<ShiftServiceErrorCode, string> = {
  active_shift_exists: 'Active shift already exists.',
  all_probes_exhausted: 'all probes exhausted',
  evaluation_in_progress: 'evaluation already in progress',
  final_evaluation_unavailable: 'final evaluation unavailable',
  probe_already_submitted: 'probe already submitted',
  probe_summary_unavailable: 'probe summary unavailable',
  shift_expired: 'shift expired',
  shift_not_editable: 'shift is no longer editable',
  shift_not_found: 'shift not found',
  starter_policy_invalid: 'starter policy invalid',
  trial_window_closed: 'trial window closed',
  valid_module_required: 'valid module required'
}

export class ShiftServiceError extends Error {
  readonly activeShiftId: string | undefined
  readonly code: ShiftServiceErrorCode

  constructor (code: ShiftServiceErrorCode, options: ShiftServiceErrorOptions = {}) {
    super(options.message ?? SHIFT_SERVICE_ERROR_MESSAGES[code])
    this.name = 'ShiftServiceError'
    this.code = code
    this.activeShiftId = options.activeShiftId
  }
}

export function isShiftServiceError (error: unknown): error is ShiftServiceError {
  return error instanceof ShiftServiceError
}

export function normalizeShiftServiceError (error: unknown) {
  if (isShiftServiceError(error)) {
    return error
  }
  if (!(error instanceof Error)) {
    return null
  }

  const matchedCode = Object.entries(SHIFT_SERVICE_ERROR_MESSAGES).find(([, message]) => message === error.message)?.[0]
  if (!matchedCode) {
    return null
  }

  return new ShiftServiceError(matchedCode as ShiftServiceErrorCode, {
    message: error.message
  })
}
