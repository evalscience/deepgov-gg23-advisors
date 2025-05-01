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

  const prompt = createPrompt(reviewChunk);
  console.log("Prompt length:", prompt.length);
  const result = await creditAssignmentAgent.generate(prompt);

  console.log(result.text);
  saveFile(filePath, result.text);

  return parseAndValidateScores(result.text);
}

function createPrompt(reviewChunk: ReviewChunk[]) {
  return `
Score each application review based on how much funding the project deserves. Distribute the scores so that the total sum of all scores is exactly 1.0000.

Input:
${JSON.stringify(reviewChunk)}

There are ${reviewChunk.length} reviews, so your output must contain exactly ${
    reviewChunk.length
  } lines.

Output requirements (strict):
- Return only plain text, no Markdown or extra content.
- Each line must be in the form: id,score
- Use the exact id string from each input review (no changes).
- Score must have 4 decimal places.
- Lines separated by a single newline (\n), with no trailing newline.
- Do not include headers, numbering, names, or any explanatory text.
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
    for (const agent of modelSpecs) {
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
