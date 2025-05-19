import pLimit from "p-limit";
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
  console.log(`Processing ${applications.length} applications for hypercerts...`);

  await Promise.all(
    applications.map((application) =>
      limit(async () => {
        const id = getApplicationId(application);
        const name = getProjectName(application);

        console.log(`Fetching hypercerts for: ${name}`);
        
        // Then in your main code:
        const normalizedName = normalizeProjectName(name);
        
        // Construct the GraphQL query with the project name
        const query = `
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

          const hypercertsData = await response.json();
          
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