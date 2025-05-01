import chunkify from "chunkify";
import pRetry, { AbortError } from "p-retry";
import {
  fetchModelSpecs,
  getApplicationId,
  getProjectName,
  loadApplicationsFromDirectory,
  loadReview,
  saveFile,
  type Application,
} from "../utils/utils";
import { creditAssignmentAgent } from "../agents/agents/credit-assigner";
import { parseCSV } from "../utils/csv";

interface ScoredReview {
  id: string;
  score: number;
}

interface ReviewChunk {
  id: string;
  [key: string]: any;
}

function parseAndValidateScores(csvContent: string): ScoredReview[] {
  return parseCSV(csvContent)
    .map((row) => {
      const id = row[0];
      const score = Number(row[1]);
      if (id === "id") return null;
      if (!id || !score || isNaN(score)) {
        throw new AbortError(`Invalid score: ${row}`);
      }
      return { id, score };
    })
    .filter((r) => r !== null);
}

async function loadExistingChunk(
  filePath: string
): Promise<ScoredReview[] | null> {
  try {
    const fs = require("fs");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return parseAndValidateScores(content);
    }
    return null;
  } catch (error) {
    console.log(`Failed to load existing chunk ${filePath}:`, error);
    return null;
  }
}

async function processReviewChunk(
  reviewChunk: ReviewChunk[],
  agentName: string,
  chunkIndex: number
): Promise<ScoredReview[]> {
  const filePath = `scores/credit-assignment-${agentName}-${chunkIndex}.csv`;
  console.log("Processing chunk:", filePath);
  // Try to load existing chunk
  const existingScores = await loadExistingChunk(filePath);
  if (existingScores?.length) {
    console.log(`Loaded existing scores for chunk ${chunkIndex}`);
    return existingScores;
  }

  const result = await creditAssignmentAgent.generate(
    createPrompt(reviewChunk)
  );

  console.log(result.text);
  saveFile(filePath, result.text);

  return parseAndValidateScores(result.text);
}

function createPrompt(reviewChunk: ReviewChunk[]) {
  return `
  Score each application review based on how much funding the project deserves. Distribute the total score across all reviews so that the **sum of all scores is exactly 1.0000**.

  **Input reviews (JSON):**
  ${JSON.stringify(reviewChunk)}

  There are **${reviewChunk.length} reviews**, so you must return **exactly ${
    reviewChunk.length
  } lines** in the output.

  **Output format (strict):**
  Return only plain text in CSV format, with **no header**, **no markdown formatting**, and **no extra content**.
  Each line must contain:
  \`id,score\`
  Use line breaks (\`\n\`) to separate rows. Do not include any names.

  Example:
  1234-567-0xe573019b9f23a496663f5944a83c8acdc99792bfc5f5ad603ee8f6cb0f46f9fe,0.1234
  2345-678-0x62f25a11c2ae5a2af563cc5b1f772b3aebe1bd4a0a82e41a78e61e1db972ad7e,0.8766
  `;
}
function normalizeScores(
  scores: ScoredReview[],
  applications: Application[]
): ScoredReview[] {
  const totalScore = scores.reduce((sum, { score }) => sum + score, 0);

  return scores.map(({ id, score }) => {
    const app = applications.find((a) => getApplicationId(a) === id);

    if (!app) {
      throw new Error(`Application not found for id: ${id}`);
    }

    return {
      id,
      name: getProjectName(app),
      score: score / totalScore,
    };
  });
}

async function main() {
  try {
    const applications = loadApplicationsFromDirectory();
    console.log(`Processing ${applications.length} applications...`);

    const modelSpecs = await fetchModelSpecs();
    const allScores: Record<string, ScoredReview[]> = {};

    // Process each model's reviews
    for (const agent of [modelSpecs[0]]) {
      if (!agent?.name) continue;

      console.log(
        "Credit assignment for:",
        agent.name,
        "Application count:",
        applications.length
      );

      const reviews = applications.map((application) => {
        const id = getApplicationId(application);
        const { score, reviewer, ...review } = loadReview(id, agent.name);
        return { id, ...review };
      });

      const chunkSize = Math.ceil(reviews.length / 4);
      const chunkedReviews = [...chunkify(reviews, chunkSize)];
      const agentScores: ScoredReview[] = [];

      for (let index = 0; index < chunkedReviews.length; index++) {
        console.log("Scoring chunk:", index, "of size:", chunkSize);
        const chunkScores = await pRetry(
          () =>
            processReviewChunk(chunkedReviews[index] || [], agent.name, index),
          { retries: 2 }
        );
        agentScores.push(...chunkScores);
      }

      const normalizedScores = normalizeScores(agentScores, applications);
      allScores[agent.name] = normalizedScores;

      saveFile(
        `scores/credit-assignment-${agent.name}.csv`,
        normalizedScores.map((r) => `${r.id},${r.score}`).join("\n")
      );
    }

    console.log(
      "Done! Individual agent scores saved to scores/credit-assignment-{agent}.csv files"
    );
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
