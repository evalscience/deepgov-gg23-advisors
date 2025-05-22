# DeepGov GG23 Advisors

### Getting Started

```sh
bun install # or npm / yarn / pnpm install

cp .env.sample .env.local
```

### Scripts

The following scripts are available for managing and analyzing grant applications:

#### 1. Download Applications

```sh
bun run download-applications
```

Downloads approved applications from specified Gitcoin Grants rounds and saves them locally. The script fetches data from multiple rounds across different chains (Celo and Arbitrum).

#### 2. Download KarmaGap Data

```sh
bun run download-karmagap
```

Fetches and saves historical grant data from KarmaHQ for each application. This helps in understanding a project's grant history and track record.

#### 3. Download Hypercerts Data

```sh
bun run download-hypercerts
```

Fetches and saves hypercerts data from Hypercerts foundation and ecocertain. This helps understanding the projects impact.

#### 4. Research Projects

```sh
bun run research-projects
```

Conducts in-depth research on grant applications using AI agents. The script generates detailed research reports for each project, helping evaluators understand the project's background and context.

#### 5. Review Applications

```sh
bun run review-applications
```

Evaluates grant applications using multiple AI agents with different evaluation criteria. Each agent provides an independent review based on the project's application, research data, and historical grant information.


#### 6. Run Elo Tournament

```sh
bun run review-applications
```



### Data Structure

The scripts work with the following directory structure:

- `applications/` - Contains downloaded grant applications
- `rounds/` - Contains round-specific information
- Each application directory contains:
  - `application.json` - Original application data
  - `karmagap.json` - Historical grant data
  - `hypercerts.json` - Historical impact data
  - `research.json` - Research findings
  - `review-*.json` - Individual agent reviews
