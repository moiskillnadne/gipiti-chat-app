import { parseEmphasis } from "@/lib/marketing/model-landings";

/** Renders landing copy with `**bold**` markers as semantic <b> runs. */
export const EmphasizedText = ({ text }: { text: string }) => (
  <>
    {parseEmphasis(text).map((segment) =>
      segment.isBold ? (
        <b className="font-semibold text-white" key={segment.id}>
          {segment.text}
        </b>
      ) : (
        <span key={segment.id}>{segment.text}</span>
      )
    )}
  </>
);
