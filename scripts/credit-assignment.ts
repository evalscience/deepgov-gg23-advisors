import chunkify from "chunkify";

import {
  fetchModelSpecs,
  getApplicationId,
  loadApplicationsFromDirectory,
  loadReview,
  saveFile,
} from "../utils/utils";

import { creditAssignmentAgent } from "../agents/agents/credit-assigner";
import { parseCSV } from "../utils/csv";

import { readFileSync } from "fs";
import type { Review } from "../utils/schemas";

interface ScoredReview {
  id: string;
  name: string;
  score: number;
}

async function main() {
  const applications = loadApplicationsFromDirectory();
  console.log(`Processing ${applications.length} applications...`);

  const modelSpecs = await fetchModelSpecs();
  const allScores: Record<string, ScoredReview[]> = {};

  // Process each model's reviews
  for (const agent of modelSpecs) {
    if (!agent?.name) continue;

    console.log("Credit assignment for: ", agent.name);

    const reviews = applications.map((application) => {
      const id = getApplicationId(application);
      const { score, reviewer, ...review } = loadReview(id, agent.name);
      return { id, ...review };
    });

    const chunkSize = Math.ceil(reviews.length / 3);
    const chunkedReviews = [...chunkify(reviews, chunkSize)];
    const agentScores: ScoredReview[] = [];

    for (const reviewChunk of chunkedReviews) {
      console.log("Scoring chunk with size: ", reviewChunk.length);
      const prompt = `
Score each application review based on how much funding the project deserve.

The total score of all reviews should be 1.0000.

**Reviews:**
${JSON.stringify(reviewChunk)}

ONLY return the comma-separated values (DO NOT use Markdown tags and no header):
id,score
id,score
...
`;
      console.log("generating...");
      const result = await creditAssignmentAgent.generate(prompt);
      console.log("generated");
      console.log(result.text);
      const parsedScores = parseCSV(result.text)
        .map((r) => {
          if (r[0] === "id") {
            return null;
          }
          return {
            id: r[0],
            score: r[1],
          };
        })
        .filter((r) => r);
      console.log("parsedScores", parsedScores);
      agentScores.push(...parsedScores);
    }

    // Normalize scores for this agent to sum to 1.0
    const totalScore = agentScores.reduce((sum, { score }) => sum + score, 0);

    console.log("totalScore", totalScore);
    const normalizedScores = agentScores.map(({ id, score }) => ({
      id,

      score: score / totalScore,
    }));

    allScores[agent.name] = normalizedScores;
    saveFile(
      `scores/credit-assignment-${agent.name}.csv`,
      normalizedScores.map((r) => `${r.id},${r.score}`).join("\n")
    );
  }

  console.log(
    "Done! Individual agent scores saved to scores/credit-assignment-{agent}.csv files"
  );
}

// Run the main function with error handling
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
