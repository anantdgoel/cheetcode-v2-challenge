export type Difficulty = "easy" | "medium" | "hard";

export type ProblemTestCase = {
  input: Record<string, unknown>;
  expected: unknown;
};

export type GameProblem = {
  id: string;
  title: string;
  difficulty: Difficulty;
  description: string;
  example: string;
  signature: string;
  starterCode: string;
  testCases: ProblemTestCase[];
};

export type SubmissionDraft = {
  problemId: string;
  code: string;
  difficulty: Difficulty;
  testCases: ProblemTestCase[];
};

export type SessionResponse = {
  sessionId: string;
  expiresAt: number;
  problems: GameProblem[];
};

export type SubmissionResult = {
  problemId: string;
  passed: boolean;
};

export type SubmitResultsResponse = {
  elo: number;
  solved: number;
  rank: number;
  timeRemaining: number;
  details: SubmissionResult[];
};
