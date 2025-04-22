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

const limit = pLimit(5);

async function main() {
  const applications = loadApplicationsFromDirectory();

  console.log(`Processing ${applications.length} applications...`);

  const researchNetwork = mastra.getNetwork("Research_Network");

  if (!researchNetwork) {
    throw new Error("Research network not found");
  }

  applications.map((application) =>
    limit(async () => {
      // TODO: Should loop through all applications
      const researchExists = loadResearch(getApplicationId(application));

      if (researchExists) {
        console.log("Research already exists, skipping...");
        return;
      }

      console.log(application?.metadata);
      console.log(
        "🔍 Starting research on Project...\n",
        getProjectName(application)
      );
      const prompt = `A Grant Application JSON is provided. Research this project and give me a report on it. Make sure you're researching the correct project because there might be many with the same name.
  ${JSON.stringify(application.metadata)}
  `;

      console.log(prompt);

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
      console.log(researchNetwork.getAgentInteractionHistory());

      saveFile(
        getApplicationPath(getApplicationId(application)) + "/research.json",
        researchNetwork.getAgentInteractionHistory()
      );

      console.log("\n🏁 Research complete!");
    })
  );
}

// Run the main function with error handling
main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
