import {
  fetchModelSpecs,
  getApplicationId,
  getApplicationPath,
  getProjectName,
  loadApplicationsFromDirectory,
  loadReview,
  loadReviewsFromDirectory,
  loadRoundDetails,
  saveFile,
} from "../utils/utils";
import {
  createEvaluationPrompt,
  evaluationAgent,
} from "../agents/agents/evaluator";

import pLimit from "p-limit";
import { ReviewSchema } from "../utils/schemas";

const limit = pLimit(3);

async function main() {
  const applications = loadApplicationsFromDirectory("application.json");
  const reviews = loadReviewsFromDirectory();
  console.log(`Processing ${applications.length} applications...`);
  console.log(`Processing ${reviews.length / 3} reviews...`);

  const modelSpecs = await fetchModelSpecs();

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
      return Promise.all(
        modelSpecs.map(async (agent) => {
          const reviewExists = loadReview(chainId, roundId, agent.name);

          if (reviewExists) {
            console.log("Review already exists, skipping...");
            return;
          }

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
          saveFile(getApplicationPath(id) + `/review-${agent.name}.json`, {
            reviewer: agent.name,
            ...result.object,
          });

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
