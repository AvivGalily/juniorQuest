import { execFileSync } from "node:child_process";

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-west-1";
const stackName = process.env.STACK_NAME || "juniorquest-prod";
const tableName = process.env.LEADERBOARD_TABLE_NAME || `${stackName}-leaderboard`;
const partitionKey = "GLOBAL";

const aws = (args) => {
  const output = execFileSync("aws", [...args, "--region", region, "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
  return output ? JSON.parse(output) : {};
};

const queryEntries = () => {
  const items = [];
  let exclusiveStartKey;

  do {
    const args = [
      "dynamodb",
      "query",
      "--table-name",
      tableName,
      "--key-condition-expression",
      "pk = :pk",
      "--expression-attribute-values",
      JSON.stringify({ ":pk": { S: partitionKey } }),
      "--projection-expression",
      "pk, sk"
    ];

    if (exclusiveStartKey) {
      args.push("--exclusive-start-key", JSON.stringify(exclusiveStartKey));
    }

    const result = aws(args);
    items.push(...(result.Items || []));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
};

const writeBatch = (requests) => {
  let pending = requests;

  for (let attempt = 1; pending.length > 0; attempt += 1) {
    const result = aws([
      "dynamodb",
      "batch-write-item",
      "--request-items",
      JSON.stringify({ [tableName]: pending })
    ]);

    pending = result.UnprocessedItems?.[tableName] || [];
    if (pending.length > 0 && attempt >= 5) {
      throw new Error(`Failed to delete ${pending.length} leaderboard entries after ${attempt} attempts.`);
    }
  }
};

const entries = queryEntries();

if (entries.length === 0) {
  console.log(`Leaderboard is already empty in ${tableName}.`);
  process.exit(0);
}

for (let index = 0; index < entries.length; index += 25) {
  const chunk = entries.slice(index, index + 25);
  writeBatch(
    chunk.map((entry) => ({
      DeleteRequest: {
        Key: {
          pk: entry.pk,
          sk: entry.sk
        }
      }
    }))
  );
}

console.log(`Deleted ${entries.length} leaderboard entries from ${tableName}.`);
