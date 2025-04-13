import {
  fetchModelSpecs,
  getApplicationId,
  getApplicationPath,
  getProjectName,
  loadApplicationsFromDirectory,
  loadRoundDetails,
  saveFile,
} from "./utils";
import {
  createEvaluationPrompt,
  evaluationAgent,
} from "../agents/agents/evaluator";
import { z } from "zod";

import pLimit from "p-limit";

const limit = pLimit(3);

async function main() {
  const applications = loadApplicationsFromDirectory("application.json");
  console.log(`Processing ${applications.length} applications...`);

  applications.map((application) =>
    limit(async () => {
      //
      const { chainId, roundId } = application;
      console.log(application?.chainId, application.roundId);
      console.log(
        "🔍 Starting research on Project...\n",
        getProjectName(application)
      );
      const {
        roundMetadata: { name, eligibility },
      } = loadRoundDetails(chainId, roundId);
      console.log({ name, eligibility });

      const modelSpecs = await fetchModelSpecs();
      console.log(modelSpecs);
      return Promise.all(
        modelSpecs.map(async (agent) => {
          const prompt = createEvaluationPrompt({
            application: JSON.stringify(application),
            round: JSON.stringify({ name, eligibility }),
            agent,
          });
          console.log("Reviewing application with agent:", agent.name);
          const result = await evaluationAgent.generate(prompt, {
            output: ReviewSchema,
          });
          console.log(result.object);

          const id = getApplicationId(application);
          saveFile(
            getApplicationPath(id) + `/review-${agent.name}.json`,
            result.object
          );

          return result.object;
        })
      );
    })
  );
}

// Run the main function with error handling
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});

const ReviewSchema = z.object({
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
