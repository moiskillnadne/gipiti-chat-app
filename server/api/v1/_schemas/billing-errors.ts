import { billingListBadRequestDataSchema } from "@/server/api/v1/_schemas/billing";

/** The error of the two cursor lists of `/me/billing` that says why in `data.reason`. */
export const billingListBadRequestWithReason = {
  BAD_REQUEST: {
    status: 400,
    message: "The request cannot be accepted.",
    data: billingListBadRequestDataSchema,
  },
} as const;
