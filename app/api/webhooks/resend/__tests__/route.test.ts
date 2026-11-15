import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { emailClientState, verifyMock, receivingGetMock, forwardEmailMock } =
  vi.hoisted(() => ({
    emailClientState: { webhookSecret: undefined as string | undefined },
    verifyMock: vi.fn(),
    receivingGetMock: vi.fn(),
    forwardEmailMock: vi.fn(),
  }));

vi.mock("@/lib/email/client", () => ({
  resend: {
    webhooks: { verify: verifyMock },
    emails: { receiving: { get: receivingGetMock } },
  },
  get resendWebhookSecret() {
    return emailClientState.webhookSecret;
  },
}));
vi.mock("@/lib/email/forward-email", () => ({
  forwardEmail: forwardEmailMock,
}));

import { POST } from "../route";

const WEBHOOK_SECRET = "whsec_test";

const emailReceivedEvent = {
  type: "email.received",
  created_at: "2026-11-15T10:00:00Z",
  data: {
    email_id: "email_1",
    created_at: "2026-11-15T10:00:00Z",
    from: "sender@example.test",
    to: ["support@example.test"],
    cc: [],
    bcc: [],
    message_id: "message_1",
    subject: "Hello",
    attachments: [],
  },
};

const webhookRequest = (headers: Record<string, string> = {}): NextRequest =>
  new NextRequest("https://example.test/api/webhooks/resend", {
    method: "POST",
    body: JSON.stringify(emailReceivedEvent),
    headers,
  });

const SVIX_HEADERS = {
  "svix-id": "msg_1",
  "svix-timestamp": "1763200000",
  "svix-signature": "v1,signature",
};

describe("POST /api/webhooks/resend", () => {
  beforeEach(() => {
    emailClientState.webhookSecret = WEBHOOK_SECRET;
    vi.spyOn(console, "info").mockReturnValue(undefined);
    vi.spyOn(console, "error").mockReturnValue(undefined);
    verifyMock.mockReset().mockReturnValue(emailReceivedEvent);
    receivingGetMock.mockReset().mockResolvedValue({
      data: { html: "<p>Hello</p>", text: "Hello" },
      error: null,
    });
    forwardEmailMock.mockReset().mockResolvedValue({ success: true });
  });

  it("rejects every request when the webhook secret is not configured", async () => {
    // Arrange
    emailClientState.webhookSecret = undefined;

    // Act
    const response = await POST(webhookRequest(SVIX_HEADERS));

    // Assert
    expect(response.status).toBe(400);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(receivingGetMock).not.toHaveBeenCalled();
    expect(forwardEmailMock).not.toHaveBeenCalled();
  });

  it("rejects a request whose signature does not verify", async () => {
    // Arrange
    verifyMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    // Act
    const response = await POST(webhookRequest(SVIX_HEADERS));

    // Assert
    expect(response.status).toBe(400);
    expect(forwardEmailMock).not.toHaveBeenCalled();
  });

  it("forwards a verified inbound email", async () => {
    // Act
    const response = await POST(webhookRequest(SVIX_HEADERS));

    // Assert
    expect(response.status).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ webhookSecret: WEBHOOK_SECRET })
    );
    expect(forwardEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFrom: "sender@example.test",
        subject: "Hello",
      })
    );
  });
});
