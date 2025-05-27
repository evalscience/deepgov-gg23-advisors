import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";

export const creditAssignmentAgent = new Agent({
  name: "Credit Assignment Agent",
  instructions: `
   You are an expert credit assignment agent.
   You are given a list of applications reviews and you should assign a score between 0.00 and 1.00 to each review based on how much funding the project deserve.
   The total score of all reviews should be 1.00.
   `,
   model: google("gemini-2.5-flash-preview-05-20"),
});
