import { z } from "zod";

export const ReviewSchema = z.object({
  summary: z.string(),
  review: z
    .string()
    .describe(
      "A review of the application with motivation and citations from the research"
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
  score: z.number().min(0).max(100),
});

export type Review = z.infer<typeof ReviewSchema>;
