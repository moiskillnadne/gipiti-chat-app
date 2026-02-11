/**
 * Shared Drizzle ORM mock for query unit tests.
 * Uses a Proxy-based approach to simulate Drizzle's chainable query builder.
 *
 * Usage in test files:
 *   vi.mock("../connection", async () => {
 *     const mod = await import("./db-mock");
 *     return { db: mod.mockDb };
 *   });
 *
 *   import { setResult, setResults, setError, resetMock } from "./db-mock";
 */

const state = {
  defaultResult: [] as unknown,
  resultQueue: [] as unknown[],
  error: null as Error | null,
};

/** Set a single result returned by every awaited db operation. */
export function setResult(result: unknown): void {
  state.defaultResult = result;
  state.resultQueue = [];
  state.error = null;
}

/**
 * Push ordered results — each successive `await` on a db chain
 * pops the next result from the queue. Falls back to `defaultResult`
 * when the queue is exhausted.
 */
export function setResults(...results: unknown[]): void {
  state.resultQueue.push(...results);
  state.error = null;
}

/** Make every awaited db operation reject with this error. */
export function setError(error: Error): void {
  state.error = error;
}

/** Reset to default state (empty array result, no error). */
export function resetMock(): void {
  state.defaultResult = [];
  state.resultQueue = [];
  state.error = null;
}

function getNextResult(): unknown {
  if (state.resultQueue.length > 0) {
    return state.resultQueue.shift();
  }
  return state.defaultResult;
}

/**
 * Proxy-based mock that simulates Drizzle's fluent query builder.
 * Every property access returns a callable that returns a new proxy.
 * When awaited (`then` accessed), resolves to the configured result
 * or rejects with the configured error.
 */
const proxyHandler: ProxyHandler<Record<string, unknown>> = {
  get(_, prop) {
    if (prop === "then") {
      if (state.error) {
        const err = state.error;
        return (
          _resolve: unknown,
          reject: (e: Error) => void,
        ) => reject(err);
      }
      return (resolve: (v: unknown) => void) => resolve(getNextResult());
    }
    if (typeof prop === "symbol") {
      return;
    }
    return (..._args: unknown[]) => new Proxy({}, proxyHandler);
  },
};

export const mockDb = new Proxy({}, proxyHandler);
