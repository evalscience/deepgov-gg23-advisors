import {
  getApplicationId,
  getApplicationPath,
  saveFile,
  type Application,
  type Round,
} from "./utils";

const rounds = [
  {
    roundId: "35",
    chainId: "42220",
  },
  {
    roundId: "867",
    chainId: "42161",
  },
  {
    roundId: "865",
    chainId: "42161",
  },
  {
    roundId: "863",
    chainId: "42161",
  },
];

const ROUNDS_QUERY = `
  query Rounds($where: RoundsBoolExp!) {
    rounds(where: $where) {
      id
      chainId
      roundMetadata
      applications(limit: 1000, where: {status: {_eq: APPROVED}}) {
        id
        chainId
        roundId
        projectId
        metadata
        status
        project {
          metadata
        }
      }
    }
  }
`;

async function main() {
  const url = "https://beta.indexer.gitcoin.co/v1/graphql";

  const body = JSON.stringify({
    query: ROUNDS_QUERY,
    variables: {
      where: {
        _or: rounds.map((round) => ({
          id: { _eq: round.roundId },
          chainId: { _eq: round.chainId },
        })),
      },
    },
    operationName: "Rounds",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (!response.ok) {
    throw new Error(`Error fetching projects: ${response.statusText}`);
  }

  return response.json() as Promise<{
    data: {
      rounds: {
        id: string;
        chainId: string;
        roundMetadata: any;
        applications: Application[];
      }[];
    };
  }>;
}

main()
  .then((r) => {
    // Save round details
    r.data.rounds.forEach(({ id, chainId, roundMetadata }) => {
      saveFile(getRoundPath(chainId, id), { id, chainId, roundMetadata });
    });

    // Save applications
    return r.data.rounds.flatMap((round) => round.applications);
  })
  .then((applications) => {
    return applications.map((application) => {
      const id = getApplicationId(application);
      saveFile(getApplicationPath(id) + "/application.json", application);
    });
  })
  .catch(console.error);

function getRoundPath(chainId: string, roundId: string): string {
  return `rounds/${chainId}/${roundId}/details.json`;
}
