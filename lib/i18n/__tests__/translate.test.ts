import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { messages } from "../dictionary";
import { useErrorTranslations } from "../errors";
import { createTranslator } from "../format";

const readJson = (relativePath: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8"));

describe("createTranslator", () => {
  const t = createTranslator(
    {
      greeting: "Привет, {name}!",
      nested: {
        count: "{n, plural, =0 {нет файлов} one {# файл} other {# файлов}}",
      },
    },
    undefined
  );

  it("interpolates params", () => {
    expect(t("greeting", { name: "Виктор" })).toBe("Привет, Виктор!");
  });

  it("resolves dotted keys and Russian plural categories", () => {
    expect(t("nested.count", { n: 0 })).toBe("нет файлов");
    expect(t("nested.count", { n: 1 })).toBe("1 файл");
    expect(t("nested.count", { n: 5 })).toBe("5 файлов");
  });

  it("echoes a missing key instead of rendering nothing", () => {
    expect(t("nope.missing")).toBe("nope.missing");
  });

  it("scopes lookups to a namespace", () => {
    const scoped = createTranslator({ ns: { key: "value" } }, "ns");

    expect(scoped("key")).toBe("value");
  });
});

describe("dictionary split", () => {
  it("keeps the errors namespace out of messages/ru.json", () => {
    // Otherwise the two copies drift and the merged dictionary silently wins.
    expect(readJson("messages/ru.json")).not.toHaveProperty("errors");
  });

  it("still exposes errors through the merged dictionary", () => {
    const merged = createTranslator(messages, "errors");

    expect(merged("tryAgain")).toBe(useErrorTranslations()("tryAgain"));
    expect(merged("tryAgain")).not.toBe("errors.tryAgain");
  });
});
