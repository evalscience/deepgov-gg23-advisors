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
  type KarmaGrants,
  loadKarmaGap,
  loadResearch,
} from "../utils/utils";
import { evaluationAgent } from "../agents/agents/evaluator";

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
      const { chainId, roundId } = application;
      console.log(application?.chainId, application.roundId);

      const applicationId = getApplicationId(application);

      const karmaGrants = parseKarmaGap(loadKarmaGap(applicationId));
      console.log(JSON.stringify(karmaGrants, null, 2));
      console.log(
        "🔍 Starting research on Project...\n",
        getProjectName(application)
      );
      const {
        roundMetadata: { name, eligibility },
      } = loadRoundDetails(chainId, roundId);
      return Promise.all(
        modelSpecs.map(async (agent) => {
          const reviewExists = loadReview(applicationId, agent?.name);

          console.log(reviewExists);
          if (reviewExists) {
            console.log("Review already exists, skipping...");
            return;
          }

          const research = loadResearch(applicationId);

          const prompt = `
Today's date is ${new Date().toLocaleDateString()}.

Evaluate the following grant application based on the provided model specification.

Review the application and use the research information as a reference to provide very strict and objective evaluation.

Please analyze the following:
**Round details**
${JSON.stringify({ name, eligibility })}

**Grant Application:**  
${JSON.stringify(application)}

**Previous Grants:**  
${JSON.stringify(karmaGrants)}

**Research:**  
${JSON.stringify(research)}

**Model Specification:**  
${agent.constitution}

Write the review as this persona:
${agent.style}
        `;

          console.log("Reviewing application with agent:", agent.name);
          const result = await evaluationAgent.generate(prompt, {
            output: ReviewSchema,
          });
          // console.log(result.text);

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
  // process.exit(1);
});

function parseKarmaGap({ grants }: { grants: KarmaGrants[] }) {
  return grants.map((grant) => ({
    details: grant.details.data,
    milestones: grant.milestones.map((milestone) => ({
      ...milestone.data,
      endsAt: new Date(milestone.data.endsAt * 1000).toLocaleDateString(),
    })),
  }));
}
