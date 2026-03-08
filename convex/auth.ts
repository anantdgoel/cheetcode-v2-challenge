export function assertSecret(secret: string) {
  const expected = process.env.CONVEX_MUTATION_SECRET;
  if (!expected) {
    throw new Error("CONVEX_MUTATION_SECRET is not configured in the Convex deployment");
  }
  if (secret !== expected) {
    throw new Error("unauthorized");
  }
}
