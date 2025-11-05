import en from "../messages/en.json" with { type: "json" };

type Messages = typeof en;

declare global {
  interface IntlMessages extends Messages {}
}
