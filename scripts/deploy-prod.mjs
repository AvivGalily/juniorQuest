import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const stackName = process.env.PROD_STACK_NAME || "juniorquest-prod";
const projectSlug = process.env.PROD_PROJECT_SLUG || "juniorquest";
const region =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  getAwsConfigRegion() ||
  "eu-west-1";

const rootDir = process.cwd();
const templatePath = path.join(rootDir, "infra", "prod", "cloudformation.yml");
const distDir = path.join(rootDir, "dist");
const invalidateOnly = process.argv.includes("--invalidate-only");
const skipBuild = process.argv.includes("--skip-build");

function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  console.log(`\n> ${printable}`);

  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });

  if (result.error || result.status !== 0) {
    if (options.capture) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
    }
    if (result.error) {
      throw result.error;
    }
    throw new Error(`Command failed: ${printable}`);
  }

  return result.stdout?.trim() || "";
}

function getAwsConfigRegion() {
  const result = spawnSync("aws", ["configure", "get", "region"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });

  if (result.status !== 0) return "";
  return result.stdout.trim();
}

function aws(args, options = {}) {
  return run("aws", [...args, "--region", region], options);
}

function describeOutputs() {
  const outputJson = aws(
    [
      "cloudformation",
      "describe-stacks",
      "--stack-name",
      stackName,
      "--query",
      "Stacks[0].Outputs",
      "--output",
      "json"
    ],
    { capture: true }
  );

  const outputs = JSON.parse(outputJson);
  return Object.fromEntries(outputs.map((item) => [item.OutputKey, item.OutputValue]));
}

function invalidate(distributionId) {
  const invalidationJson = aws(
    [
      "cloudfront",
      "create-invalidation",
      "--distribution-id",
      distributionId,
      "--paths",
      "/*",
      "--output",
      "json"
    ],
    { capture: true }
  );
  const invalidation = JSON.parse(invalidationJson);
  const invalidationId = invalidation.Invalidation.Id;

  aws([
    "cloudfront",
    "wait",
    "invalidation-completed",
    "--distribution-id",
    distributionId,
    "--id",
    invalidationId
  ]);
}

if (!existsSync(templatePath)) {
  throw new Error(`Missing CloudFormation template: ${templatePath}`);
}

if (invalidateOnly) {
  const outputs = describeOutputs();
  invalidate(outputs.DistributionId);
  printSummary(outputs);
  process.exit(0);
}

if (!skipBuild) {
  run("npm", ["run", "build"]);
}

if (!existsSync(distDir)) {
  throw new Error(`Missing build output directory: ${distDir}`);
}

aws(["cloudformation", "validate-template", "--template-body", `file://${templatePath}`]);

aws([
  "cloudformation",
  "deploy",
  "--stack-name",
  stackName,
  "--template-file",
  templatePath,
  "--parameter-overrides",
  `ProjectSlug=${projectSlug}`,
  "--capabilities",
  "CAPABILITY_IAM",
  "--tags",
  `Project=${projectSlug}`,
  "Environment=prod",
  "ManagedBy=cloudformation",
  "--no-fail-on-empty-changeset"
]);

const outputs = describeOutputs();
writeRuntimeConfig(outputs);

aws([
  "s3",
  "sync",
  distDir,
  `s3://${outputs.BucketName}`,
  "--delete",
  "--exclude",
  "index.html",
  "--exclude",
  "env.js",
  "--exclude",
  "leaderboard/*",
  "--cache-control",
  "public,max-age=31536000,immutable"
]);

aws([
  "s3",
  "cp",
  path.join(distDir, "index.html"),
  `s3://${outputs.BucketName}/index.html`,
  "--cache-control",
  "no-cache"
]);

aws([
  "s3",
  "cp",
  path.join(distDir, "env.js"),
  `s3://${outputs.BucketName}/env.js`,
  "--cache-control",
  "no-cache"
]);

invalidate(outputs.DistributionId);
printSummary(outputs);

function writeRuntimeConfig(outputs) {
  const configPath = path.join(distDir, "env.js");
  const config = {
    leaderboardApiUrl: outputs.LeaderboardApiUrl || ""
  };
  writeFileSync(configPath, `window.JUNIORQUEST_CONFIG = ${JSON.stringify(config, null, 2)};\n`, "utf8");
}

function printSummary(outputs) {
  console.log("\nProduction deployment complete");
  console.log(`CloudFormation stack name: ${outputs.StackName || stackName}`);
  console.log(`S3 bucket name: ${outputs.BucketName}`);
  console.log(`CloudFront distribution ID: ${outputs.DistributionId}`);
  console.log(`CloudFront production URL: ${outputs.CloudFrontURL}`);
  if (outputs.LeaderboardApiUrl) {
    console.log(`Leaderboard API URL: ${outputs.LeaderboardApiUrl}`);
  }
  console.log("Next production update command: npm run deploy:prod");
}
