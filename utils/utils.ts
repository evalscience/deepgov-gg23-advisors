import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "fs";
import { join } from "path";

// Common types
export interface Application {
  chainId: string;
  roundId: string;
  projectId: string;
  project?: {
    metadata?: {
      title: string;
    };
  };
  metadata: {
    application: {
      title: string;
    };
  };
}

export interface Round {
  id: string;
  chainId: string;
  roundMetadata: any;
}

export interface KarmaProject {
  uid: string;
  [key: string]: any;
}

export interface KarmaGrants {
  [key: string]: any;
}

export interface KarmaResult {
  id: string;
  projects: KarmaProject[];
  grants?: KarmaGrants[];
}

// Utility functions
export function getApplicationId(application: Application): string {
  return `${application.chainId}-${application.roundId}-${application.projectId}`;
}

export function saveFile(path: string, data: any): void {
  const dirPath = path.split("/").slice(0, -1).join("/");
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  data = path.includes(".json") ? JSON.stringify(data, null, 2) : data;
  writeFileSync(path, data);
}

function* walkDirectory(dir: string): Generator<string> {
  const files = readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const path = join(dir, file.name);
    if (file.isDirectory()) {
      yield* walkDirectory(path);
    } else if (file.isFile() && file.name.endsWith(".json")) {
      yield path;
    }
  }
}

export function loadApplicationsFromDirectory(
  filename: string = "application.json"
): Application[] {
  const applications: Application[] = [];

  for (const filePath of walkDirectory("applications")) {
    if (filePath.endsWith(`/${filename}`)) {
      applications.push(
        JSON.parse(readFileSync(filePath, "utf8")) as Application
      );
    }
  }
  if (process.env.EVAL_DATASET) {
    return process.env.EVAL_DATASET.split(",").map((id) => {
      const [chainId, roundId, projectId] = id.split("/");
      return applications.find(
        (application) =>
          application.roundId == roundId &&
          application.chainId == chainId &&
          application.projectId === projectId
      ) as Application;
    });
  }
  return applications;
}
export function loadReviewsFromDirectory(): Application[] {
  const reviews: Application[] = [];
  for (const filePath of walkDirectory("applications")) {
    if (filePath.includes("review")) {
      reviews.push(JSON.parse(readFileSync(filePath, "utf8")) as Application);
    }
  }
  return reviews;
}

export function getProjectName(application: Application): string {
  return (
    application.project?.metadata?.title ||
    application.metadata?.application?.title ||
    application.metadata.application?.project?.title
  );
}

export function getApplicationPath(id: string): string {
  const [chainId, roundId, projectId] = id.split("-");
  return `applications/${chainId}/${roundId}/${projectId}`;
}

export function loadRoundDetails(chainId: string, roundId: string): any {
  const roundPath = `rounds/${chainId}/${roundId}/details.json`;
  return JSON.parse(readFileSync(roundPath, "utf8"));
}
export function loadReview(applicationId: string, agent: string): any {
  try {
    // const roundPath = `applications/${chainId}/${roundId}/review-${agent}.json`;
    return JSON.parse(
      readFileSync(
        getApplicationPath(applicationId) + `/review-${agent}.json`,
        "utf8"
      )
    );
  } catch (error) {
    return null;
  }
}
export function loadApplication(applicationId: string): any {
  try {
    return JSON.parse(
      readFileSync(getApplicationPath(applicationId) + "/application.json", "utf8")
    );
  } catch (error) {
    return null;
  }
}
export function loadKarmaGap(applicationId: string): any {
  try {
    return JSON.parse(
      readFileSync(getApplicationPath(applicationId) + "/karmagap.json", "utf8")
    );
  } catch (error) {
    return null;
  }
}
export function loadResearch(applicationId: string): any {
  try {
    return JSON.parse(
      readFileSync(getApplicationPath(applicationId) + "/research.json", "utf8")
    );
  } catch (error) {
    return null;
  }
}

export function loadHypercerts(applicationId: string): any {
  try {
    return JSON.parse(
      readFileSync(getApplicationPath(applicationId) + "/hypercerts.json", "utf8")
    );
  } catch (error) {
    return null;
  }
}

export function normalizeProjectName(name: string) {
  // Remove emojis (Unicode ranges for most common emojis)
  const noEmoji = name.replace(/[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}]/gu, '');
  
  // Convert to lowercase
  const lowercase = noEmoji.toLowerCase();
  
  // Remove common organizational suffixes
  const withoutSuffix = lowercase.replace(/\s+(dao|foundation|inc|llc|project|protocol)\b/gi, '');
  
  // Remove any remaining special characters and trim whitespace
  const clean = withoutSuffix.replace(/[^\w\s]/g, '').trim();
  
  return clean;
}

export async function fetchModelSpecs(): Promise<
  { name: string; profileUrl: string; style: string; constitution: string }[]
> {
  const baseURL = `https://api.github.com/repos/evalscience/deepgov-gg23/contents/agents`;
  const contentURL = `https://raw.githubusercontent.com/evalscience/deepgov-gg23/refs/heads/main`;

  const folders = await fetch(baseURL)
    .then((r) => r.json() as Promise<{ name: string; type: "dir" }[]>)
    .then((r) => r.filter((r) => r.type === "dir").map((r) => r.name));

  return Promise.all(
    folders.map(async (name: string) => ({
      name,
      profileUrl: `${contentURL}/agents/${name}/visuals/profile.png`,
      ethics: await fetch(`${contentURL}/system/ethics.md`).then((r) =>
        r.text()
      ),
      style: await fetch(
        `${contentURL}/agents/${name}/modelspec/style.md`
      ).then((r) => r.text()),
      constitution: await fetch(
        `${contentURL}/agents/${name}/modelspec/constitution.md`
      ).then((r) => r.text()),
      scoring: await fetch(
        `${contentURL}/agents/${name}/modelspec/scoring.md`
      ).then((r) => r.text()),
    }))
  );
}
