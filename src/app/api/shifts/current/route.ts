import { NextResponse } from "next/server";
import { getCurrentShiftForGithub } from "@/lib/app/shift-service";
import { getGithubUsername } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function GET() {
  const github = await getGithubUsername();
  if (!github) {
    return NextResponse.json({ shift: null }, { status: 200 });
  }

  const shift = await getCurrentShiftForGithub(github);
  return NextResponse.json({ shift });
}
