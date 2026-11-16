// `server-only` throws when imported outside a React Server environment. The
// integration config aliases it to this empty module so server code can be
// imported under Vitest without mocking any module path.
export {};
