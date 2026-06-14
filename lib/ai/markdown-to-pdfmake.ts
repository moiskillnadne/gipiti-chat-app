import type { Token, Tokens } from "marked";
import { lexer } from "marked";
import type { Content } from "pdfmake/interfaces";
import type { PdfImageMap } from "./pdf-images";

/**
 * Convert a Markdown string into a pdfmake content array.
 *
 * Supports the subset the PDF generation feature needs: headings, paragraphs,
 * inline bold/italic/strikethrough/inline-code/links, ordered & unordered lists
 * (including nesting), GFM tables, fenced code blocks, blockquotes, rules, and
 * images. Images are embedded when their URL was pre-resolved into the
 * `imageMap` (see `collectImageUrls` + `resolvePdfImages`); otherwise their alt
 * text is kept so meaning is not lost. Raw HTML blocks are dropped.
 */

/** Content width on A4 (595.28pt) with the 40pt left/right page margins. */
const CONTENT_WIDTH = 515;
/** Max image height so a tall image fits within a page. */
const MAX_IMAGE_HEIGHT = 680;

const HEADING_STYLE_BY_DEPTH: Record<number, string> = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h4",
  6: "h4",
};

const LINK_COLOR = "#2563eb";
const CODESPAN_COLOR = "#b91c1c";
const RULE_COLOR = "#e5e7eb";
const TABLE_BORDER_COLOR = "#d1d5db";
const CODE_FILL_COLOR = "#f3f4f6";
const QUOTE_BAR_COLOR = "#d1d5db";

type InlineRun = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  decoration?: "underline" | "lineThrough";
  link?: string;
  color?: string;
};

type InlineMarks = Omit<InlineRun, "text">;

/** A token that may carry plain text and/or nested inline tokens. */
type TextLikeToken = { text?: string; tokens?: Token[] };

function inlineTokensToRuns(
  tokens: Token[] | undefined,
  marks: InlineMarks
): InlineRun[] {
  if (!tokens || tokens.length === 0) {
    return [];
  }

  const runs: InlineRun[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text":
      case "escape": {
        const nested = (token as Tokens.Text).tokens;
        if (nested && nested.length > 0) {
          runs.push(...inlineTokensToRuns(nested, marks));
        } else {
          runs.push({ text: (token as Tokens.Text).text, ...marks });
        }
        break;
      }
      case "strong":
        runs.push(
          ...inlineTokensToRuns((token as Tokens.Strong).tokens, {
            ...marks,
            bold: true,
          })
        );
        break;
      case "em":
        runs.push(
          ...inlineTokensToRuns((token as Tokens.Em).tokens, {
            ...marks,
            italics: true,
          })
        );
        break;
      case "del":
        runs.push(
          ...inlineTokensToRuns((token as Tokens.Del).tokens, {
            ...marks,
            decoration: "lineThrough",
          })
        );
        break;
      case "codespan":
        runs.push({
          text: (token as Tokens.Codespan).text,
          ...marks,
          color: CODESPAN_COLOR,
        });
        break;
      case "link": {
        const link = token as Tokens.Link;
        runs.push(
          ...inlineTokensToRuns(link.tokens, {
            ...marks,
            link: link.href,
            color: LINK_COLOR,
            decoration: "underline",
          })
        );
        break;
      }
      case "br":
        runs.push({ text: "\n", ...marks });
        break;
      case "image":
        runs.push({ text: (token as Tokens.Image).text, ...marks });
        break;
      default: {
        const generic = token as TextLikeToken;
        if (generic.tokens && generic.tokens.length > 0) {
          runs.push(...inlineTokensToRuns(generic.tokens, marks));
        } else if (typeof generic.text === "string") {
          runs.push({ text: generic.text, ...marks });
        }
      }
    }
  }
  return runs;
}

/** Build the value for a pdfmake `text` field, never empty (pdfmake throws on []). */
function inlineText(tokens: Token[] | undefined): string | InlineRun[] {
  const runs = inlineTokensToRuns(tokens, {});
  return runs.length > 0 ? runs : "";
}

/**
 * Convert a paragraph's (or tight list item's) inline tokens into block content.
 * Inline runs accumulate into text nodes; a resolved image token flushes the
 * pending text and emits a block image. Unresolved images stay as alt text.
 */
function inlineTokensToBlocks(
  tokens: Token[],
  imageMap: PdfImageMap
): Content[] {
  const blocks: Content[] = [];
  let runs: InlineRun[] = [];

  const flushRuns = () => {
    if (runs.length > 0) {
      blocks.push({ text: runs, margin: [0, 0, 0, 8] });
      runs = [];
    }
  };

  for (const token of tokens) {
    const resolved =
      token.type === "image"
        ? imageMap.get((token as Tokens.Image).href)
        : undefined;
    if (resolved) {
      flushRuns();
      blocks.push({
        image: resolved.dataUri,
        fit: [CONTENT_WIDTH, MAX_IMAGE_HEIGHT],
        margin: [0, 0, 0, 8],
      });
    } else {
      runs.push(...inlineTokensToRuns([token], {}));
    }
  }
  flushRuns();

  return blocks.length > 0 ? blocks : [{ text: "", margin: [0, 0, 0, 8] }];
}

