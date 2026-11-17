// SPIKE (GIPITI-231), not for main. Two ways to publish an "open enum": a
// string whose known values are documented but which clients must not treat
// as a closed set.
import { z } from "zod/v4";

type OpenEnumValue<T extends readonly string[]> = T[number] | (string & {});

/**
 * Variant A: zod's own `.meta()`. No oRPC import, so the file stays inside
 * the contract zone of the architecture test.
 */
export const openEnumByMeta = <const T extends readonly [string, ...string[]]>(
  values: T
): z.ZodType<OpenEnumValue<T>, OpenEnumValue<T>> =>
  z.string().meta({
    description: `Known values: ${values.join(", ")}. Other values may appear.`,
    examples: [values[0]],
  }) as unknown as z.ZodType<OpenEnumValue<T>, OpenEnumValue<T>>;

/**
 * Variant B: remember the schema in a plain Map; the generator module (which
 * may import `@orpc/zod`) turns each entry into a JSON schema with an
 * `x-known-values` extension.
 */
export const OPEN_ENUM_VALUES = new Map<z.ZodType, readonly string[]>();

export const openEnumByRegistry = <
  const T extends readonly [string, ...string[]],
>(
  values: T
): z.ZodType<OpenEnumValue<T>, OpenEnumValue<T>> => {
  const schema = z.string();
  OPEN_ENUM_VALUES.set(schema, values);
  return schema as unknown as z.ZodType<OpenEnumValue<T>, OpenEnumValue<T>>;
};
