export const clientLog = {
  error: (message: string, context?: unknown) =>
    navigator.sendBeacon(
      "/api/log",
      JSON.stringify({ level: "error", message, context })
    ),
  info: (message: string, context?: unknown) =>
    navigator.sendBeacon(
      "/api/log",
      JSON.stringify({ level: "info", message, context })
    ),
};

