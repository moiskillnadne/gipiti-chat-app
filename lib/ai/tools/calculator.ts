import { tool } from "ai";
import { evaluate } from "mathjs";
import { z } from "zod";

export const calculator = tool({
  description: `Perform mathematical calculations and evaluate complex expressions. Use this tool when:
- User asks for arithmetic calculations (addition, subtraction, multiplication, division)
- User needs to evaluate mathematical expressions with parentheses
- User requests scientific calculations (trigonometry, logarithms, square roots)
- User needs to work with mathematical constants (pi, e)
- User asks "what is", "calculate", "compute", or similar for math problems

Examples:
- "What is 2 + 2?"
- "Calculate sqrt(144) * sin(pi/2)"
- "What's 15% of 200?"
- "Compute (5 + 3) * 2 - 10 / 5"

Supported operations:
- Basic: +, -, *, /, ^, %
- Functions: sqrt, abs, sin, cos, tan, log (natural log), log10, exp, ceil, floor, round
- Constants: pi, e
Note: log() is natural logarithm (ln), use log10() for base-10 logarithm

Do NOT use this tool for:
- Simple number formatting or display
- Non-mathematical queries
- Unit conversions (unless purely mathematical)`,
  inputSchema: z.object({
    expression: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "The mathematical expression to evaluate (e.g., '2 + 2', 'sqrt(16) * 3', 'sin(pi/2)')"
      ),
    precision: z
      .number()
      .int()
      .min(0)
      .max(15)
      .optional()
      .default(10)
      .describe("Number of decimal places for the result (default: 10)"),
  }),
  execute: ({ expression, precision = 10 }) => {
    try {
      const result = evaluate(expression);

      if (typeof result === "number") {
        if (!Number.isFinite(result)) {
          return {
            error: "Result is not a finite number (infinity or undefined)",
            expression,
          };
        }

        const roundedResult =
          precision === 0
            ? Math.round(result)
            : Number(result.toFixed(precision));

        return {
          expression,
          result: roundedResult,
          formatted: `${expression} = ${roundedResult}`,
        };
      }

      if (typeof result === "object" && result !== null) {
        return {
          expression,
          result: String(result),
          formatted: `${expression} = ${String(result)}`,
          note: "Result is a complex or matrix value",
        };
      }

      return {
        expression,
        result: String(result),
        formatted: `${expression} = ${String(result)}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        const errorMessage = error.message;
        let hint: string | undefined;

        if (errorMessage.includes("Undefined symbol")) {
          hint =
            "Check if you're using a valid function or constant. Available: sqrt, sin, cos, tan, log, ln, exp, pi, e";
        } else if (
          errorMessage.includes("Unexpected") ||
          errorMessage.includes("Value expected")
        ) {
          hint =
            "Check your expression syntax. Make sure parentheses are balanced.";
        } else if (errorMessage.includes("division by zero")) {
          hint = "Cannot divide by zero.";
        }

        return {
          error: errorMessage,
          hint,
          expression,
        };
      }

      return {
        error: "An unknown error occurred while evaluating the expression",
        expression,
      };
    }
  },
});
