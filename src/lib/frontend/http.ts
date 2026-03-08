type ErrorPayload = {
  error?: string;
};

export async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

export async function readJsonOrThrow<T extends ErrorPayload>(
  response: Response,
  fallback: string,
): Promise<T> {
  const data = await readJson<T>(response);
  if (!response.ok) {
    throw new Error(data.error ?? fallback);
  }
  return data;
}
