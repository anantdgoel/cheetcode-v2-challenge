import { NextResponse } from 'next/server'
import { submitContact } from '@/features/report/server/queries'
import { jsonError } from '@/app/api/shifts/_utils'

export async function POST (request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonError('invalid JSON', 400)
  }

  const { github, name, email, reportPublicId } = body as Record<string, unknown>

  if (typeof github !== 'string' || !github.trim()) {
    return jsonError('github is required', 400)
  }
  if (typeof name !== 'string' || !name.trim()) {
    return jsonError('name is required', 400)
  }
  if (typeof email !== 'string' || !email.trim() || !email.includes('@')) {
    return jsonError('valid email is required', 400)
  }
  if (typeof reportPublicId !== 'string' || !reportPublicId.trim()) {
    return jsonError('reportPublicId is required', 400)
  }

  try {
    await submitContact({
      github: github.trim(),
      name: name.trim(),
      email: email.trim(),
      reportPublicId: reportPublicId.trim()
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'submission failed'
    return jsonError(message, 400)
  }
}
