import ru from "../../messages/ru.json" with { type: "json" };

export const messages = ru as Record<string, unknown>;

export type Messages = typeof ru;
