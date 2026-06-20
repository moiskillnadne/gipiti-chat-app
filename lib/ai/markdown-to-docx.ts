import {
  AlignmentType,
  BorderStyle,
  ExternalHyperlink,
  HeadingLevel,
  type ILevelsOptions,
  ImageRun,
  LevelFormat,
  Paragraph,
  type ParagraphChild,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Token, Tokens } from "marked";
import { lexer } from "marked";
import type { DocxImageMap, ResolvedDocxImage } from "./docx-images";

/**
 * Convert a Markdown string into the `docx` document body (paragraphs + tables).
 *
 * Mirrors the PDF converter (`markdown-to-pdfmake.ts`) for the same Markdown
 * subset: headings, paragraphs, inline bold/italic/strikethrough/inline-code/
 * links, ordered & unordered lists (including nesting), GFM tables, fenced code
 * blocks, blockquotes, horizontal rules, and images. Images are embedded when
 * their URL was pre-resolved into the `imageMap`; otherwise their alt text is
 * kept so meaning is not lost. Ordered lists each get a fresh numbering
 * reference so they restart at 1 — those configs are returned alongside the body
 * and must be passed to the `Document` constructor.
 */

/** Max image width in px so a wide image fits the page content area. */
const MAX_IMAGE_WIDTH_PX = 600;
/** One list-indent step, in twips (~0.5"). */
const LIST_INDENT_STEP = 720;
const LIST_HANGING_INDENT = 360;

const HEADING_BY_DEPTH: Record<
  number,
  (typeof HeadingLevel)[keyof typeof HeadingLevel]
> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};

const LINK_COLOR = "2563EB";
const CODE_COLOR = "B91C1C";
const CODE_FONT = "Courier New";
const CODE_FILL = "F3F4F6";
const RULE_COLOR = "E5E7EB";
const TABLE_BORDER_COLOR = "D1D5DB";
const QUOTE_BAR_COLOR = "D1D5DB";

type BlockElement = Paragraph | Table;

type NumberingConfig = { reference: string; levels: ILevelsOptions[] };

/** Mutable state threaded through the conversion (image map + list numbering). */
type BuildState = {
  imageMap: DocxImageMap;
  numbering: NumberingConfig[];
  orderedRefSeq: number;
};

type InlineMarks = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
};

/** A token that may carry plain text and/or nested inline tokens. */
type TextLikeToken = { text?: string; tokens?: Token[] };

function imageRunFromResolved(image: ResolvedDocxImage): ImageRun {
  let { width, height } = image;
  if (width > MAX_IMAGE_WIDTH_PX) {
    height = Math.round((height * MAX_IMAGE_WIDTH_PX) / width);
    width = MAX_IMAGE_WIDTH_PX;
  }
  return new ImageRun({
    type: image.type,
    data: image.data,
    transformation: { width, height },
  });
}

function makeRun(text: string, marks: InlineMarks): TextRun {
  return new TextRun({
    text,
    bold: marks.bold,
    italics: marks.italics,
    strike: marks.strike,
    ...(marks.code ? { font: CODE_FONT, color: CODE_COLOR } : {}),
    ...(marks.link ? { color: LINK_COLOR, underline: {} } : {}),
  });
}

function inlineTokensToChildren(
  tokens: Token[] | undefined,
  marks: InlineMarks,
  state: BuildState
): ParagraphChild[] {
  if (!tokens || tokens.length === 0) {
    return [];
  }

  const children: ParagraphChild[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text":
      case "escape": {
        const nested = (token as Tokens.Text).tokens;
        if (nested && nested.length > 0) {
          children.push(...inlineTokensToChildren(nested, marks, state));
        } else {
          children.push(makeRun((token as Tokens.Text).text, marks));
        }
        break;
      }
      case "strong":
        children.push(
          ...inlineTokensToChildren(
            (token as Tokens.Strong).tokens,
            { ...marks, bold: true },
            state
          )
        );
        break;
      case "em":
        children.push(
          ...inlineTokensToChildren(
            (token as Tokens.Em).tokens,
            { ...marks, italics: true },
            state
          )
        );
        break;
      case "del":
        children.push(
          ...inlineTokensToChildren(
            (token as Tokens.Del).tokens,
            { ...marks, strike: true },
            state
          )
        );
        break;
      case "codespan":
        children.push(
          makeRun((token as Tokens.Codespan).text, { ...marks, code: true })
        );
        break;
      case "link": {
        const link = token as Tokens.Link;
        children.push(
          new ExternalHyperlink({
            children: inlineTokensToChildren(
              link.tokens,
              { ...marks, link: link.href },
              state
            ),
            link: link.href,
          })
        );
        break;
      }
      case "br":
        children.push(new TextRun({ break: 1 }));
        break;
      case "image": {
        const image = token as Tokens.Image;
        const resolved = state.imageMap.get(image.href);
        if (resolved) {
          children.push(imageRunFromResolved(resolved));
        } else if (image.text) {
          children.push(makeRun(image.text, marks));
        }
        break;
      }
      default: {
        const generic = token as TextLikeToken;
        if (generic.tokens && generic.tokens.length > 0) {
          children.push(
            ...inlineTokensToChildren(generic.tokens, marks, state)
          );
        } else if (typeof generic.text === "string") {
          children.push(makeRun(generic.text, marks));
        }
      }
    }
  }
  return children;
}

