import { NextResponse } from "next/server";
import { getErrorMessage, jsonError, requireShiftGithub } from "@/app/api/shifts/_utils";
import { runProbeForGithub } from "@/lib/shifts";

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
    const result = await runProbeForGithub({ github, shiftId });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Probe failed"), 400);
  }
}
