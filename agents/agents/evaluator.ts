import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";
export const evaluationAgent = new Agent({
  name: "Evaluation Agent",
  instructions: `
    You are an experienced and very strict grant evaluator with deep domain knowledge and expertise in assessing grant applications. 
    You have access to both the round details and full grant application text to the specific project.
    Additionally, you are provided with a model specification that outlines constitutional principles and values. 
    Your task is to evaluate this grant application in a strict and fair, objective, and thorough manner. 
    Find strengths, weaknesses, and requested changes.
    `,
  //model: openai("gpt-4.1-2025-04-14"),
  // model: google("gemini-1.5-pro-latest", {}),
  model: google("gemini-2.5-flash-preview-05-20"),
  // model: anthropic("claude-3-7-sonnet-20250219"),
});
