import { NextResponse } from "next/server";
import { requireShiftGithub } from "@/app/api/shifts/_utils";
import { getOwnedShiftForGithub } from "@/lib/app/shift-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ shiftId: string }> },
) {
  const auth = await requireShiftGithub(_request, { desktopOnly: true });
  if ("response" in auth) {
    return auth.response;
  }
  const { github } = auth;

  const { shiftId } = await context.params;
  const shift = await getOwnedShiftForGithub(github, shiftId);
  if (!shift) {
    return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  }

  return NextResponse.json({ shift });
}
