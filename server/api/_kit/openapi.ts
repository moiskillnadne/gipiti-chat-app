import type { AnyContractRouter } from "@orpc/contract";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";

type OpenApiDocumentInput = {
  contract: AnyContractRouter;
  title: string;
  version: string;
  /** The URL prefix the contract is served under, for example `/api/v1`. */
  serverUrl: string;
};

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * One error body schema for every status. `code` is a plain string on
 * purpose: the generator's default writes each declared code as a constant,
 * and generated native clients then fail to decode a code added later. The
 * codes a procedure declares for the status are listed in the description.
 */
const errorBodySchemaOf = (
  definedErrors: readonly (readonly [code: string, ...rest: unknown[]])[]
) => {
  const declaredCodes = definedErrors.map(([code]) => code);
  const codeDescription =
    declaredCodes.length > 0
      ? `Declared for this status: ${declaredCodes.join(", ")}. Other codes may appear.`
      : "An error code. Clients must accept codes they do not know.";

  return {
    type: "object",
    properties: {
      defined: {
        type: "boolean",
        description: "True when the procedure declares this error.",
      },
      code: { type: "string", description: codeDescription },
      status: { type: "integer" },
      message: { type: "string" },
      data: {},
    },
    required: ["defined", "code", "status", "message"],
  } as const;
};

/**
 * How a client that is not a browser page proves who it is: the access token
 * from `POST /auth/login`, `/auth/register` or `/auth/refresh`. Which
 * operations need it is said in each operation's description.
 */
const BEARER_SECURITY_SCHEME = {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description:
    "`Authorization: Bearer <accessToken>`. Access tokens live 15 minutes; renew them with `POST /auth/refresh`.",
} as const;

/** The same value with object keys in alphabetical order, at every depth. */
const sortKeysDeep = (value: JsonValue): JsonValue => {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeysDeep(value[key])])
  );
};

/**
 * Generate the OpenAPI document of a contract. Keys are sorted so that the
 * committed snapshot changes only when the API does.
 *
 * The version of the OpenAPI format is fixed by the generator (3.1.1).
 */
export const generateOpenApiDocument = async ({
  contract,
  title,
  version,
  serverUrl,
}: OpenApiDocumentInput): Promise<JsonValue> => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  const document = await generator.generate(contract, {
    info: { title, version },
    servers: [{ url: serverUrl }],
    components: { securitySchemes: { bearerAuth: BEARER_SECURITY_SCHEME } },
    customErrorResponseBodySchema: (definedErrors) =>
      errorBodySchemaOf(definedErrors),
  });

  // Through JSON, so `undefined` members are dropped the way they will be
  // when the document is written to the snapshot file.
  return sortKeysDeep(JSON.parse(JSON.stringify(document)) as JsonValue);
};

/** The exact text of the snapshot file for a document. */
export const serializeOpenApiDocument = (document: JsonValue): string =>
  `${JSON.stringify(document, null, 2)}\n`;