const alignmentOf = (
  align: "center" | "left" | "right" | null
): (typeof AlignmentType)[keyof typeof AlignmentType] => {
  if (align === "center") {
    return AlignmentType.CENTER;
  }
  if (align === "right") {
    return AlignmentType.RIGHT;
  }
  return AlignmentType.LEFT;
};

function headingToParagraph(
  heading: Tokens.Heading,
  state: BuildState
): Paragraph {
  return new Paragraph({
    heading: HEADING_BY_DEPTH[heading.depth] ?? HeadingLevel.HEADING_4,
    children: inlineTokensToChildren(heading.tokens, {}, state),
  });
}

function paragraphToParagraph(
  tokens: Token[] | undefined,
  state: BuildState
): Paragraph {
  return new Paragraph({
    children: inlineTokensToChildren(tokens, {}, state),
    spacing: { after: 120 },
  });
}

function codeToParagraph(code: Tokens.Code): Paragraph {
  const lines = code.text.split("\n");
  const children = lines.map(
    (line, index) =>
      new TextRun({
        text: line,
        font: CODE_FONT,
        size: 20,
        break: index === 0 ? 0 : 1,
      })
  );
  return new Paragraph({
    children,
    shading: { type: ShadingType.CLEAR, color: "auto", fill: CODE_FILL },
    spacing: { before: 60, after: 120 },
  });
}

function ruleToParagraph(): Paragraph {
  return new Paragraph({
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 6,
        color: RULE_COLOR,
        space: 1,
      },
    },
    spacing: { before: 120, after: 120 },
  });
}

function tableToTable(table: Tokens.Table, state: BuildState): Table {
  const cellBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: TABLE_BORDER_COLOR,
  };

  const headerRow = new TableRow({
    tableHeader: true,
    children: table.header.map(
      (cell) =>
        new TableCell({
          shading: { type: ShadingType.CLEAR, color: "auto", fill: CODE_FILL },
          children: [
            new Paragraph({
              alignment: alignmentOf(cell.align),
              children: inlineTokensToChildren(
                cell.tokens,
                { bold: true },
                state
              ),
            }),
          ],
        })
    ),
  });

  const bodyRows = table.rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [
                new Paragraph({
                  alignment: alignmentOf(cell.align),
                  children: inlineTokensToChildren(cell.tokens, {}, state),
                }),
              ],
            })
        ),
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: cellBorder,
      bottom: cellBorder,
      left: cellBorder,
      right: cellBorder,
      insideHorizontal: cellBorder,
      insideVertical: cellBorder,
    },
    rows: [headerRow, ...bodyRows],
  });
}

function blockquoteToParagraphs(
  quote: Tokens.Blockquote,
  state: BuildState,
  depth: number
): BlockElement[] {
  const out: BlockElement[] = [];
  for (const token of quote.tokens) {
    if (token.type === "paragraph" || token.type === "text") {
      out.push(
        new Paragraph({
          children: inlineTokensToChildren(
            (token as TextLikeToken).tokens,
            { italics: true },
            state
          ),
          indent: { left: 480 },
          border: {
            left: {
              style: BorderStyle.SINGLE,
              size: 18,
              color: QUOTE_BAR_COLOR,
              space: 12,
            },
          },
          spacing: { after: 120 },
        })
      );
    } else {
      out.push(...blockTokenToElements(token, state, depth));
    }
  }
  return out;
}

