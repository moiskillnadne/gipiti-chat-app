import { Resend } from "resend";

// Initialize Resend client
// Throws an error if RESEND_API_KEY is not configured
const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error(
    "RESEND_API_KEY is not configured. Please add it to your environment variables."
  );
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL;

if (!appUrl) {
  throw new Error(
    "NEXT_PUBLIC_APP_URL is not configured. Please add it to your environment variables."
  );
}

export const resend = new Resend(resendApiKey);

// Webhook secret for verifying incoming webhooks (optional - only needed for receiving emails)
export const resendWebhookSecret = process.env.RESEND_WEBHOOK_SECRET;

// Email configuration
export const emailConfig = {
  from: "noreply@gipiti.ru",
  supportEmail: "vitya.ryabkov@gmail.com",
  forwardTo: process.env.EMAIL_FORWARD_TO ?? "vitya.ryabkov@gmail.com",
  appName: "GIPITI",
  appUrl,
};
