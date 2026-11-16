/**
 * Code under test for `../auth-authorize.test.ts`: importing this module runs
 * `NextAuth(...)` with the app's config, which the test captures through a
 * mocked `next-auth`. See `cloudpayments-webhook.ts`.
 */
export { auth, signIn, signOut } from "@/app/(auth)/auth";
