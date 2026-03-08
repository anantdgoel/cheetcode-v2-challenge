import { auth } from "../../auth";

export async function getGithubUsername() {
  const session = await auth();
  return (session?.user as { githubUsername?: string } | undefined)?.githubUsername ?? null;
}

export async function requireGithubUsername() {
  const github = await getGithubUsername();
  if (!github) {
    throw new Error("GitHub authentication required");
  }
  return github;
}

export function isAdminGithub(github: string | null) {
  if (!github) return false;
  const raw = process.env.ADMIN_GITHUB_LOGINS ?? "";
  const allowlist = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return allowlist.includes(github);
}
