import type { PaymentStatus } from "@/lib/types";

export type PlanType =
  | "basic_monthly"
  | "basic_quarterly"
  | "basic_annual"
  | "tester_paid";

export type PaymentState = {
  selectedPlan: PlanType;
  isLoading: boolean;
  status: PaymentStatus | null;
  error: string | null;
};

export type PaymentAction =
  | { type: "SELECT_PLAN"; plan: PlanType }
  | { type: "START_PAYMENT" }
  | { type: "SET_STATUS"; status: PaymentStatus }
  | { type: "PAYMENT_FAILED"; error: string | null }
  | { type: "PAYMENT_SUCCEEDED" }
  | { type: "WIDGET_CLOSED" }
  | { type: "RESET" };

export function createInitialState(isTester: boolean): PaymentState {
  return {
    selectedPlan: isTester ? "tester_paid" : "basic_annual",
    isLoading: false,
    status: null,
    error: null,
  };
}

export function paymentReducer(
  state: PaymentState,
  action: PaymentAction
): PaymentState {
  switch (action.type) {
    case "SELECT_PLAN": {
      return {
        ...state,
        selectedPlan: action.plan,
      };
    }

    case "START_PAYMENT": {
      return {
        ...state,
        isLoading: true,
        status: "processing",
        error: null,
      };
    }

    case "SET_STATUS": {
      return {
        ...state,
        status: action.status,
      };
    }

    case "PAYMENT_FAILED": {
      return {
        ...state,
        isLoading: false,
        status: "failed",
        error: action.error,
      };
    }

    case "PAYMENT_SUCCEEDED": {
      return {
        ...state,
        status: "succeeded",
      };
    }

    case "WIDGET_CLOSED": {
      return {
        ...state,
        isLoading: false,
        status: null,
      };
    }

    case "RESET": {
      return {
        ...state,
        isLoading: false,
        status: null,
        error: null,
      };
    }

    default: {
      return state;
    }
  }
}

