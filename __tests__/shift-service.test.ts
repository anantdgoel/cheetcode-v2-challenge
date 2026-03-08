import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/convex-server", () => ({
  getConvexMutationSecret: () => "secret",
  getConvexServerClient: () => ({
    action: vi.fn(),
    query: vi.fn(),
    mutation: vi.fn(),
  }),
}));

describe("shift service migration", () => {
  it("tracks the v3 artifact name in source", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile("src/lib/shift-service.ts", "utf8");
    expect(source.includes("observations.jsonl")).toBe(true);
    expect(source.includes("call-log.jsonl")).toBe(false);
  });

  it("does not expose seed on the public ShiftView type", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile("src/lib/types.ts", "utf8");
    const shiftViewBlock = source.split("export type ShiftView = {")[1]?.split("};")[0] ?? "";
    expect(shiftViewBlock.includes("seed:")).toBe(false);
  });
});
