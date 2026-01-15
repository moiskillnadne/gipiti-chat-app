import { resend } from "./client";

type AddContactToSegmentParams = {
  email: string;
  firstName?: string;
  lastName?: string;
};

type AddContactToSegmentResult = {
  success: boolean;
  contactId?: string;
  error?: string;
};

/**
 * Add a new user contact to Resend and assign to marketing segment
 * This function is designed to be non-blocking - it should never throw
 *
 * @param params - Contact details
 * @returns Success status with optional contact ID or error message
 */
export async function addContactToSegment({
  email,
  firstName,
  lastName,
}: AddContactToSegmentParams): Promise<AddContactToSegmentResult> {
  const segmentId = process.env.RESEND_MARKETING_SEGMENT_ID;

  // If no segment ID configured, skip silently (allows opt-out)
  if (!segmentId) {
    console.info(
      "[AddContactToSegment] RESEND_MARKETING_SEGMENT_ID not configured, skipping"
    );
    return { success: true };
  }

  try {
    // Create the contact and assign to audience/segment
    const { data: contactData, error: contactError } =
      await resend.contacts.create({
        email,
        firstName,
        lastName,
        unsubscribed: false,
        audienceId: segmentId,
      });

    if (contactError) {
      console.error(
        "[AddContactToSegment] Failed to create contact:",
        contactError
      );
      return {
        success: false,
        error: contactError.message,
      };
    }

    const contactId = contactData?.id;

    if (!contactId) {
      console.error("[AddContactToSegment] No contact ID returned");
      return {
        success: false,
        error: "No contact ID returned from Resend",
      };
    }

    console.info(
      `[AddContactToSegment] Successfully added ${email} to segment ${segmentId}`
    );

    return {
      success: true,
      contactId,
    };
  } catch (error) {
    console.error("[AddContactToSegment] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
