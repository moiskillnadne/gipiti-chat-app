import { type NextRequest, NextResponse } from "next/server";
import { resend, resendWebhookSecret } from "@/lib/email/client";
import { forwardEmail } from "@/lib/email/forward-email";

type EmailReceivedEvent = {
  type: "email.received";
  created_at: string;
  data: {
    email_id: string;
    created_at: string;
    from: string;
    to: string[];
    cc: string[];
    bcc: string[];
    message_id: string;
    subject: string;
    attachments: Array<{
      id: string;
      filename: string;
      content_type: string;
      content_disposition: string;
      content_id?: string;
    }>;
  };
};

type WebhookEvent = EmailReceivedEvent | { type: string };

function verifyWebhook(
  payload: string,
  headers: {
    "svix-id": string | null;
    "svix-timestamp": string | null;
    "svix-signature": string | null;
  }
): WebhookEvent | null {
  if (!resendWebhookSecret) {
    console.warn(
      "[ResendWebhook] RESEND_WEBHOOK_SECRET not configured, skipping verification"
    );
    return JSON.parse(payload) as WebhookEvent;
  }

  const id = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signature = headers["svix-signature"];

  if (!id || !timestamp || !signature) {
    console.error("[ResendWebhook] Missing required Svix headers");
    return null;
  }

  try {
    const result = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret: resendWebhookSecret,
    });
    return result as WebhookEvent;
  } catch (error) {
    console.error("[ResendWebhook] Webhook verification failed:", error);
    return null;
  }
}

async function fetchAttachmentContent(
  emailId: string,
  attachmentId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.resend.com/emails/${emailId}/attachments/${attachmentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error(
        `[ResendWebhook] Failed to fetch attachment ${attachmentId}:`,
        response.status
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString("base64");
  } catch (error) {
    console.error(
      `[ResendWebhook] Error fetching attachment ${attachmentId}:`,
      error
    );
    return null;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const payload = await request.text();

  const event = verifyWebhook(payload, {
    "svix-id": request.headers.get("svix-id"),
    "svix-timestamp": request.headers.get("svix-timestamp"),
    "svix-signature": request.headers.get("svix-signature"),
  });

  if (!event) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  const emailEvent = event as EmailReceivedEvent;
  console.info(
    `[ResendWebhook] Received email from ${emailEvent.data.from} to ${emailEvent.data.to.join(", ")}`
  );

  try {
    const { data: emailContent, error: contentError } =
      await resend.emails.receiving.get(emailEvent.data.email_id);

    if (contentError || !emailContent) {
      console.error(
        "[ResendWebhook] Failed to fetch email content:",
        contentError
      );
      return NextResponse.json(
        { error: "Failed to fetch email content" },
        { status: 500 }
      );
    }

    const attachments: Array<{
      filename: string;
      content: string;
      content_type: string;
    }> = [];

    for (const att of emailEvent.data.attachments) {
      const content = await fetchAttachmentContent(
        emailEvent.data.email_id,
        att.id
      );
      if (content) {
        attachments.push({
          filename: att.filename,
          content,
          content_type: att.content_type,
        });
      }
    }

    const result = await forwardEmail({
      originalFrom: emailEvent.data.from,
      originalTo: emailEvent.data.to,
      subject: emailEvent.data.subject,
      html: emailContent.html ?? undefined,
      text: emailContent.text ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (!result.success) {
      console.error("[ResendWebhook] Failed to forward email:", result.error);
      return NextResponse.json(
        { error: "Failed to forward email" },
        { status: 500 }
      );
    }

    return NextResponse.json({ forwarded: true });
  } catch (error) {
    console.error("[ResendWebhook] Error processing email:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
