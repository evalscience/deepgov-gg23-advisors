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
  writeFileSync(path, JSON.stringify(data, null, 2));
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
  return applications;
}

export function getProjectName(application: Application): string {
  return (
    application.project?.metadata?.title ||
    application.metadata.application.title
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

export async function fetchModelSpecs(): Promise<
  { name: string; profileUrl: string; style: string; constitution: string }[]
> {
  const baseURL = `https://api.github.com/repos/evalscience/deepgov-gg23/contents/agents`;
  const contentURL = `https://raw.githubusercontent.com/evalscience/deepgov-gg23/refs/heads/main/agents`;

  const folders = await fetch(baseURL)
    .then((r) => r.json() as Promise<{ name: string; type: "dir" }[]>)
    .then((r) => r.filter((r) => r.type === "dir").map((r) => r.name));

  return Promise.all(
    folders.map(async (name: string) => ({
      name,
      profileUrl: `${contentURL}/${name}/visuals/profile.png`,
      style: await fetch(`${contentURL}/${name}/modelspec/style.md`).then((r) =>
        r.text()
      ),
      constitution: await fetch(
        `${contentURL}/${name}/modelspec/constitution.md`
      ).then((r) => r.text()),
    }))
  );
}
