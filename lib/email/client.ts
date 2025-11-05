import { Resend } from "resend";

// Initialize Resend client
// Throws an error if RESEND_API_KEY is not configured
const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error(
    "RESEND_API_KEY is not configured. Please add it to your environment variables."
  );
}

export const resend = new Resend(resendApiKey);

// Email configuration
export const emailConfig = {
  from: "noreply@gipiti-app.riabkov.com",
  supportEmail: "support@yourdomain.com", // TODO: Update with your support email
  appName: "GIPITI App",
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"),
};
