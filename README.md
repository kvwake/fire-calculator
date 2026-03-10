# FIRE Calculator

A comprehensive Financial Independence, Retire Early (FIRE) retirement planning calculator. Runs entirely in the browser with no backend — your data stays on your device.

## Features

- **Multi-person households** — model 1-2 adults with separate accounts and ages
- **Account types** — Traditional 401(k)/IRA, Roth, Taxable Brokerage, HSA, Cash/Bonds, 457(b), Generic
- **Tax-aware withdrawal optimization** — fills low brackets with traditional, then LTCG, then Roth
- **Federal + state taxes** — all 50 states + DC with progressive brackets
- **Roth conversion strategies** — fill 12%/22%/24% brackets during low-income years
- **Social Security** — early/delayed claiming adjustments, taxable income calculation
- **Pension support** — defined-benefit income with configurable COLA
- **ACA subsidy modeling** — 400% FPL cliff-aware withdrawal optimization
- **IRMAA Medicare surcharges** — 2-year MAGI lookback with Roth conversion look-ahead
- **Monte Carlo simulation** — per-asset-class returns with correlated equity/bond streams
- **Historical backtesting** — 154 years of S&P 500 and US government bond data (1871-2024)
- **Asset allocation glide path** — configurable safe-years buffer at start/end of retirement
- **Austerity mode** — automatic spending reduction when cash drops below floor
- **Variable spending phases** — different spending levels by age range
- **Healthcare cost modeling** — separate pre-65 and post-65 costs with healthcare inflation
- **Dividend income tracking** — taxable dividend MAGI impact on ACA/IRMAA
- **Data import/export** — JSON backup and restore

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |

## Deploying to AWS

The included CloudFormation template and GitHub Actions workflow deploy the app as a static site on S3 behind CloudFront.

### Prerequisites

- An AWS account
- A GitHub OIDC provider already configured in your AWS account ([docs](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services))
- An ACM certificate in **us-east-1** covering your domain
- A Route 53 hosted zone for your domain (optional, for custom domain)

### 1. Deploy the CloudFormation stack

```bash
# Find your existing OIDC provider ARN
aws iam list-open-id-connect-providers

# Deploy the stack
aws cloudformation create-stack \
  --stack-name fire-calculator \
  --template-body file://infra/stack.yml \
  --parameters \
    ParameterKey=BucketName,ParameterValue=your-bucket-name \
    ParameterKey=GitHubRepo,ParameterValue=your-org/fire-calculator \
    ParameterKey=GitHubOIDCProviderArn,ParameterValue=arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com \
    ParameterKey=DomainName,ParameterValue=fire.example.com \
    ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:us-east-1:ACCOUNT_ID:certificate/CERT_ID \
  --capabilities CAPABILITY_NAMED_IAM

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name fire-calculator

# Get the outputs
aws cloudformation describe-stacks --stack-name fire-calculator \
  --query 'Stacks[0].Outputs' --output table
```

### 2. Configure GitHub secrets

Set these repository secrets from the stack outputs:

| Secret | Stack Output |
|--------|-------------|
| `AWS_ROLE_ARN` | `DeployRoleArn` |
| `S3_BUCKET` | `BucketName` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `CloudFrontDistributionId` |

### 3. Configure DNS

Create a Route 53 alias record pointing your domain to the CloudFront distribution.

### 4. Deploy

Push to `main` and the GitHub Actions workflow will automatically build, test, and deploy.

### Infrastructure details

The CloudFormation stack (`infra/stack.yml`) creates:

- **S3 bucket** — private, all public access blocked, accessed only via CloudFront OAC
- **CloudFront distribution** — HTTPS-only, HTTP/2+3, gzip compression, security headers (CSP, HSTS, X-Frame-Options), PriceClass_100 (US/Canada/Europe)
- **IAM deploy role** — OIDC-federated, scoped to your GitHub repo's main branch, with minimal permissions (S3 put/delete + CloudFront invalidation)
- **Security headers policy** — Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS
- Recharts (charting)
- Vitest (testing)

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

This means you are free to use, modify, and distribute this software, provided that:
- You include the original copyright and license notice
- You disclose your source code when distributing
- If you run a modified version as a network service, you must make the source available to users
- Derivative works must use the same license
