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
  loadHypercerts,
  parseHypercerts,
} from "../utils/utils";

import { creditAssignmentAgent } from "../agents/agents/credit-assigner";

// Core Elo scoring parameters
const BASE_RATING = 1000;
// INCREASE K_FACTOR SIGNIFICANTLY to amplify small magnitude differences
const K_FACTOR = 32; // Was 32, then 128

// Helper: Calculate expected score between two ratings (Standard Elo - currently unused in rating updates)
function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

// Helper: Update Elo rating after a matchup (Standard Elo - currently unused)
function updateElo(rating: number, expected: number, actual: number): number {
  return rating + K_FACTOR * (actual - expected);
}

// New Helper: Update rating based *only* on the actual score magnitude from the match
// function updateRatingDirectly(rating: number, actual: number): number {
//     // actual is the score for *this* player (0 to 1, derived from magnitude 0.5-1.0)
//     // differenceFromNeutral will be positive for wins (>0.5), negative for losses (<0.5)
//     const differenceFromNeutral = actual - 0.5;
//     // Adjust rating based on deviation from neutral, scaled by K_FACTOR
//     return rating + K_FACTOR * differenceFromNeutral;
// }

// Helper to safely get the 'output' of the last research entry for a specific agent
// Assumes input is a valid array with at least one element
const getResearchOutput = (researchAgentArray: any[]): string | undefined => {
  // Access the last element safely and return its output field (if it exists)
  return researchAgentArray[researchAgentArray.length - 1]?.output;
}

// Helper function to process research data for a single agent type
const processResearchAgent = (appName: string, agentKey: string, agentData: any): string | undefined => {
    if (Array.isArray(agentData) && agentData.length > 0) {
        return getResearchOutput(agentData);
    } else if (agentData !== undefined && agentData !== null) {
        // Log if we get something other than undefined/null that's not a non-empty array
        console.warn(`DEBUG: Unexpected research data type for ${appName} -> ${agentKey}. Expected array, got:`, typeof agentData, JSON.stringify(agentData)?.substring(0, 100) + '...');
        return undefined;
    }
    // Return undefined if data is null, undefined, or an empty array
    return undefined;
};

// ANSI escape codes for colors
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    crimson: "\x1b[38m" // Scarlet
  },
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    crimson: "\x1b[48m"
  }
};

