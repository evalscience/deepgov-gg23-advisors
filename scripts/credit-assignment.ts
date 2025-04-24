import {
  fetchModelSpecs,
  getApplicationId,
  loadApplicationsFromDirectory,
  loadReview,
  saveFile,
} from "../utils/utils";

import { creditAssignmentAgent } from "../agents/agents/credit-assigner";

async function main() {
  const applications = loadApplicationsFromDirectory();

  console.log(`Processing ${applications.length} applications...`);

  const modelSpecs = await fetchModelSpecs();

  const reviews = modelSpecs.reduce(
    (agentMap, agent) => ({
      ...agentMap,
      [agent?.name]: applications.map((application) => {
        const id = getApplicationId(application);
        const { score, ...review } = loadReview(id, agent?.name);
        return { id, ...review };
      }),
    }),
    {}
  );

  await Promise.all(
    Object.entries(reviews).map(async ([agent, list]) => {
      const prompt = `
Score each application review based on how much funding the project deserve.

The total score of all reviews should be 1.0000.

**Reviews:**
${JSON.stringify(list)}

Return the comma-separated values:
id,name,score
id,name,score
...
`;
      console.log(prompt);
      const result = await creditAssignmentAgent.generate(prompt);

      console.log(agent);
      console.log(result.text);
      console.log("\n\n");

      saveFile(`scores/credit-assignment-${agent}.csv`, result.text);
    })
  );
}

// Run the main function with error handling
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
