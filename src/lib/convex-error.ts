import { ConvexError } from 'convex/values'
import type { AppErrorData } from '../../convex/lib/errors'

const CODE_MESSAGES: Record<string, string> = {
  auth_required: 'Authentication required — please sign in.',
  shift_not_found: 'Shift not found.',
  shift_expired: 'Your shift has expired.',
  shift_not_editable: 'Shift is no longer editable.',
  trial_window_closed: 'Trial window has closed.',
  evaluation_in_progress: 'Evaluation already in progress.',
  final_evaluation_unavailable: 'Final evaluation unavailable.',
  all_probes_exhausted: 'All probes exhausted.',
  probe_already_submitted: 'Probe already submitted.',
  valid_module_required: 'A valid module is required.',
  starter_policy_invalid: 'Starter policy is invalid.',
  report_not_found: 'Report not found.',
  unauthorized: 'You do not have permission to do that.'
}

export function extractErrorMessage (error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data as AppErrorData | undefined
    if (data?.code) return CODE_MESSAGES[data.code] ?? data.message ?? fallback
  }
  return error instanceof Error ? error.message : fallback
}