async function main() {
  // Load all applications from the directory
  const applications = loadApplicationsFromDirectory();
  console.log(`Processing ${colors.fg.yellow}${applications.length}${colors.reset} applications...`);

  // Pre-load all necessary data for each application
  console.log("Pre-loading application data (app, research, karmagap)...");
  const applicationDataMap = new Map<string, any>();
  

  for (const app of applications) {
    const id = getApplicationId(app);
    const name = getProjectName(app) || id;
    const hypercerts = loadHypercerts(id);
    const hypercertsData = parseHypercerts(hypercerts ?? { data: { hypercerts: { data: [] } } });

    applicationDataMap.set(id, {
      id,
      name,
      application: loadApplication(id),
      research: loadResearch(id), // This loads the whole research object for the ID
      karmaGap: loadKarmaGap(id),
      hypercerts: hypercertsData,
    });
  }
  // Add this logging temporarily AFTER the loop finishes (around line 53)
  const gainForestId = "42161-867-0x62f25a11c2ae5a2af563cc5b1f772b3aebe1bd4a0a82e41a78e61e1db972ad7e"; // Fixed ID
  const treegensId = "42161-867-0xd089724cd73c932413bce5c797aee7d2fbcd1ad282f24cff790977e77908fdca";
  // console.log("DEBUG Preloaded GainForest Data:", JSON.stringify(applicationDataMap.get(gainForestId), null, 2));
  // console.log("DEBUG Preloaded Treegens Data:", JSON.stringify(applicationDataMap.get(treegensId), null, 2));
  // console.log("Finished pre-loading data.");

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
        // We need review data to proceed for this agent
        if (!reviewData) return null;

        // Add the review data to the base data
        return { ...baseData, review: reviewData, ethics: agent.ethics, constitution: agent.constitution, scoring: agent.scoring };
      })
      .filter(Boolean); // Filter out any apps where review data was missing for this agent
    return acc;
  }, {} as Record<string, any[]>);


  // Loop through each agent's reviews
  for (const [agentName, agentApplicationsData] of Object.entries(reviewsByAgent)) {
    console.log(`\n${colors.fg.magenta}🎯 Running Elo tournament for agent: ${colors.bright}${agentName}${colors.reset}`);

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

        // Process research data using the helper function for better debugging
        const academicResearchOutputA = processResearchAgent(appA.name, 'Academic_Research_Agent', appA.research?.Academic_Research_Agent);
        const academicResearchOutputB = processResearchAgent(appB.name, 'Academic_Research_Agent', appB.research?.Academic_Research_Agent);

        const factCheckingOutputA = processResearchAgent(appA.name, 'Fact_Checking_Agent', appA.research?.Fact_Checking_Agent);
        const factCheckingOutputB = processResearchAgent(appB.name, 'Fact_Checking_Agent', appB.research?.Fact_Checking_Agent);

        const webSearchOutputA = processResearchAgent(appA.name, 'Web_Search_Agent', appA.research?.Web_Search_Agent);
        const webSearchOutputB = processResearchAgent(appB.name, 'Web_Search_Agent', appB.research?.Web_Search_Agent);

        const primaryResearchOutputA = processResearchAgent(appA.name, 'Primary_Research_Agent', appA.research?.Primary_Research_Agent);
        const primaryResearchOutputB = processResearchAgent(appB.name, 'Primary_Research_Agent', appB.research?.Primary_Research_Agent);

        const dataAnalysisOutputA = processResearchAgent(appA.name, 'Data_Analysis_Agent', appA.research?.Data_Analysis_Agent);
        const dataAnalysisOutputB = processResearchAgent(appB.name, 'Data_Analysis_Agent', appB.research?.Data_Analysis_Agent);

        // Prepare data snippets for the prompt (avoid stringifying huge objects)
        // Note: application_summary now uses metadata.description if available
        const projectAData = {
          title: appA.name,
          scoring: appA.scoring,
          ethics: appA.ethics,
          constitution: appA.constitution,
          application_summary: appA.application?.project?.metadata?.description ?? appA.application?.project?.description, // Use metadata first
          karmagap_score: appA.karmaGap?.score,
          reviewer_comment: appA.review?.comments,
          academic_research: academicResearchOutputA,
          fact_checking: factCheckingOutputA,
          web_search: webSearchOutputA,
          primary_research: primaryResearchOutputA,
          data_analysis: dataAnalysisOutputA,
          hypercerts: appA.hypercerts
        };
        const projectBData = {
          title: appB.name,
          scoring: appB.scoring,
          ethics: appB.ethics,
          constitution: appB.constitution,
          application_summary: appB.application?.project?.metadata?.description ?? appB.application?.project?.description, // Use metadata first
          karmagap_score: appB.karmaGap?.score,
          reviewer_comment: appB.review?.comments,
          academic_research: academicResearchOutputB,
          fact_checking: factCheckingOutputB,
          web_search: webSearchOutputB,
          primary_research: primaryResearchOutputB,
          data_analysis: dataAnalysisOutputB,
          hypercerts: appB.hypercerts
        };

        // Refined prompt with clearer scale definitions
        const prompt = `
You are an expert grant allocator reviewing and comparing two different projects. 

Choose the one that deserves *more funding*, based on impact, clarity, roadmap, potential, feasibility, and overall quality presented in the data below.

Consider all available information including application summaries, research reports, fact checks and specific reviewer comments, while considering their particular scoring, ethics and consitution.

You are essentially a judge in the tournament which gives a score based on each Agent's review, so it's important you strongly consider reviewer_comment along with the metric data provided. Give weight to the research outputs (web search, fact checking, academic context) as objective inputs alongside the application summary (project's own description) and the reviewer's subjective comment.

Respond ONLY with "A" or "B". Do NOT explain.

--- Project A ---
${JSON.stringify(projectAData, null, 2)}

--- Project B ---
${JSON.stringify(projectBData, null, 2)}
`;

        const result = await creditAssignmentAgent.generate(prompt);

        const winner = result.text.trim().toUpperCase();
        console.log(`Match: ${colors.fg.cyan}${appA.name}${colors.reset} vs ${colors.fg.cyan}${appB.name}${colors.reset} -> Winner: ${winner === "A" || winner === "B" ? colors.fg.green : colors.fg.yellow}${winner}${colors.reset}`);

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
          // If the response is neither A nor B, treat it as a draw.
          // Elo ratings don't change for a draw with actual scores of 0.5 vs 0.5 against expected.
          ratings[appA.id] = updateElo(ratingA, expectedA, 0.5);
          ratings[appB.id] = updateElo(ratingB, expectedB, 0.5);
          console.warn(`⚠️ ${colors.fg.yellow}Unexpected response: "${result.text.trim()}". Treating as a draw.${colors.reset}`);
        }
        // Optional: Log rating changes if needed for debugging
        // console.log(`  Ratings: A=${ratings[appA.id]!.toFixed(1)}, B=${ratings[appB.id]!.toFixed(1)}`);

      }
    }

    // Log raw final scores before normalization
    console.log("Raw final ratings:", JSON.stringify(ratings, null, 2));


    // Normalize scores so they sum to 1 (for funding allocation)
    const totalScore = Object.values(ratings).reduce((sum, score) => sum + score, 0);
    const normalized = Object.entries(ratings).map(([id, score]) => {
      const name = applicationDataMap.get(id)?.name || id;
      // Ensure score is not negative before normalization, although unlikely with BASE_RATING=1000 and K=128 unless many losses occur
      const nonNegativeScore = Math.max(0, score);
      // Prevent division by zero or negative totals
      const safeTotalScore = Math.max(1, totalScore); // Avoid total being 0 or negative

      return {
        id,
        name,
        score: (nonNegativeScore / safeTotalScore).toFixed(6),
      };
    });

    // Prepare output CSV format
    const output = ["id,name,score", ...normalized.map((r) => `${r.id},${r.name},${r.score}`)].join("\n");

    // Save results to file
    saveFile(`scores/elo-credit-assignment-${agentName}.csv`, output);
    console.log(`${colors.fg.green}✅ Saved results for ${agentName}${colors.reset}`);
  }
}

main().catch((error) => {
  console.error(`${colors.fg.red}❌ Error:${colors.reset}`, error);
  process.exit(1);
});
