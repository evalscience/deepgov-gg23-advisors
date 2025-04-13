import { openai } from "@ai-sdk/openai";
import { Agent } from "@mastra/core/agent";

export const evaluationAgent = new Agent({
  name: "Evaluation Agent",
  instructions: `
    You are an experienced and very strict grant evaluator with deep domain knowledge and expertise in assessing grant applications. 
    You have access to both the round details and full grant application text to the specific project.
    Additionally, you are provided with a model specification that outlines constitutional principles and values. 
    Your task is to evaluate this grant application in a strict and fair, objective, and thorough manner. 
    Find strengths, weaknesses, and requested changes.
    `,
  model: openai("gpt-4o"),
  // model: anthropic("claude-3-5-sonnet-20240620"),
});

export const createEvaluationPrompt = ({
  application,
  round,
  agent,
}: {
  application: string;
  round: string;
  // research: string;
  agent: { constitution: string; style: string };
}) => `

  Evaluate the following grant application based on the provided model specification.
  
  Review the application and use the research information as a reference to provide a fair and objective evaluation.
  
  Please analyze the following:
  
  **Grant Application:**  
  ${application}

  **Round details**
  ${round}
  
  **Model Specification:**  
  ${agent.constitution}
  
  Reply in the style of:
  ${agent.style}
`;
