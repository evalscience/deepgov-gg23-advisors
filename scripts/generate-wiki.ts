import {
  getApplicationId,
  getApplicationPath,
  getProjectName,
  loadApplicationsFromDirectory,
  loadReview,
  loadRoundDetails,
  saveFile,
  loadKarmaGap,
  loadResearch,
  loadHypercerts,
} from "../utils/utils";

import fs from "fs";
import path from "path";
import { evaluationAgent } from "../agents/agents/evaluator";
import { wikiAgent } from "../agents/agents/wiki";

function parseKarmaGap({ grants }: any) {
  if (!grants) return [];
  return grants.map((grant: any) => ({
    details: grant.details.data,
    milestones: grant.milestones.map((milestone: any) => ({
      ...milestone.data,
      endsAt: new Date(milestone.data.endsAt * 1000).toLocaleDateString(),
    })),
  }));
}

function parseHypercerts(hypercerts: any) {
  if (!hypercerts?.data?.hypercerts?.data) {
    return [];
  }
  return hypercerts.data.hypercerts.data.flatMap((hypercert: any) => {
    const { hypercert_id, metadata } = hypercert;
    if (
      !hypercert.attestations?.data ||
      hypercert.attestations.data.length === 0
    ) {
      return [];
    }
    return hypercert.attestations.data.map((attestation: any) => ({
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

function loadAllReviews(applicationId: string): any[] {
  const dir = getApplicationPath(applicationId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("review-") && f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function main() {
  try {
    const applications = loadApplicationsFromDirectory("application.json");
    const applicationIndex = applications.findIndex(
      (application) => getProjectName(application) === "GainForest"
    );
    console.log(applications[applicationIndex]);

    for (const application of [applications[applicationIndex]]) {
      const applicationId = getApplicationId(application);
      const round = loadRoundDetails(application.chainId, application.roundId);
      const research = loadResearch(applicationId);
      const karmaGap = loadKarmaGap(applicationId);
      const karmaGrants = parseKarmaGap(karmaGap ?? { grants: [] });
      const hypercerts = loadHypercerts(applicationId);
      const hypercertsData = parseHypercerts(
        hypercerts ?? { data: { hypercerts: { data: [] } } }
      );
      const reviews = loadAllReviews(applicationId);

      const prompt = `
Using the provided project data (research, grant application, previous grants, impact certificates, reviews), generate a concise, wiki‐style article in Markdown. Include these sections:

1. **Title and Tagline**  
   - Project name  
   - Brief tagline or mission statement

2. **Summary**  
   - One‐sentence overview of the project’s main goal

3. **Project Overview**  
   - Background/context (key statistics or needs)  
   - How the project addresses those needs

4. **Core Components**  
   - 4–6 bullet points listing major activities or workstreams

5. **Community Engagement**  
   - Description of stakeholder involvement and capacity‐building efforts  
   - 3–5 bullet points on trainings, workshops, or governance structures

6. **Impact and Metrics**  
   - Number of beneficiaries or communities reached  
   - Main outcomes or results to date  
   - Monitoring tools or methods (if available)  
   - Project timeline (start and end dates)

7. **Funding and Sustainability**  
   - Total budget, amount secured, and any funding gap  
   - List of partners or donors  
   - Brief note on sustainability plan or scaling strategy

8. **References**  
   - List any citations from research reports, grant documents, or impact assessments

9. **Metadata Info Box** (table format)  
   - Project ID  
   - Category / Subcategory  
   - Location  
   - Status  
   - Dates (start, expected completion)  
   - Budget details (total, secured, gap)  
   - Beneficiaries and impact metrics  
   - Sustainability rating (e.g., high/medium/low)  
   - Technologies or key tools  
   - Partner organizations  
   - Contact info and website (if available)  
   - Any unique identifiers (e.g., GAP ID, OSO ID, etc.)  
   - Last updated date

Fill in each section with the relevant information from the inputs. If a specific data point is missing, write “TBD.” Maintain clean Markdown formatting with headings, bullet lists, and a table for the info box.
      
      
      
      : ${JSON.stringify(application, null, 2)}\n- Round: ${JSON.stringify(
        round,
        null,
        2
      )}\n- Research: ${JSON.stringify(
        research,
        null,
        2
      )}\n- Application: ${JSON.stringify(
        application,
        null,
        2
      )}\n- Previous Grants (KarmaGap): ${JSON.stringify(
        karmaGrants,
        null,
        2
      )}\n- Impact Certs / Hypercerts: ${JSON.stringify(
        hypercertsData,
        null,
        2
      )}\n- Reviews: ${JSON.stringify(
        reviews,
        null,
        2
      )}\n\nReturn ONLY the markdown article, no prose or commentary.`;

      const result = await wikiAgent.generate(prompt);
      saveFile(getApplicationPath(applicationId) + "/wiki.md", result.text);
      console.log(`✅ Wiki generated for ${getProjectName(application)}`);
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

main();
