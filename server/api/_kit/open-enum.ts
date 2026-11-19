import { z } from "zod/v4";

/** A known value, or any other string a newer server may send. */
export type OpenEnumValue<T extends readonly string[]> =
  | T[number]
  | (string & {});

/**
 * A string field whose set of values may grow.
 *
 * In the OpenAPI document it is `type: string` with the known values in its
 * description, never an `enum`: code generated for Swift or Kotlin turns an
 * `enum` into a closed type that fails to decode a value it does not know,
 * so adding a value would break released apps. Use `z.enum` only for inputs
 * and for sets that can never grow.
 *
 * Built on zod's own `.meta()`, with no oRPC import, so contract files can
 * use it (they may import only `zod` and `@orpc/contract`).
 */
export const openEnum = <const T extends readonly [string, ...string[]]>(
  values: T
): z.ZodType<OpenEnumValue<T>, OpenEnumValue<T>> =>
  z.string().meta({
    description: `One of: ${values.join(", ")}. Clients must accept other values.`,
  }) as unknown as z.ZodType<OpenEnumValue<T>, OpenEnumValue<T>>;
