import { NextResponse } from "next/server";
import { getErrorMessage, jsonError, requireShiftGithub } from "@/app/api/shifts/_utils";
import { goLiveForGithub } from "@/lib/shift-service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ shiftId: string }> },
) {
  const auth = await requireShiftGithub(_request, { desktopOnly: true });
  if ("response" in auth) {
    return auth.response;
  }
  const { github } = auth;

  const { shiftId } = await context.params;

  try {
    const shift = await goLiveForGithub(github, shiftId);
    return NextResponse.json({ shift }, { status: 200 });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Go Live failed"), 400);
  }
}
