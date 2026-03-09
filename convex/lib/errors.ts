import { ConvexError } from 'convex/values'

export type AppErrorCode =
  | 'auth_required'
  | 'shift_not_found'
  | 'shift_expired'
  | 'shift_not_editable'
  | 'trial_window_closed'
  | 'evaluation_in_progress'
  | 'final_evaluation_unavailable'
  | 'all_probes_exhausted'
  | 'probe_already_submitted'
  | 'valid_module_required'
  | 'starter_policy_invalid'
  | 'report_not_found'
  | 'unauthorized'

export type AppErrorData = { code: AppErrorCode; message?: string }

export function appError (code: AppErrorCode, message?: string) {
  return new ConvexError<AppErrorData>({ code, message })
}
