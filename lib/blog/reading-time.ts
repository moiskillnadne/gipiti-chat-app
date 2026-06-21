// Average Russian prose reading speed; tuned a little lower than English (~200).
const WORDS_PER_MINUTE = 180;
// Strip common Markdown punctuation so it does not inflate the word count.
const MARKDOWN_NOISE = /[#>*_`~[\]()!-]/g;
const WHITESPACE = /\s+/;

/**
 * Estimate reading time in whole minutes (minimum 1) from a Markdown body. Pure
 * and isomorphic so the preview tool and the production byline agree.
 */
export function computeReadingTime(markdown: string): number {
  const wordCount = markdown
    .replace(MARKDOWN_NOISE, " ")
    .trim()
    .split(WHITESPACE)
    .filter(Boolean).length;

  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}
