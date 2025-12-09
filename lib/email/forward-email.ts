import { emailConfig, resend } from "./client";

type Attachment = {
  filename: string;
  content: string;
  content_type: string;
};

type ForwardEmailParams = {
  originalFrom: string;
  originalTo: string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Attachment[];
};

export async function forwardEmail({
  originalFrom,
  originalTo,
  subject,
  html,
  text,
  attachments,
}: ForwardEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedSubject = `[Forwarded] ${subject}`;
    const forwardHeader = `
---------- Forwarded message ----------
From: ${originalFrom}
To: ${originalTo.join(", ")}
Subject: ${subject}
----------------------------------------

`;

    const formattedHtml = html
      ? `<div style="padding: 12px; background: #f5f5f5; border-radius: 4px; margin-bottom: 16px; font-family: monospace; font-size: 12px;">
<strong>Forwarded message</strong><br/>
From: ${originalFrom}<br/>
To: ${originalTo.join(", ")}<br/>
Subject: ${subject}
</div>
${html}`
      : undefined;

    const formattedText = text ? `${forwardHeader}${text}` : forwardHeader;

    const resendAttachments = attachments?.map((att) => ({
      filename: att.filename,
      content: Buffer.from(att.content, "base64"),
      contentType: att.content_type,
    }));

    const response = await resend.emails.send({
      from: emailConfig.from,
      to: emailConfig.forwardTo,
      subject: formattedSubject,
      html: formattedHtml,
      text: formattedText,
      attachments: resendAttachments,
    });

    if (response.error) {
      console.error("[ForwardEmail] Failed to forward email:", response.error);
      return { success: false, error: response.error.message };
    }

    console.info(
      `[ForwardEmail] Successfully forwarded email from ${originalFrom} to ${emailConfig.forwardTo}`
    );
    return { success: true };
  } catch (error) {
    console.error("[ForwardEmail] Error forwarding email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
