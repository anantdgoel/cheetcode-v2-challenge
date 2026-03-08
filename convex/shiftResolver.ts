'use node'

import { v } from 'convex/values'
import type { StoredShiftRecord } from '../src/features/shift/domain/persistence'
import { internalAction } from './_generated/server'
import { resolveOwnedShiftRecord } from './shiftRuntime'

export const resolveShift = internalAction({
  args: {
    github: v.string(),
    shiftId: v.id('shifts')
  },
  handler: async (ctx, args): Promise<StoredShiftRecord | null> => {
    return resolveOwnedShiftRecord(ctx, args.github, args.shiftId)
  }
})
