import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("shift routes source", () => {
  it("exposes observations artifact routes in source", () => {
    const source = fs.readFileSync("src/lib/shift-service.ts", "utf8");
    expect(source.includes("observations.jsonl")).toBe(true);
  });

  it("uses the new probe names in shared runtime", () => {
    const source = fs.readFileSync("src/lib/shift-runtime.ts", "utf8");
    expect(source.includes('"fit"')).toBe(true);
    expect(source.includes('"stress"')).toBe(true);
  });
});
