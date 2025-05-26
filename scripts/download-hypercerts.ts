import pLimit from "p-limit";
import {
  loadApplicationsFromDirectory,
  getApplicationId,
  getProjectName,
  saveFile,
  getApplicationPath,
  normalizeProjectName,
} from "../utils/utils";
import * as fs from "fs";
import * as path from "path";

const limit = pLimit(10);

// Load ecocert mappings
function loadEcocertMappings() {
  const mappingsPath = path.join(__dirname, "../data/external/ecocert-mappings.json");
  const mappingsData = fs.readFileSync(mappingsPath, "utf-8");
  return JSON.parse(mappingsData);
}

async function main() {
  // Load all files in /applications
  const applications = loadApplicationsFromDirectory();
  console.log(`Processing ${applications.length} applications for hypercerts...`);

  // Load ecocert mappings
  const ecocertMappings = loadEcocertMappings();

  await Promise.all(
    applications.map((application) =>
      limit(async () => {
        const id = getApplicationId(application);
        const name = getProjectName(application);

        console.log(`Fetching hypercerts for: ${name}`);
        
        // Check if this project has an ecocert mapping
        const mapping = ecocertMappings.find((m: any) => m.gitcoinProjectid === application.projectId);
        
        let query: string;
        
        if (mapping) {
          // Use specific hypercert_id query for projects with ecocert mapping
          query = `
            {
              hypercerts(where: {hypercert_id: {eq: "${mapping.ecocertId}"}}) {
                count
                data {
                  metadata {
                    name
                    description
                  }
                  attestations {
                    data {
                      attester
                      creation_block_timestamp
                      data
                      id
                    }
                  }
                  hypercert_id
                }
              }
            }
          `;
        } else {
          // Use original name-based search for other applications
          const normalizedName = normalizeProjectName(name);
          query = `
            {
              hypercerts(where: {metadata: {name: {contains: "${normalizedName}"}}}) {
                count
                data {
                  metadata {
                    name
                    description
                  }
                  attestations {
                    data {
                      attester
                      creation_block_timestamp
                      data
                      id
                    }
                  }
                  hypercert_id
                }
              }
            }
          `;
        }

        try {
          // Make the request to the hypercerts API
          const response = await fetch('https://api.hypercerts.org/v1/graphql', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const hypercertsData = await response.json() as any;
          
          // Save results immediately
          saveFile(getApplicationPath(id) + "/hypercerts.json", hypercertsData);
          console.log(`Saved hypercerts for ${id} - Found ${hypercertsData.data?.hypercerts?.count || 0} hypercerts`);
        } catch (error) {
          console.error(`Error fetching hypercerts for ${name}:`, error);
          // Save empty result in case of error
          saveFile(getApplicationPath(id) + "/hypercerts.json", { data: { hypercerts: { count: 0, data: [] } } });
        }
      })
    )
  );

  console.log("All hypercerts data has been saved successfully!");
}

// Execute the main function
main().catch((error) => {
  console.error("Error in main execution:", error);
  process.exit(1);
}); 