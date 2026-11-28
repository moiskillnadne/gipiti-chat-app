/**
 * The one file in `client/` that may import `server/` (rule
 * `CLIENT_CONTRACT_BRIDGE` in `tests/architecture/rules.ts`). The v1 contract
 * holds shapes only (`zod` and `@orpc/contract`), so no server code reaches the
 * browser through it.
 */
// biome-ignore lint/performance/noBarrelFile: this file exists to be the one bridge
export { V1_PREFIX, v1Contract } from "@/server/api/v1/contract";
