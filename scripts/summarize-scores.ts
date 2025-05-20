import * as fs from 'fs';
import * as path from 'path';

interface Review {
  rating?: number;
  confidence?: number;
}

interface Project {
  id: number;
  name: string;
  reviewer1?: number;
  reviewer1_confidence?: number;
  reviewer2?: number;
  reviewer2_confidence?: number;
  reviewer3?: number;
  reviewer3_confidence?: number;
  reviewLink?: string;
  projectLink?: string;
  weighted_score?: number;
  percentage?: number;
}

interface CategorizedProjects {
  [category: string]: Project[];
}

const APPLICATIONS_DIR = path.join(__dirname, '../applications');
const OUTPUT_DIR = path.join(__dirname, '../data/generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'scores.json');

// Reviewer weights for calculating weighted average score
const REVIEWER_WEIGHTS = {
  REVIEWER1: 0.387, // Luna (38.7%)
  REVIEWER2: 0.194, // Ultra-Grant (19.4%)
  REVIEWER3: 0.419  // Panda (41.9%)
};

// Category mapping based on chain/round path
const CATEGORY_MAPPING: Record<string, string> = {
  '42220/35': 'Hypercerts for Nature Stewards (Gitcoin Grants 23)',
  '42220/31': 'Regen Coordination (Gitcoin Grants 23)',
  '42161/863': 'OSS Developer Tooling & Libraries (Gitcoin Grants 23)',
  '42161/867': 'OSS dApps & Apps (Gitcoin Grants 23)',
  '42161/865': 'OSS Web3 Infrastructure (Gitcoin Grants 23)'
};

// Make sure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function getReviewScores(reviewFilePath: string): Review {
  try {
    const reviewContent = fs.readFileSync(reviewFilePath, 'utf8');
    const review = JSON.parse(reviewContent);
    return {
      rating: review.rating,
      confidence: review.confidence
    };
  } catch (error) {
    console.error(`Error processing review file ${reviewFilePath}:`, error);
    return {};
  }
}

function calculateWeightedScore(project: Project): number {
  let weightedScore = 0;
  let totalWeight = 0;
  
  if (project.reviewer1 !== undefined) {
    weightedScore += project.reviewer1 * REVIEWER_WEIGHTS.REVIEWER1;
    totalWeight += REVIEWER_WEIGHTS.REVIEWER1;
  }
  
  if (project.reviewer2 !== undefined) {
    weightedScore += project.reviewer2 * REVIEWER_WEIGHTS.REVIEWER2;
    totalWeight += REVIEWER_WEIGHTS.REVIEWER2;
  }
  
  if (project.reviewer3 !== undefined) {
    weightedScore += project.reviewer3 * REVIEWER_WEIGHTS.REVIEWER3;
    totalWeight += REVIEWER_WEIGHTS.REVIEWER3;
  }
  
  // If no valid weights were found, return 0
  if (totalWeight === 0) return 0;
  
  // Normalize by the total weight used
  return Number((weightedScore / totalWeight).toFixed(2));
}

// Calculate raw percentage based on a modular input function
function calculateRawPercentage(id: number): number {
  return calculateSquareRoot(id);
}

// Calculate raw percentage based on square root formula
function calculateSquareRoot(id: number): number {
  return 10 * Math.sqrt(1 / (id + 1));
}

// Calculate raw percentage based on exponential decay formula
function calculateExponentialDecay(id: number): number {
  return 4 * Math.exp(-0.7 * id) + 2;
}

