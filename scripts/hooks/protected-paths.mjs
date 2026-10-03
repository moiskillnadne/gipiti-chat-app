// Plain JS (typed via JSDoc) so the hook runs on bare `node` — no tsx startup on every edit.
import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * @typedef {object} ProtectionRule
 * @property {RegExp} pattern Tested against the project-relative path with forward slashes.
 * @property {string} reason
 * @property {boolean} [allowsNewFiles] When true, only files that already exist are
 *   protected — creating new ones is allowed.
 */

/**
 * @typedef {object} FileEditRequest
 * @property {string} relativePath
 * @property {boolean} isExistingFile
 */

/** @type {readonly ProtectionRule[]} */
export const PROTECTION_RULES = [
  {
    // `.env`, `.env.local`, `.env.production`, … — but not the committed `.env.example`.
    pattern: /(^|\/)\.env(\.(?!example$)[^/]+)?$/,
    reason: "env files hold real secrets",
  },
  {
    pattern: /\.(pem|key|p12|pfx)$/,
    reason: "private keys and certificates must not be touched by an agent",
  },
  {
    // Migrations are hand-written here (`db:generate` is broken), so new migration files
    // and the journal stay editable; already-written migrations and snapshots do not.
    pattern: /^lib\/db\/migrations\/(?!meta\/_journal\.json$)/,
    reason:
      "existing migrations may already be applied — add a new migration instead of editing one",
    allowsNewFiles: true,
  },
];

/**
 * Project-relative POSIX path; paths outside the project keep their leading `../`.
 * @param {string} filePath
 * @param {string} projectDirectory
 * @returns {string}
 */
export const toProjectRelativePath = (filePath, projectDirectory) => {
  const absolutePath = isAbsolute(filePath)
    ? filePath
    : resolve(projectDirectory, filePath);

  return relative(projectDirectory, absolutePath).split(sep).join("/");
};

/**
 * @param {FileEditRequest} request
 * @param {readonly ProtectionRule[]} [rules]
 * @returns {ProtectionRule | null}
 */
export const findViolatedRule = (
  { relativePath, isExistingFile },
  rules = PROTECTION_RULES
) =>
  rules.find(
    ({ pattern, allowsNewFiles }) =>
      pattern.test(relativePath) && (isExistingFile || !allowsNewFiles)
  ) ?? null;
