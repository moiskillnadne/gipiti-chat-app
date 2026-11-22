import { describe, expect, it } from "vitest";

import { isAcceptablePassword } from "@/server/modules/auth/password-policy";

describe("isAcceptablePassword", () => {
  it("accepts 8 characters with upper, lower, digit and special", () => {
    expect(isAcceptablePassword("Str0ng!P")).toBe(true);
  });

  it.each<[string, string]>([
    ["shorter than 8 characters", "St0ng!P"],
    ["no uppercase letter", "str0ng!pass"],
    ["no lowercase letter", "STR0NG!PASS"],
    ["no digit", "Strong!Pass"],
    ["no special character", "Str0ngPass"],
    ["empty", ""],
  ])("refuses a password with %s", (_case, password) => {
    expect(isAcceptablePassword(password)).toBe(false);
  });

  it("counts a line break as a character, as the form schema always did", () => {
    expect(isAcceptablePassword("Ab1!\nxyz")).toBe(true);
  });
});
