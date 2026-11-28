import type { KeysetPosition } from "@/server/modules/billing/queries/keyset-position";
import {
  type CardPaymentPageRow,
  listCardPaymentsPage,
} from "@/server/modules/billing/queries/list-card-payments-page";

export type ListCardPaymentsResult = {
  payments: CardPaymentPageRow[];
  /** A next page exists; it starts after the last of `payments`. */
  hasMore: boolean;
};

/** One page of the user's card charges, newest first. */
export const listCardPayments = async ({
  userId,
  limit,
  after,
}: {
  userId: string;
  limit: number;
  after: KeysetPosition | null;
}): Promise<ListCardPaymentsResult> => {
  const page = await listCardPaymentsPage({ userId, limit, after });

  return { payments: page.rows, hasMore: page.hasMore };
};
