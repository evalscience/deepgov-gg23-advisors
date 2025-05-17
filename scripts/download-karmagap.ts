import pLimit from "p-limit";
import type { KarmaProject, KarmaResult, KarmaGrants } from "../utils/utils";
import {
  loadApplicationsFromDirectory,
  getApplicationId,
  getProjectName,
  saveFile,
  getApplicationPath,
  normalizeProjectName,
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
        const normalizedName = normalizeProjectName(name);

        const url = `https://gapapi.karmahq.xyz/search?q=${normalizedName}`;
        console.log(`Fetching projects for: ${name}`);

        const projects = await fetch(url, {
          headers: { "Content-Type": "application/json" },
        })
          .then((r) => r.json() as Promise<{ projects: KarmaProject[] }>)
          .then((r) => r.projects)
          .catch((error) => {
            console.error(`Error fetching projects for ${name}:`, error);
            return [];
          });

        console.log(`Found ${projects.length} projects for ${name}`);

        // Fetch grants for each project
        const grants = await Promise.all(
          projects.map(async (project: KarmaProject) => {
            const grantsUrl = `https://gapapi.karmahq.xyz/projects/${project.uid}/grants`;
            try {
              const grants = await fetch(grantsUrl, {
                headers: { "Content-Type": "application/json" },
              }).then((r) => r.json() as Promise<KarmaGrants[]>);
              return grants;
            } catch (error) {
              console.error(
                `Error fetching grants for project ${project.uid}:`,
                error
              );
              return [] as KarmaGrants[];
            }
          })
        );

        const filteredGrants = grants.flat();
        console.log(`Found ${filteredGrants.length} grants for ${name}`);

        // Save results immediately
        saveFile(getApplicationPath(id) + "/karmagap.json", {
          id,
          projects,
          grants: filteredGrants,
        });
        console.log(`Saved results for ${id}`);
      })
    )
  );

  console.log("All results have been saved successfully!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
