import dotenv from "dotenv";
import {
  getApplicationId,
  getApplicationPath,
  getProjectName,
  loadApplicationsFromDirectory,
  loadResearch,
  saveFile,
} from "../utils/utils";
import { mastra } from "../agents";
import pLimit from "p-limit";

dotenv.config({ path: ".env.local" });
// Types for the research network stream
type StreamPart = {
  type: "error" | "text-delta" | "tool-call" | "tool-result";
  error?: Error;
  textDelta?: string;
  toolName?: string;
  args?: any;
  result?: any;
};

// Constants
const CONCURRENT_LIMIT = 5;
const MAX_RESEARCH_STEPS = 20;

// Initialize the concurrency limiter
const limit = pLimit(CONCURRENT_LIMIT);

/**
 * Processes a single application for research
 */
async function processApplication(application: any, researchNetwork: any) {
  const applicationId = getApplicationId(application);
  const researchExists = loadResearch(applicationId);

  if (researchExists) {
    console.log(
      `Research already exists for ${getProjectName(application)}, skipping...`
    );
    return;
  }

  console.log(
    `🔍 Starting research on Project: ${getProjectName(application)}`
  );

  const prompt = `A Grant Application JSON is provided. Research this project and give me a report on it. Make sure you're researching the correct project because there might be many with the same name.
${JSON.stringify(application.metadata)}`;

  const result = await researchNetwork.generate(prompt, {
    maxSteps: MAX_RESEARCH_STEPS,
  });

  console.log(result.text);
  // Save the research results
  const researchPath = `${getApplicationPath(applicationId)}/research.json`;
  const interactionHistory = researchNetwork.getAgentInteractionHistory();
  console.log(interactionHistory);
  saveFile(researchPath, interactionHistory);
  console.log(`\n🏁 Research complete for ${getProjectName(application)}!`);
}

/**
 * Main function to process all applications
 */
async function main() {
  try {
    const applications = loadApplicationsFromDirectory();
    console.log(`Processing ${applications.length} applications...`);

    const researchNetwork = mastra.getNetwork("Research_Network");
    if (!researchNetwork) {
      throw new Error("Research network not found");
    }
    let i = 1;
    // We need to process applications sequentially otherwise the AgentNetwork will mix up the data
    for (const application of applications) {
      console.log(`Research progress: ${i}/${applications.length}`);
      await processApplication(application, researchNetwork);
      ++i;
    }

    console.log("✅ All research tasks completed successfully!");
  } catch (error) {
    console.error("❌ Error during research process:", error);
    process.exit(1);
  }
}

// Execute the main function
main();
