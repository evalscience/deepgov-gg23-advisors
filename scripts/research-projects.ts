import {
  getProjectName,
  loadApplicationsFromDirectory,
} from "../scripts/utils";
import { mastra } from "../agents";

async function main() {
  const applications = loadApplicationsFromDirectory();
  console.log(`Processing ${applications.length} applications...`);

  const researchNetwork = mastra.getNetwork("Research_Network");

  if (!researchNetwork) {
    throw new Error("Research network not found");
  }
  const application = applications[0];

  console.log(application?.metadata.application);
  console.log(
    "🔍 Starting research on Project...\n",
    getProjectName(application)
  );

  return;
  const prompt = `Give me a report on Project`;
  // Generate a report using the research network
  // Using the generate() method as per the API update (MEMORY[8bf54da9-89a8-4e5b-b875-234a1aa8a53b])
  const result = await researchNetwork.stream(prompt, {
    maxSteps: 20, // Allow enough steps for the LLM router to determine the best agents to use
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "error":
        console.error(part.error);
        break;
      case "text-delta":
        process.stdout.write(part.textDelta);
        break;
      case "tool-call":
        console.log(
          `calling tool ${part.toolName} with args ${JSON.stringify(
            part.args,
            null,
            2
          )}`
        );
        break;
      case "tool-result":
        console.log(`tool result ${JSON.stringify(part.result, null, 2)}`);
        break;
    }
  }

  // Display the final result
  console.log("\n\n📝 Final Research Report:\n");

  console.log("\n\n📊 Agent Interaction Summary:");
  console.log(researchNetwork.getAgentInteractionSummary());

  console.log("\n🏁 Research complete!");
}

// Run the main function with error handling
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
