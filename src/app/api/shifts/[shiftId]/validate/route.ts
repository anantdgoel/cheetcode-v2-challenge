import { NextResponse } from "next/server";
import { getErrorMessage, jsonError, requireShiftGithub } from "@/app/api/shifts/_utils";
import { validateDraftForGithub } from "@/lib/shift-service";

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
    const result = await validateDraftForGithub({
      github,
      shiftId,
      source: source ?? "",
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Validation failed"), 400);
  }
}
