import {
  fetchModelSpecs,
  getApplicationId,
  loadApplicationsFromDirectory,
  loadReview,
  saveFile,
} from "../utils/utils";

import { creditAssignmentAgent } from "../agents/agents/credit-assigner";

// Core Elo scoring parameters
const BASE_RATING = 1000;
const K_FACTOR = 32; // Adjust this to control how volatile the scores are

// Helper: Calculate expected score between two ratings
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Helper: Update Elo rating after a matchup
function updateElo(rating: number, expected: number, actual: number): number {
  return rating + K_FACTOR * (actual - expected);
}

async function main() {
  // Load all applications from the directory
  const applications = loadApplicationsFromDirectory();
  console.log(`Processing ${applications.length} applications...`);

  // Get the available review models/agents
  const modelSpecs = await fetchModelSpecs();

  // Load all reviews for all agents
  const reviewsByAgent = modelSpecs.reduce((acc, agent) => {
    const agentName = agent?.name;
    acc[agentName] = applications.map((app) => {
      const id = getApplicationId(app);
      const { score, ...review } = loadReview(id, agentName);
      return { id, name: review.project?.title || id, review };
    });
    return acc;
  }, {} as Record<string, { id: string; name: string; review: any }[]>);

  // Loop through each agent's reviews
  for (const [agentName, reviews] of Object.entries(reviewsByAgent)) {
    console.log(`\n🎯 Running Elo tournament for agent: ${agentName}`);

    // Initialize all ratings
    const ratings: Record<string, number> = {};
    for (const { id } of reviews) {
      ratings[id] = BASE_RATING;
    }

    // Run simulated pairwise matchups (round-robin style)
    for (let i = 0; i < reviews.length; i++) {
      for (let j = i + 1; j < reviews.length; j++) {
        const appA = reviews[i];
        const appB = reviews[j];

        const prompt = `
You are comparing two grant applications.

Based on their reviews, which project deserves *more* funding?

Respond with just "A" or "B".

Project A:
${JSON.stringify(appA.review, null, 2)}

Project B:
${JSON.stringify(appB.review, null, 2)}
`;

        const result = await creditAssignmentAgent.generate(prompt);
        const winner = result.text.trim().toUpperCase();

        const ratingA = ratings[appA.id];
        const ratingB = ratings[appB.id];
        const expectedA = expectedScore(ratingA, ratingB);
        const expectedB = expectedScore(ratingB, ratingA);

        if (winner === "A") {
          ratings[appA.id] = updateElo(ratingA, expectedA, 1);
          ratings[appB.id] = updateElo(ratingB, expectedB, 0);
        } else if (winner === "B") {
          ratings[appA.id] = updateElo(ratingA, expectedA, 0);
          ratings[appB.id] = updateElo(ratingB, expectedB, 1);
        } else {
          console.warn(`⚠️ Unexpected response: ${result.text}`);
        }
      }
    }

    // Normalize scores so they sum to 1 (for funding allocation)
    const totalScore = Object.values(ratings).reduce((sum, score) => sum + score, 0);
    const normalized = Object.entries(ratings).map(([id, score]) => {
      const name = reviews.find((r) => r.id === id)?.name || id;
      return {
        id,
        name,
        score: (score / totalScore).toFixed(6),
      };
    });

    // Prepare output CSV format
    const output = ["id,name,score", ...normalized.map((r) => `${r.id},${r.name},${r.score}`)].join("\n");

    // Save results to file
    saveFile(`scores/elo-credit-assignment-${agentName}.csv`, output);
    console.log(`✅ Saved results for ${agentName}`);
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