function processApplication(applicationPath: string, idCounter: number, chain: string, round: string): Project | null {
  try {
    // Read application.json
    const applicationContent = fs.readFileSync(path.join(applicationPath, 'application.json'), 'utf8');
    const application = JSON.parse(applicationContent);
    
    // Extract chainId and roundId for reviewLink
    const chainId = application.chainId || '';
    const roundId = application.roundId || '';
    const projectId = application.projectId || '';
    
    // Extract website for projectLink
    const website = application.metadata?.application?.project?.website || '';
    
    // Extract project name
    const name = application.metadata?.application?.project?.title || '';
    
    // Get reviewer scores
    const reviewer1 = getReviewScores(path.join(applicationPath, 'review-open-source-capitalist.json'));
    const reviewer2 = getReviewScores(path.join(applicationPath, 'review-gitcoin-communist.json'));
    const reviewer3 = getReviewScores(path.join(applicationPath, 'review-regenerator.json'));
    
    const project: Project = {
      id: idCounter,
      name,
      reviewer1: reviewer1.rating,
      reviewer1_confidence: reviewer1.confidence,
      reviewer2: reviewer2.rating,
      reviewer2_confidence: reviewer2.confidence,
      reviewer3: reviewer3.rating,
      reviewer3_confidence: reviewer3.confidence,
      reviewLink: `${chainId}/${roundId}/${projectId}`,
      projectLink: website
    };
    
    // Calculate and add weighted score
    project.weighted_score = calculateWeightedScore(project);
    
    return project;
  } catch (error) {
    console.error(`Error processing application at ${applicationPath}:`, error);
    return null;
  }
}

function generateScoresJson() {
  const categorizedProjects: CategorizedProjects = {};
  let idCounter = 1;

  // Initialize all categories with empty arrays
  Object.values(CATEGORY_MAPPING).forEach(category => {
    categorizedProjects[category] = [];
  });

  // Get chains (e.g., 42220, 42161)
  const chains = fs.readdirSync(APPLICATIONS_DIR);
  
  for (const chain of chains) {
    const chainPath = path.join(APPLICATIONS_DIR, chain);
    
    if (!fs.statSync(chainPath).isDirectory()) continue;
    
    // Get rounds (e.g., 35, 31)
    const rounds = fs.readdirSync(chainPath);
    
    for (const round of rounds) {
      const roundPath = path.join(chainPath, round);
      const categoryKey = `${chain}/${round}`;
      const category = CATEGORY_MAPPING[categoryKey];
      
      if (!fs.statSync(roundPath).isDirectory()) continue;
      if (!category) {
        console.warn(`No category defined for path ${categoryKey}, skipping`);
        continue;
      }
      
      // Get application directories
      const applications = fs.readdirSync(roundPath);
      
      for (const application of applications) {
        const applicationPath = path.join(roundPath, application);
        
        if (!fs.statSync(applicationPath).isDirectory()) continue;
        
        // Process each application
        const project = processApplication(applicationPath, idCounter++, chain, round);
        if (project) {
          // At this point, category is guaranteed to be a valid key since we checked above
          (categorizedProjects as any)[category].push(project);
        }
      }
    }
  }

  // Sort each category by weighted score in descending order
  Object.keys(categorizedProjects).forEach(category => {
    if (categorizedProjects[category]) {
      categorizedProjects[category].sort((a, b) => {
        return (b.weighted_score || 0) - (a.weighted_score || 0);
      });
      
      // Reassign IDs based on the new order
      categorizedProjects[category].forEach((project, index) => {
        project.id = index + 1;
      });
      
      // Calculate raw percentages based on exponential decay formula
      const projects = categorizedProjects[category];
      let sumPercentages = 0;
      
      // First pass: calculate raw percentages
      projects.forEach(project => {
        const rawPercentage = calculateRawPercentage(project.id);
        // Store temporarily
        project.percentage = rawPercentage;
        sumPercentages += rawPercentage;
      });
      
      // Second pass: normalize percentages to sum to 100%
      projects.forEach(project => {
        if (project.percentage !== undefined && sumPercentages > 0) {
          project.percentage = Number(((project.percentage / sumPercentages) * 100).toFixed(2));
        } else {
          project.percentage = 0;
        }
      });
    }
  });

  // Write to output file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(categorizedProjects, null, 2), 'utf8');
  
  // Count total projects
  const totalProjects = Object.values(categorizedProjects).reduce(
    (sum, projects) => sum + projects.length, 0
  );
  
  console.log(`Generated scores.json with ${totalProjects} projects across ${Object.keys(categorizedProjects).length} categories, sorted by weighted score with allocation percentages`);
}

// Run the script
generateScoresJson(); 