import { z } from "zod";

export const ReviewSchema = z.object({
  summary: z
    .string()
    .min(1, "Summary cannot be empty.")
    .describe(
      "A brief overview highlighting key alignment with the selected scoring principles."
    ),
  review: z
    .string()
    .max(200000, "Review must not exceed 200,000 characters.")
    .describe(
      "Comprehensive analysis using Markdown formatting and optional LaTeX for quantitative assessments with motivation and citations from the research."
    ),
  strengths: z
    .array(
      z.object({
        title: z.string(),
        description: z
          .string()
          .describe("A description of the application strengths"),
      })
    )
    .min(1)
    .max(5),
  weaknesses: z
    .array(
      z.object({
        title: z.string(),
        description: z
          .string()
          .describe("A description of the application weaknesses"),
      })
    )
    .min(1)
    .max(5),
  changes: z
    .array(
      z.object({
        title: z.string(),
        description: z
          .string()
          .describe(
            "A description of the requested changes to the application"
          ),
      })
    )
    .min(1)
    .max(5)
    .describe("Requested changes"),
  rating: z
    .number()
    .min(1)
    .max(10)
    .describe(
      "Rating on a 1-10 scale reflecting overall performance against the selected rubric."
    ),
  confidence: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      "Reviewer's confidence level, where 1 indicates minimal certainty and 5 indicates full conviction."
    ),
  confidenceReasoning: z
    .string()
    .describe(
      "Detailed justification for the reviewer's confidence rating, explaining any uncertainties or certainties encountered."
    ),
  score: z
    .number()
    .min(1)
    .max(10)
    .describe(
      "Rating on a 1-10 scale reflecting overall performance against the selected rubric."
    ),
});

export type Review = z.infer<typeof ReviewSchema>;
