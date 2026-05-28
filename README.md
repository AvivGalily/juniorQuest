# Junior Quest: The Job Hunt

Single-player web game built with Phaser 3 + TypeScript + Vite.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Production deployment

Production uses a minimal AWS setup managed by CloudFormation:

- CloudFormation stack: `juniorquest-prod`
- Private S3 bucket for the Vite `dist` files
- S3 Block Public Access fully enabled
- CloudFront distribution with Origin Access Control
- S3 bucket policy that allows `s3:GetObject` only from that specific CloudFront distribution
- DynamoDB-backed leaderboard
- Lambda Function URL used by the browser to read and submit leaderboard scores
- No Route53, no ACM certificate, and no custom domain

Requirements:

- AWS CLI configured for the target account
- AWS region `eu-west-1` unless `AWS_REGION` or `AWS_DEFAULT_REGION` is set
- Node dependencies installed with `npm install`

Deploy or update production:

```bash
npm run deploy:prod
```

The deploy script runs `npm run build`, creates or updates the CloudFormation stack, writes the production `dist/env.js` runtime config with the leaderboard API URL, syncs `dist` to S3, invalidates CloudFront, and prints the production URL.

Leaderboard notes:

- In production, scores are read from and written to DynamoDB through a small Lambda Function URL.
- The leaderboard returns and displays only the top 100 scores.
- In local development, `public/env.js` leaves the leaderboard API blank, so the game falls back to LocalStorage.
- The public leaderboard endpoint is intentionally minimal and unauthenticated for this simple game setup. It validates name and score, but it is not an anti-cheat system.

Clear the production leaderboard:

```bash
npm run leaderboard:clear:prod
```

Invalidate CloudFront without rebuilding:

```bash
npm run invalidate:prod
```

Useful checks:

```bash
aws cloudformation describe-stacks --stack-name juniorquest-prod --region eu-west-1
aws s3api get-public-access-block --bucket <bucket-name> --region eu-west-1
```

Delete production later if needed:

```bash
aws s3 rm s3://<bucket-name> --recursive --region eu-west-1
aws cloudformation delete-stack --stack-name juniorquest-prod --region eu-west-1
aws cloudformation wait stack-delete-complete --stack-name juniorquest-prod --region eu-west-1
```

Deleting the stack permanently removes the CloudFront distribution, OAC, bucket policy, Lambda leaderboard API, Lambda log group, and S3 bucket. The bucket must be empty before CloudFormation can delete it.

Notes:
- Uses runtime-generated placeholder assets (no external art files needed).
- Production leaderboard is stored in DynamoDB; local development falls back to LocalStorage under key `juniorquest_leaderboard_v1`.
"# juniorQuest" 
