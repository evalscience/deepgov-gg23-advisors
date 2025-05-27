import { z } from "zod";

export const ReviewSchema = z.object({
  summary: z
    .string()
    // .min(1, "Summary cannot be empty.")
    .describe(
      "A brief overview highlighting key alignment and disagreements with the selected scoring principles and constitution. Explicitly mention relevant passages of your constitution."
    ),
  review: z
    .string()
    // .max(200000, "Review must not exceed 200,000 characters.")
    .describe(
      "Comprehensive analysis using Markdown formatting and optional LaTeX for quantitative assessments with motivation and citations from the research."
    ),
  strengths: z
    .array(
      z.object({
        title: z.string(),
        description: z
          .string()
          .describe("A description of the application strengths"),
      })
    ),
    // .min(1)
    // .max(5),
  weaknesses: z
    .array(
      z.object({
        title: z.string(),
        description: z
          .string()
          .describe("A description of the application weaknesses"),
      })
    ),
    // .min(1)
    // .max(5),
  changes: z
    .array(
      z.object({
        title: z.string(),
        description: z
          .string()
          .describe(
            "A description of the requested changes to the application"
          ),
      })
    )
    // .min(1)
    // .max(5)
    .describe("Requested changes"),
  rating: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "From 0 to 100, estimate the probability that this application is a good investment given your values and ethics."
    ),
  confidence: z
    .number()
    .int()
    .min(1)
    .max(5)
    .describe(
      "Reviewer's confidence level, where 1 indicates minimal certainty and 5 indicates full conviction."
    ),
  reasoning: z
    .string()
    .describe(
      "Describe the principles in the constitution that influenced the decision."
    ),
  flag: z
    .boolean()
    .describe(
      "True or false if this application is flagged for ethical concerns"
    )
  // score: z
  //   .number()
  //   .min(1)
  //   .max(10)
  //   .describe(
  //     "Rating on a 1-10 scale reflecting overall performance against the selected rubric."
  //   ),
});

export const ResearchSchema = z.object({
  project_overview: z.object({
    name: z.string().describe("The project name"),
    objectives: z.array(z.string()).describe("Main objectives and goals of the project"),
    scope: z.string().describe("The scope and scale of the project"),
    problem_statement: z.string().describe("The problem or need the project addresses")
  }),
  technical_analysis: z.object({
    methodology: z.string().describe("Technical approach and methods used"),
    innovation: z.string().describe("Innovative aspects and unique features"),
    feasibility: z.string().describe("Assessment of technical feasibility"),
    technology_stack: z.array(z.string()).describe("Technologies and tools used")
  }),
  team_and_governance: z.object({
    key_personnel: z.array(z.object({
      name: z.string(),
      role: z.string(),
      background: z.string()
    })).describe("Key team members and their backgrounds"),
    governance_structure: z.string().describe("How the project is governed and managed"),
    partnerships: z.array(z.string()).describe("Key partnerships and collaborations")
  }),
  financial_analysis: z.object({
    budget_breakdown: z.string().describe("How funds are allocated"),
    funding_sources: z.array(z.string()).describe("Sources of funding"),
    financial_sustainability: z.string().describe("Long-term financial sustainability plan")
  }),
  impact_assessment: z.object({
    expected_outcomes: z.array(z.string()).describe("Anticipated results and impacts"),
    beneficiaries: z.string().describe("Who will benefit from the project"),
    success_metrics: z.array(z.string()).describe("How success will be measured"),
    social_impact: z.string().describe("Broader social and community impact")
  }),
  web_research_findings: z.object({
    online_presence: z.string().describe("Project's online presence and reputation"),
    community_feedback: z.string().describe("Community reception and feedback"),
    recent_developments: z.string().describe("Recent news, updates, and developments"),
    credibility_assessment: z.string().describe("Assessment of project credibility and legitimacy")
  }),
  fact_checking: z.object({
    verified_claims: z.array(z.string()).describe("Claims that have been verified"),
    questionable_claims: z.array(z.string()).describe("Claims that need further verification"),
    misinformation_flags: z.array(z.string()).describe("Potential misinformation or red flags"),
    confidence_level: z.number().min(1).max(5).describe("Overall confidence in the information accuracy")
  }),
  data_analysis: z.object({
    quantitative_findings: z.string().describe("Analysis of numerical data and statistics"),
    trends_and_patterns: z.string().describe("Identified trends and patterns in data"),
    comparative_analysis: z.string().describe("Comparison with similar projects or benchmarks"),
    statistical_significance: z.string().describe("Statistical significance of findings")
  }),
  risk_assessment: z.object({
    technical_risks: z.array(z.string()).describe("Technical risks and challenges"),
    financial_risks: z.array(z.string()).describe("Financial risks and concerns"),
    operational_risks: z.array(z.string()).describe("Operational and management risks"),
    mitigation_strategies: z.array(z.string()).describe("Proposed risk mitigation strategies")
  })
});

export type Review = z.infer<typeof ReviewSchema>;
export type Research = z.infer<typeof ResearchSchema>;
