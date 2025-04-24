import {
  fetchModelSpecs,
  getApplicationId,
  loadApplicationsFromDirectory,
  loadReview,
  saveFile,
  loadApplication,
  loadKarmaGap,
  loadResearch,
  getProjectName,
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

  // Pre-load all necessary data for each application
  console.log("Pre-loading application data (app, research, karmagap)...");
  const applicationDataMap = new Map<string, any>();
  for (const app of applications) {
    const id = getApplicationId(app);
    const name = getProjectName(app) || id;
    applicationDataMap.set(id, {
      id,
      name,
      application: loadApplication(id),
      research: loadResearch(id),
      karmaGap: loadKarmaGap(id),
    });
  }
  console.log("Finished pre-loading data.");

  // Get the available review models/agents
  const modelSpecs = await fetchModelSpecs();

  // Load all reviews for all agents, associating with pre-loaded data
  const reviewsByAgent = modelSpecs.reduce((acc, agent) => {
    const agentName = agent?.name;
    acc[agentName] = applications
      .map((app) => {
        const id = getApplicationId(app);
        const baseData = applicationDataMap.get(id);
        if (!baseData) return null;

        const reviewData = loadReview(id, agentName);
        if (!reviewData) return null;

        return { ...baseData, review: reviewData };
      })
      .filter(Boolean);
    return acc;
  }, {} as Record<string, any[]>);

  // Loop through each agent's reviews
  for (const [agentName, agentApplicationsData] of Object.entries(reviewsByAgent)) {
    console.log(`\n🎯 Running Elo tournament for agent: ${agentName}`);

    // Initialize all ratings
    const ratings: Record<string, number> = {};
    for (const { id } of agentApplicationsData) {
      ratings[id] = BASE_RATING;
    }

    // Run simulated pairwise matchups (round-robin style)
    for (let i = 0; i < agentApplicationsData.length; i++) {
      for (let j = i + 1; j < agentApplicationsData.length; j++) {
        const appA = agentApplicationsData[i]!;
        const appB = agentApplicationsData[j]!;

        // Prepare data snippets for the prompt (avoid stringifying huge objects)
        const projectAData = {
          title: appA.name,
          application_summary: appA.application?.project?.description,
          research_summary: appA.research?.summary,
          karmagap_score: appA.karmaGap?.score,
          reviewer_comment: appA.review?.comments
        };
        const projectBData = {
          title: appB.name,
          application_summary: appB.application?.project?.description,
          research_summary: appB.research?.summary,
          karmagap_score: appB.karmaGap?.score,
          reviewer_comment: appB.review?.comments
        };

        const prompt = `
You are a grant allocator reviewing two projects. Consider all available information.

Choose the one that deserves *more funding*, based on impact, clarity, roadmap, potential, and overall quality presented in the data below.

You are essentially a judge in the tournament which gives a score based on each Agent's review, so it's important you strongly consider reviewer_comment along with the metric data provided.
Respond ONLY with "A" or "B". Do NOT explain.

--- Project A ---
${JSON.stringify(projectAData, null, 2)}

--- Project B ---
${JSON.stringify(projectBData, null, 2)}
`;

        const result = await creditAssignmentAgent.generate(prompt);
        const winner = result.text.trim().toUpperCase();

        const ratingA = ratings[appA.id]!;
        const ratingB = ratings[appB.id]!;
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
      const name = applicationDataMap.get(id)?.name || id;
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
