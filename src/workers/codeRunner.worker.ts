type TestCase = {
  input: Record<string, unknown>;
  expected: unknown;
};

type MessagePayload = {
  id: string;
  code: string;
  testCases: TestCase[];
};

type MessageResult = {
  id: string;
  passed: boolean;
};

function runTest(code: string, testCase: TestCase): boolean {
  const fn = new Function(`return (${code});`)() as (...args: unknown[]) => unknown;
  const result = fn(...Object.values(testCase.input));
  return JSON.stringify(result) === JSON.stringify(testCase.expected);
}

self.onmessage = (event: MessageEvent<MessagePayload>) => {
  const { id, code, testCases } = event.data;
  try {
    const passed = testCases.every((testCase) => runTest(code, testCase));
    const response: MessageResult = { id, passed };
    self.postMessage(response);
  } catch {
    self.postMessage({ id, passed: false } satisfies MessageResult);
  }
};
