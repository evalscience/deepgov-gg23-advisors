import pLimit from "p-limit";
import type { KarmaProject, KarmaResult, KarmaGrants } from "../utils/utils";
import {
  loadApplicationsFromDirectory,
  getApplicationId,
  getProjectName,
  saveFile,
  getApplicationPath,
} from "../utils/utils";

const limit = pLimit(10);

async function main() {
  // Load all files in /applications
  const applications = loadApplicationsFromDirectory();
  console.log(`Processing ${applications.length} applications...`);

  await Promise.all(
    applications.map((application) =>
      limit(async () => {
        const id = getApplicationId(application);
        const name = getProjectName(application);
        const projectId = application.projectId;

        const url = `https://gapapi.karmahq.xyz/grants/external-id/${projectId}`;
        console.log(`Fetching grants for: ${name} (${projectId})`);

        try {
          const initialGrants = await fetch(url, {
            headers: { "Content-Type": "application/json" },
          }).then((r) => r.json() as Promise<KarmaGrants[]>);

          console.log(`Found ${initialGrants.length} initial grants for ${name}`);

          // Extract unique projectUIDs from the grants
          const projectUIDs = [...new Set(initialGrants.map(grant => grant.projectUID))];
          console.log(`Found ${projectUIDs.length} unique project UIDs for ${name}`);

          // Fetch grants for each projectUID
          const allGrants = await Promise.all(
            projectUIDs.map(async (projectUID: string) => {
              const grantsUrl = `https://gapapi.karmahq.xyz/projects/${projectUID}/grants`;
              try {
                const grants = await fetch(grantsUrl, {
                  headers: { "Content-Type": "application/json" },
                }).then((r) => r.json() as Promise<KarmaGrants[]>);
                return grants;
              } catch (error) {
                console.error(
                  `Error fetching grants for project ${projectUID}:`,
                  error
                );
                return [] as KarmaGrants[];
              }
            })
          );

          const flattenedGrants = allGrants.flat();
          console.log(`Found ${flattenedGrants.length} total grants for ${name}`);

          // Save results immediately
          saveFile(getApplicationPath(id) + "/karmagap.json", {
            id,
            projectId,
            projectUIDs,
            grants: flattenedGrants,
          });
          console.log(`Saved results for ${id}`);
        } catch (error) {
          console.error(`Error fetching grants for ${name} (${projectId}):`, error);
          // Save empty result to indicate we tried
          saveFile(getApplicationPath(id) + "/karmagap.json", {
            id,
            projectId,
            grants: [],
            projectUIDs: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
    )
  );

  console.log("All results have been saved successfully!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
