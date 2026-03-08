import { NextResponse } from "next/server";
import { getErrorMessage, jsonError, requireShiftGithub } from "@/app/api/shifts/_utils";
import { saveDraftForGithub } from "@/lib/app/shift-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ shiftId: string }> },
) {
  const auth = await requireShiftGithub(request, { desktopOnly: true });
  if ("response" in auth) {
    return auth.response;
  }
  const { github } = auth;

  const { source } = (await request.json()) as { source?: string };
  const { shiftId } = await context.params;

  try {
    const shift = await saveDraftForGithub({
      github,
      shiftId,
      source: source ?? "",
    });
    return NextResponse.json({ ok: true, savedAt: shift?.latestDraftSavedAt ?? Date.now() });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Draft save failed"), 400);
  }
}
