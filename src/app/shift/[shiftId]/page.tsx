import { ConvexAuthProvider } from '@/features/landing/client/ConvexAuthProvider'
import { ShiftPageClient } from '@/features/shift/client/ShiftPageClient'

export const dynamic = 'force-dynamic'

export default async function ShiftPage ({
  params
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { shiftId } = await params

  return (
    <ConvexAuthProvider>
      <ShiftPageClient shiftId={shiftId} />
    </ConvexAuthProvider>
  )
}
