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
  loadHypercerts,
} from "../utils/utils";
import { evaluationAgent } from "../agents/agents/evaluator";

import pLimit from "p-limit";
import { ReviewSchema } from "../utils/schemas";
import { walkDirectory } from "../utils/utils";

const limit = pLimit(10);

// Add interface for tracking failures
interface FailedApplication {
  applicationId: string;
  projectName: string;
  agentName: string;
  error: string;
}

async function processApplication(application: any, modelSpecs: any[]) {
  // Validate application parameter
  if (!application) {
    console.error("❌ Application is null or undefined, skipping...");
    return null;
  }

  if (!application.chainId || !application.roundId) {
    console.error("❌ Application missing chainId or roundId:", application);
    return null;
  }

  const { chainId, roundId } = application;
  console.log(`Processing application for chain ${chainId}, round ${roundId}`);

  const applicationId = getApplicationId(application);
  const karmaGap = loadKarmaGap(applicationId);
  const karmaGrants = parseKarmaGap(karmaGap ?? { grants: [] });
  const hypercerts = loadHypercerts(applicationId);
  const hypercertsData = parseHypercerts(
    hypercerts ?? { data: { hypercerts: { data: [] } } }
  );

  console.log("🔍 Starting review on Project:", getProjectName(application));

  const {
    roundMetadata: { name, eligibility },
  } = loadRoundDetails(chainId, roundId);
  const research = loadResearch(applicationId);

  const results = await Promise.allSettled(
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

**Hypercerts Attestations:**  
${JSON.stringify(hypercertsData)}

**Model Specification:**  
${agent.ethics}
${agent.constitution}
${agent.scoring}

IMPORTANT. Flag ONLY if there are ethical concerns and NOT because of your constitution.

Write the review as this persona:
${agent.style}
`;

      console.log(`Reviewing application with agent: ${agent.name}`);
      try {
        const result = await evaluationAgent.generate(prompt, {
          output: ReviewSchema,
        });

        const id = getApplicationId(application);
        saveFile(getApplicationPath(id) + `/review-${agent.name}.json`, {
          reviewer: agent.name,
          ...result.object,
        });

        return result.object;
      } catch (error) {
        console.error(`❌ AI Error for agent ${agent.name}:`, error);
        // Return error info instead of throwing
        return {
          error: true,
          applicationId,
          projectName: getProjectName(application),
          agentName: agent.name,
          errorMessage: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  // Collect any failures from this application
  const failures: FailedApplication[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failures.push({
        applicationId,
        projectName: getProjectName(application),
        agentName: modelSpecs[index]?.name || "unknown",
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    } else if (
      result.status === "fulfilled" &&
      result.value &&
      typeof result.value === "object" &&
      result.value !== null &&
      "error" in result.value
    ) {
      const errorResult = result.value as {
        error: boolean;
        applicationId: string;
        projectName: string;
        agentName: string;
        errorMessage: string;
      };
      failures.push({
        applicationId: errorResult.applicationId,
        projectName: errorResult.projectName,
        agentName: errorResult.agentName,
        error: errorResult.errorMessage,
      });
    }
  });

  return failures;
}

async function main() {
  try {
    const applications = loadApplicationsFromDirectory("application.json");
    const reviews = loadReviewsFromDirectory();

    // Filter out invalid applications
    const validApplications = applications.filter((app, index) => {
      if (!app) {
        console.warn(
          `⚠️ Application at index ${index} is null/undefined, skipping`
        );
        return false;
      }
      if (!app.chainId || !app.roundId || !app.projectId) {
        console.warn(
          `⚠️ Application at index ${index} missing required fields:`,
          {
            chainId: app.chainId,
            roundId: app.roundId,
            projectId: app.projectId,
          }
        );
        return false;
      }
      return true;
    });

    // Calculate unique applications that have reviews
    const reviewedApplications = new Set();
    for (const filePath of walkDirectory("applications")) {
      if (filePath.includes("review-") && filePath.endsWith(".json")) {
        // Extract application ID from the file path
        const pathParts = filePath.split("/");
        const applicationId = `${pathParts[1]}-${pathParts[2]}-${pathParts[3]}`;
        reviewedApplications.add(applicationId);
      }
    }

    console.log(
      `Processing ${validApplications.length} valid applications (${
        applications.length - validApplications.length
      } invalid skipped)...`
    );
    console.log(
      `Found ${reviews.length} review files for ${reviewedApplications.size} applications...`
    );

    const modelSpecs = await fetchModelSpecs();

    // Collect all failures
    const allFailures: FailedApplication[] = [];

    const results = await Promise.all(
      validApplications.map((application) =>
        limit(() => processApplication(application, [modelSpecs[3]]))
      )
    );

    // Collect failures from all applications
    results.forEach((failures) => {
      if (failures && Array.isArray(failures) && failures.length > 0) {
        allFailures.push(...failures);
      }
    });

    // Log summary of failures
    if (allFailures.length > 0) {
      console.log(
        `\n❌ Failed Reviews Summary (${allFailures.length} failures):`
      );
      console.log("=".repeat(60));

      // Group failures by project
      const failuresByProject = allFailures.reduce((acc, failure) => {
        if (!acc[failure.projectName]) {
          acc[failure.projectName] = [];
        }
        acc[failure.projectName].push(failure);
        return acc;
      }, {} as Record<string, FailedApplication[]>);

      Object.entries(failuresByProject).forEach(([projectName, failures]) => {
        console.log(`\n📋 Project: ${projectName}`);
        failures.forEach((failure) => {
          console.log(`  • Agent: ${failure.agentName}`);
          console.log(
            `    Error: ${failure.error.substring(0, 100)}${
              failure.error.length > 100 ? "..." : ""
            }`
          );
        });
      });

      // Save failures to a log file
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const failureLogPath = `logs/failed-reviews-${timestamp}.json`;
      saveFile(failureLogPath, {
        timestamp: new Date().toISOString(),
        totalFailures: allFailures.length,
        failedProjects: Object.keys(failuresByProject).length,
        failures: allFailures,
      });

      console.log(`\n📝 Failure log saved to: ${failureLogPath}`);
    } else {
      console.log("\n✅ All reviews completed successfully!");
    }

    console.log(`\n🎉 Processing completed. Check logs for any failures.`);
  } catch (error) {
    console.error("❌ Fatal Error:", error);
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

// Interfaces for Hypercerts
interface HypercertAttestation {
  attester: string;
  creation_block_timestamp: string;
  data: {
    title: string;
    sources: string[];
    chain_id: number;
    token_id: string;
    description: string;
    contract_address: string;
  };
  id: string;
}

interface HypercertData {
  hypercert_id: string;
  metadata: {
    name: string;
    description: string;
  };
  attestations: {
    data: HypercertAttestation[];
  };
}

interface HypercertsResponse {
  data: {
    hypercerts: {
      count: number;
      data: HypercertData[];
    };
  };
}

function parseHypercerts(hypercerts: HypercertsResponse) {
  if (!hypercerts?.data?.hypercerts?.data) {
    return [];
  }

  return hypercerts.data.hypercerts.data.flatMap((hypercert) => {
    const { hypercert_id, metadata } = hypercert;

    if (
      !hypercert.attestations?.data ||
      hypercert.attestations.data.length === 0
    ) {
      return [];
    }

    return hypercert.attestations.data.map((attestation) => ({
      hypercert_id,
      metadata,
      attester: attestation.attester,
      timestamp: new Date(
        parseInt(attestation.creation_block_timestamp) * 1000
      ).toLocaleDateString(),
      title: attestation.data.title,
      description: attestation.data.description,
      sources: attestation.data.sources,
    }));
  });
}
