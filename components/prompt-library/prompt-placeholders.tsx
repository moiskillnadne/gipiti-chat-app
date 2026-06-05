const PLACEHOLDER_SPLIT = /(\[[^\]]+\])/g;
const PLACEHOLDER_MATCH = /^\[[^\]]+\]$/;

/**
 * Renders prompt body text with `[плейсхолдеры]` highlighted in citrus.
 * The surrounding container controls typography (size, line-height, wrapping).
 */
export function PromptPlaceholders({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER_SPLIT);
  let offset = 0;

  return (
    <>
      {parts.map((part) => {
        const key = `${offset}:${part}`;
        offset += part.length;

        if (PLACEHOLDER_MATCH.test(part)) {
          return (
            <span
              className="rounded-xs bg-citrus-soft px-1 font-medium text-citrus-deep"
              key={key}
            >
              {part.slice(1, -1)}
            </span>
          );
        }

        return <span key={key}>{part}</span>;
      })}
    </>
  );
}