function listToContent(list: Tokens.List, imageMap: PdfImageMap): Content {
  const items = list.items.map((item) => listItemToContent(item, imageMap));
  const base = { margin: [0, 0, 0, 8] as [number, number, number, number] };
  if (list.ordered) {
    const start = typeof list.start === "number" ? list.start : 1;
    return start !== 1 ? { ol: items, start, ...base } : { ol: items, ...base };
  }
  return { ul: items, ...base };
}

function listItemToContent(
  item: Tokens.ListItem,
  imageMap: PdfImageMap
): Content {
  const parts = blockTokensToContent(item.tokens, imageMap);
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return { stack: parts };
}

function tableToContent(table: Tokens.Table): Content {
  const widths = table.header.map(() => "*");
  const headerRow: Content[] = table.header.map((cell) => ({
    text: inlineText(cell.tokens),
    style: "tableHeader",
    alignment: cell.align ?? "left",
  }));
  const bodyRows: Content[][] = table.rows.map((row) =>
    row.map((cell) => ({
      text: inlineText(cell.tokens),
      alignment: cell.align ?? "left",
    }))
  );

  return {
    table: { headerRows: 1, widths, body: [headerRow, ...bodyRows] },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => TABLE_BORDER_COLOR,
      vLineColor: () => TABLE_BORDER_COLOR,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 12],
  };
}

function codeToContent(code: Tokens.Code): Content {
  return {
    table: {
      widths: ["*"],
      body: [[{ text: code.text, style: "code", preserveLeadingSpaces: true }]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      fillColor: () => CODE_FILL_COLOR,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 0, 0, 12],
  };
}

function blockquoteToContent(
  quote: Tokens.Blockquote,
  imageMap: PdfImageMap
): Content {
  return {
    table: {
      widths: ["*"],
      body: [[{ stack: blockTokensToContent(quote.tokens, imageMap) }]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (columnIndex: number) => (columnIndex === 0 ? 3 : 0),
      vLineColor: () => QUOTE_BAR_COLOR,
      paddingLeft: () => 10,
      paddingRight: () => 8,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 12],
  };
}

function blockTokenToContent(token: Token, imageMap: PdfImageMap): Content[] {
  switch (token.type) {
    case "heading": {
      const heading = token as Tokens.Heading;
      return [
        {
          text: inlineText(heading.tokens),
          style: HEADING_STYLE_BY_DEPTH[heading.depth] ?? "h4",
        },
      ];
    }
    case "paragraph":
      return inlineTokensToBlocks((token as Tokens.Paragraph).tokens, imageMap);
    case "text": {
      const textToken = token as Tokens.Text;
      if (textToken.tokens) {
        return inlineTokensToBlocks(textToken.tokens, imageMap);
      }
      return [{ text: textToken.text, margin: [0, 0, 0, 8] }];
    }
    case "list":
      return [listToContent(token as Tokens.List, imageMap)];
    case "table":
      return [tableToContent(token as Tokens.Table)];
    case "code":
      return [codeToContent(token as Tokens.Code)];
    case "blockquote":
      return [blockquoteToContent(token as Tokens.Blockquote, imageMap)];
    case "hr":
      return [
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: CONTENT_WIDTH,
              y2: 0,
              lineWidth: 1,
              lineColor: RULE_COLOR,
            },
          ],
          margin: [0, 6, 0, 12],
        },
      ];
    default:
      return [];
  }
}

function blockTokensToContent(
  tokens: Token[],
  imageMap: PdfImageMap
): Content[] {
  const content: Content[] = [];
  for (const token of tokens) {
    content.push(...blockTokenToContent(token, imageMap));
  }
  return content;
}

/**
 * Collect every image URL referenced in the Markdown (block, inline, table
 * cells and list items) so they can be fetched before rendering.
 */
export function collectImageUrls(markdown: string): string[] {
  const urls: string[] = [];

  const visit = (tokens: Token[] | undefined): void => {
    if (!tokens) {
      return;
    }
    for (const token of tokens) {
      if (token.type === "image") {
        urls.push((token as Tokens.Image).href);
      }
      if (token.type === "table") {
        const table = token as Tokens.Table;
        for (const cell of table.header) {
          visit(cell.tokens);
        }
        for (const row of table.rows) {
          for (const cell of row) {
            visit(cell.tokens);
          }
        }
      } else if (token.type === "list") {
        for (const item of (token as Tokens.List).items) {
          visit(item.tokens);
        }
      } else {
        visit((token as TextLikeToken).tokens);
      }
    }
  };

  visit(lexer(markdown));
  return urls;
}

export function markdownToPdfmakeContent(
  markdown: string,
  imageMap: PdfImageMap = new Map()
): Content[] {
  const content = blockTokensToContent(lexer(markdown), imageMap);
  return content.length > 0 ? content : [{ text: markdown }];
}
