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

const limit = pLimit(10);

async function processApplication(application: any, modelSpecs: any[]) {
  const { chainId, roundId } = application;
  console.log(`Processing application for chain ${chainId}, round ${roundId}`);

  const applicationId = getApplicationId(application);
  const karmaGap = loadKarmaGap(applicationId);
  const karmaGrants = parseKarmaGap(karmaGap ?? { grants: [] });

  console.log("🔍 Starting research on Project:", getProjectName(application));

  const {
    roundMetadata: { name, eligibility },
  } = loadRoundDetails(chainId, roundId);
  const research = loadResearch(applicationId);

  return Promise.all(
    modelSpecs.map(async (agent) => {
      const reviewExists = loadReview(applicationId, agent?.name);
      if (reviewExists) {
        console.log(
          `Review already exists for agent ${agent.name}, skipping...`
        );
        return null;
      }

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
${agent.ethics}
${agent.constitution}
${agent.scoring}

Write the review as this persona:
${agent.style}
      `;

      console.log(`Reviewing application with agent: ${agent.name}`);
      const result = await evaluationAgent.generate(prompt, {
        output: ReviewSchema,
      });

      const id = getApplicationId(application);
      saveFile(getApplicationPath(id) + `/review-${agent.name}.json`, {
        reviewer: agent.name,
        ...result.object,
      });

      return result.object;
    })
  );
}

async function main() {
  try {
    const applications = loadApplicationsFromDirectory("application.json");
    const reviews = loadReviewsFromDirectory();
    console.log(`Processing ${applications.length} applications...`);
    console.log(`Processing ${reviews.length / 3} reviews...`);

    const modelSpecs = await fetchModelSpecs();

    await Promise.all(
      applications.map((application) =>
        limit(() => processApplication(application, modelSpecs))
      )
    );
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

// Run the main function
main();

interface MilestoneData {
  title: string;
  description: string;
  endsAt: number;
  startsAt?: number;
  type: string;
  priority?: number;
}

interface Milestone {
  data: MilestoneData;
}

interface GrantDetails {
  data: {
    proposalURL?: string;
    title?: string;
    amount?: string;
    payoutAddress?: string;
    type?: string;
    programId?: string;
    description?: string;
  };
}

interface Grant {
  details: GrantDetails;
  milestones: Milestone[];
}

interface KarmaGapData {
  grants: Grant[];
}

function parseKarmaGap({ grants }: KarmaGapData) {
  return grants.map((grant) => ({
    details: grant.details.data,
    milestones: grant.milestones.map((milestone) => ({
      ...milestone.data,
      endsAt: new Date(milestone.data.endsAt * 1000).toLocaleDateString(),
    })),
  }));
}
