import { describe, expect, it } from "vitest";
import worker, { validateSubmission } from "../worker/index";

const testCases = [
  { input: { a: 2, b: 3 }, expected: 5 },
  { input: { a: 5, b: 5 }, expected: 10 },
  { input: { a: -1, b: 1 }, expected: 0 },
];

describe("worker", () => {
  it("correct solution passes", async () => {
    const result = await validateSubmission({
      code: "function sumTwo(a, b) { return a + b; }",
      testCases,
    });
    expect(result.passed).toBe(true);
  });

  it("incorrect solution fails", async () => {
    const result = await validateSubmission({
      code: "function sumTwo(a, b) { return a - b; }",
      testCases,
    });
    expect(result.passed).toBe(false);
  });

  it("syntax error returns false", async () => {
    const result = await validateSubmission({
      code: "function sumTwo(a, b) { return a + ; }",
      testCases,
    });
    expect(result.passed).toBe(false);
  });

  it("runtime error returns false", async () => {
    const result = await validateSubmission({
      code: "function sumTwo(a, b) { throw new Error('boom'); }",
      testCases,
    });
    expect(result.passed).toBe(false);
  });

  it("infinite loop pattern is rejected", async () => {
    const result = await validateSubmission({
      code: "function sumTwo(a, b) { while(true) {} }",
      testCases,
    });
    expect(result.passed).toBe(false);
  });

  it("firecrawl global is accessible", async () => {
    const result = await validateSubmission({
      code: "function sumTwo() { return globalThis.__FIRECRAWL__; }",
      testCases: [{ input: {}, expected: "🔥{you_found_the_fire}" }],
    });
    expect(result.passed).toBe(true);
  });

  it("fetch handler returns json payload", async () => {
    const response = await worker.fetch(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          code: "function sumTwo(a, b) { return a + b; }",
          testCases,
        }),
      }),
    );
    const data = (await response.json()) as { passed: boolean };
    expect(data.passed).toBe(true);
  });
});
