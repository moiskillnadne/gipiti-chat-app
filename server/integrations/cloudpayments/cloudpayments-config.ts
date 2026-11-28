import type { CloudPaymentsConfig } from "./cloudpayments-types";

export function getCloudPaymentsConfig(): CloudPaymentsConfig {
  const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
  const apiSecret = process.env.CLOUDPAYMENTS_API_SECRET;

  if (!publicId) {
    throw new Error("CLOUDPAYMENTS_PUBLIC_ID environment variable is required");
  }

  if (!apiSecret) {
    throw new Error(
      "CLOUDPAYMENTS_API_SECRET environment variable is required"
    );
  }

  return {
    publicId,
    apiSecret,
  };
}

export function getCloudPaymentsPublicId(): string {
  const publicId = process.env.CLOUDPAYMENTS_PUBLIC_ID;
  if (!publicId) {
    throw new Error("CLOUDPAYMENTS_PUBLIC_ID environment variable is required");
  }
  return publicId;
}

export const CLOUDPAYMENTS_API_URL = "https://api.cloudpayments.ru";