function pushOrderedNumbering(
  state: BuildState,
  depth: number,
  start: number
): string {
  const reference = `ol-${state.orderedRefSeq}`;
  state.orderedRefSeq += 1;
  state.numbering.push({
    reference,
    levels: [
      {
        level: 0,
        format: LevelFormat.DECIMAL,
        text: "%1.",
        alignment: AlignmentType.START,
        start,
        style: {
          paragraph: {
            indent: {
              left: LIST_INDENT_STEP * (depth + 1),
              hanging: LIST_HANGING_INDENT,
            },
          },
        },
      },
    ],
  });
  return reference;
}

function listItemToParagraphs(
  item: Tokens.ListItem,
  state: BuildState,
  depth: number,
  orderedRef: string | undefined
): BlockElement[] {
  const out: BlockElement[] = [];
  let markerUsed = false;

  for (const token of item.tokens) {
    if (token.type === "list") {
      out.push(...listToElements(token as Tokens.List, state, depth + 1));
      continue;
    }

    if (token.type === "text" || token.type === "paragraph") {
      const children = inlineTokensToChildren(
        (token as TextLikeToken).tokens,
        {},
        state
      );
      if (markerUsed) {
        out.push(
          new Paragraph({
            children,
            indent: { left: LIST_INDENT_STEP * (depth + 1) },
            spacing: { after: 60 },
          })
        );
      } else {
        out.push(
          new Paragraph({
            children,
            ...(orderedRef
              ? { numbering: { reference: orderedRef, level: 0 } }
              : { bullet: { level: depth } }),
            spacing: { after: 60 },
          })
        );
        markerUsed = true;
      }
      continue;
    }

    out.push(...blockTokenToElements(token, state, depth));
  }

  if (!markerUsed && out.length === 0) {
    out.push(
      new Paragraph(
        orderedRef
          ? { numbering: { reference: orderedRef, level: 0 } }
          : { bullet: { level: depth } }
      )
    );
  }

  return out;
}

function listToElements(
  list: Tokens.List,
  state: BuildState,
  depth: number
): BlockElement[] {
  const start = typeof list.start === "number" ? list.start : 1;
  const orderedRef = list.ordered
    ? pushOrderedNumbering(state, depth, start)
    : undefined;

  const out: BlockElement[] = [];
  for (const item of list.items) {
    out.push(...listItemToParagraphs(item, state, depth, orderedRef));
  }
  return out;
}

function blockTokenToElements(
  token: Token,
  state: BuildState,
  depth: number
): BlockElement[] {
  switch (token.type) {
    case "heading":
      return [headingToParagraph(token as Tokens.Heading, state)];
    case "paragraph":
      return [paragraphToParagraph((token as Tokens.Paragraph).tokens, state)];
    case "text": {
      const textToken = token as Tokens.Text;
      return [
        textToken.tokens
          ? paragraphToParagraph(textToken.tokens, state)
          : new Paragraph({
              children: [new TextRun(textToken.text)],
              spacing: { after: 120 },
            }),
      ];
    }
    case "list":
      return listToElements(token as Tokens.List, state, depth);
    case "table":
      return [tableToTable(token as Tokens.Table, state)];
    case "code":
      return [codeToParagraph(token as Tokens.Code)];
    case "blockquote":
      return blockquoteToParagraphs(token as Tokens.Blockquote, state, depth);
    case "hr":
      return [ruleToParagraph()];
    default:
      return [];
  }
}

export type MarkdownDocxResult = {
  children: BlockElement[];
  numbering: NumberingConfig[];
};

/**
 * Convert Markdown into a `docx` body plus the numbering configs the document
 * needs. Falls back to a single plain paragraph when nothing renders.
 */
export function markdownToDocx(
  markdown: string,
  imageMap: DocxImageMap = new Map()
): MarkdownDocxResult {
  const state: BuildState = { imageMap, numbering: [], orderedRefSeq: 0 };
  const children: BlockElement[] = [];
  for (const token of lexer(markdown)) {
    children.push(...blockTokenToElements(token, state, 0));
  }

  return {
    children:
      children.length > 0
        ? children
        : [new Paragraph({ children: [new TextRun(markdown)] })],
    numbering: state.numbering,
  };
}
