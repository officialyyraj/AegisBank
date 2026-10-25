# DOCUMENT 3 — DEPLOYMENT, OPERATIONS & HANDOFF GUIDE
## AegisBank on AWS — Minimum Practical Cost

All prices are estimates (AWS `ap-south-1` Mumbai region, as of early/mid-2026 list pricing).
**AWS pricing varies by region, usage, taxes, and time — treat every figure below as approximate,
not a quote.** USD→INR shown at ≈ ₹87/$ for illustration only, using round numbers.

---

## PART A — AWS ARCHITECTURE OPTIONS

| Option | Services | Est. monthly cost (low demo usage) | Pros | Cons | Complexity |
|---|---|---|---|---|---|
| 1. Cheapest viable | Single EC2 t4g.micro (app+Postgres on same box), S3, CloudFront, SES | ~$7–10 (~₹600–900) — largely covered by 12-month Free Tier if new account | Lowest possible cost, simplest mental model | Single point of failure, manual OS patching, DB and app compete for resources | Low |
| 2. **Recommended** | ECS Fargate (1 task, 0.25vCPU/0.5GB), RDS Postgres (db.t4g.micro, single-AZ), S3, CloudFront, SES, Secrets Manager | ~$25–35 (~₹2,200–3,000) | No server patching, managed DB backups, clean separation, still tiny | Slightly more than raw EC2 | Low-medium |
| 3. More scalable | ECS Fargate (2+ tasks) behind ALB with auto-scaling, RDS Multi-AZ, ElastiCache for rate-limiting, CloudWatch dashboards/alarms | ~$120–180 (~₹10,000–15,000) | Handles real traffic, HA | Unnecessary for a student demo | Medium |

**Selected: Option 2 (Recommended)** — best balance of low cost and low operational risk (managed
backups matter for a "banking" demo). Document also gives Option 1 steps as a cost-fallback if the
₹2,000–3,000/month range is not acceptable, and notes Option 3 only as a future scale-up path — do
not build it now.

```mermaid
flowchart LR
    U[Browser] -->|HTTPS| CF[CloudFront]
    CF --> S3F[S3 - Frontend static]
    U -->|HTTPS API calls| ALB[Application Load Balancer]
    ALB --> ECS[ECS Fargate Task<br/>AegisBank backend container]
    ECS --> RDS[(RDS PostgreSQL<br/>db.t4g.micro, single-AZ)]
    ECS --> S3K[S3 - KYC docs, private]
    ECS --> SES[SES - email]
    ECS --> SM[Secrets Manager]
    ECS --> CW[CloudWatch Logs]
```

---

## PART B — AWS SERVICES USED (and why)

| Service | Why needed | Configuration | Expected cost | Free-tier | Avoiding surprise charges |
|---|---|---|---|---|---|
| ECS Fargate | Run the containerised backend without managing servers | 1 task, 0.25 vCPU/0.5GB, `awsvpc` mode | ~$9–12/mo for 1 always-on task | No Fargate free tier | Keep to 1 task for demo; set a billing alarm |
| RDS PostgreSQL | Managed, backed-up relational DB for ledger data | db.t4g.micro, 20GB gp3, single-AZ, automated backups 7 days | ~$13–15/mo (+~$2 storage) | 12-month free tier (750 hrs db.t3.micro) if new account | Single-AZ (not Multi-AZ) for demo; delete manual snapshots when tearing down |
| Application Load Balancer | HTTPS termination + routing to Fargate | 1 ALB, 1 target group | ~$16–18/mo base + minimal LCU | No free tier for ALB itself | This is the biggest fixed cost — Option 1 (no ALB, direct EC2+Elastic IP) avoids it if budget is tight |
| S3 (KYC docs + frontend) | Object storage | 2 buckets, private (KYC) + public-via-CloudFront (frontend) | <$1/mo at low volume | 5GB free tier (12mo) | Enable lifecycle rule to expire old test uploads |
| CloudFront | CDN + HTTPS for static frontend | 1 distribution → frontend S3 bucket | <$1/mo at low traffic | 1TB/mo free tier (12mo) | Cap max price class to "only North America/Europe... " → actually set to lowest-cost class covering India (`PriceClass_All` if needed, or `PriceClass_200`) |
| SES | Transactional email | Sandbox mode (verified sender + recipients) for demo | Free for very low volume; sandbox has no cost | 62,000 emails/mo free from EC2 (legacy tier may differ) | Stay in sandbox for demo — avoids production-access review and any spend risk |
| Secrets Manager | Store DB creds, JWT secrets | 3 secrets | ~$1.20/mo ($0.40/secret) | No free tier | Use SSM Parameter Store (SecureString) instead if you want $0 — functionally equivalent for this scale |
| CloudWatch Logs | App logs, basic alarms | 1 log group, 7-day retention | <$1/mo at low volume | 5GB free tier | Set retention to 7 days (not "never expire") to avoid storage creep |
| ECR | Store the backend Docker image | 1 repository | <$0.10/mo | 500MB free (12mo) | Enable lifecycle policy: keep last 5 images |
| Route 53 (optional) | Custom domain | 1 hosted zone | ~$0.50/mo + $0.40/mo per million queries | No | Skip entirely if a CloudFront/ALB default DNS name is acceptable for a demo |

**Not used (explicitly rejected for cost/complexity):** EKS ($73/mo control plane alone), MSK/Kafka
($50+/mo minimum), Bedrock (no LLM in this design), Lightsail (viable Option-1 alternative to EC2 but
ALB-based Option 2 already chosen), Cognito (JWT approach chosen instead, see Doc 1 §4 ADR).

---

## PART C — COST MODEL

| Scenario | Compute | DB | ALB | Storage/CDN/Email/Secrets/Logs | **Total/mo** |
|---|---|---|---|---|---|
| Near-zero / idle (within 12mo Free Tier) | $0 (free tier) | $0 (free tier) | ~$16 | ~$2 | **~$18 (~₹1,560)** |
| Expected student/demo usage (Free Tier expired or account >12mo old) | ~$10 | ~$15 | ~$17 | ~$3 | **~$45 (~₹3,900)** |
| Higher-usage warning point | If task count >1, RDS moved to Multi-AZ, or traffic pushes ALB LCU / data-transfer materially up | | | | **$100+ (~₹8,700+) — reassess architecture (Option 3) before scaling further** |

**Services that can generate unexpected charges:** ALB (always-on hourly charge regardless of
traffic), RDS (hourly charge even idle — this is the #1 thing people forget to delete), NAT Gateway
(if you add one for private-subnet internet access — **avoid a NAT Gateway entirely for this
project**, ~$32/mo fixed cost with no functional need here), data transfer out to internet beyond
free tier. **Action:** set an AWS Budget alert at $20 and $50.

---

## PART D — AWS SETUP (step-by-step)

**Prerequisites:** an AWS account, AWS CLI v2 installed locally, a GitHub repository for AegisBank.

**[LOCAL MACHINE] 1. Install & configure AWS CLI**
```bash
aws --version
aws configure
# AWS Access Key ID: <your key>
# AWS Secret Access Key: <your secret>
# Default region: ap-south-1
# Default output format: json
```

**[AWS CONSOLE] 2. Create an IAM user/role for deployment (not root)**
- IAM → Users → Create user `aegisbank-deployer` → Attach policies: `AmazonECS_FullAccess`,
  `AmazonRDSFullAccess`, `AmazonS3FullAccess`, `CloudFrontFullAccess`, `SecretsManagerReadWrite`,
  `AmazonSESFullAccess`, `CloudWatchLogsFullAccess`, `IAMFullAccess` (needed for CDK bootstrap only —
  tighten after initial setup). For production hardening beyond this demo, replace with a
  least-privilege custom policy scoped to the specific resource ARNs created by CDK.
- Create an access key for CLI use; store it in your local `~/.aws/credentials`, never in the repo.

**[AWS CLI] 3. Bootstrap CDK (one-time per account/region)**
```bash
npx aws-cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1
```

**[AWS CONSOLE] 4. Verify an SES sender email (sandbox mode)**
- SES → Verified identities → Create identity → your email (e.g. `no-reply@yourdomain.com` or a
  personal address for demo) → click the verification link. Also verify each demo recipient email
  while in sandbox mode.

**[AWS CLI] 5. Create Secrets Manager entries**
```bash
aws secretsmanager create-secret --name aegisbank/jwt-access-secret --secret-string "$(openssl rand -hex 32)"
aws secretsmanager create-secret --name aegisbank/jwt-refresh-secret --secret-string "$(openssl rand -hex 32)"
# DATABASE_URL secret is created automatically by CDK from the RDS-generated credentials (Part E)
```

All remaining resources (VPC, RDS, ECS, ALB, S3, CloudFront, ECR) are created via CDK in Part E —
this avoids error-prone manual console clicking for the bulk of the infrastructure.

---

## PART E — INFRASTRUCTURE AS CODE (AWS CDK, TypeScript)

Chosen over Terraform/SAM/raw CloudFormation because it's the same language as the backend (easy for
an AI coding agent to author consistently) and integrates cleanly with ECR/ECS/RDS constructs.

`infrastructure/cdk/lib/aegisbank-stack.ts` (structure — agent should implement fully):

```typescript
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class AegisBankStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC: 2 AZs, NO NAT gateway (public subnets only for ECS+RDS to avoid ~$32/mo NAT cost;
    // acceptable for a demo — document as an ARCHITECTURE DECISION / open issue for production).
    const vpc = new ec2.Vpc(this, 'AegisVpc', { maxAzs: 2, natGateways: 0 });

    const dbCredentials = rds.Credentials.fromGeneratedSecret('aegisbank_admin');
    const db = new rds.DatabaseInstance(this, 'AegisDb', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, // demo simplicity; lock down SG to ECS only
      allocatedStorage: 20,
      multiAz: false,
      backupRetention: cdk.Duration.days(7),
      credentials: dbCredentials,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // demo only — change for real production data
    });

    const kycBucket = new s3.Bucket(this, 'KycDocsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset('../../frontend/dist')],
      destinationBucket: frontendBucket,
    });
    new cloudfront.Distribution(this, 'FrontendCdn', {
      defaultBehavior: { origin: new (require('aws-cdk-lib/aws-cloudfront-origins').S3Origin)(frontendBucket) },
    });

    const cluster = new ecs.Cluster(this, 'AegisCluster', { vpc });
    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'AegisApi', {
      cluster,
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../../backend'),
        containerPort: 3000,
        environment: {
          NODE_ENV: 'production',
          AWS_REGION: this.region,
          KYC_S3_BUCKET: kycBucket.bucketName,
        },
        secrets: {
          DATABASE_URL: ecs.Secret.fromSecretsManager(db.secret!, 'connectionString'),
          JWT_ACCESS_SECRET: ecs.Secret.fromSecretsManager(
            secretsmanager.Secret.fromSecretNameV2(this, 'JwtAccess', 'aegisbank/jwt-access-secret')),
          JWT_REFRESH_SECRET: ecs.Secret.fromSecretsManager(
            secretsmanager.Secret.fromSecretNameV2(this, 'JwtRefresh', 'aegisbank/jwt-refresh-secret')),
        },
      },
      publicLoadBalancer: true,
    });

    db.connections.allowFrom(fargateService.service, ec2.Port.tcp(5432));
    kycBucket.grantReadWrite(fargateService.taskDefinition.taskRole);

    new cdk.CfnOutput(this, 'ApiUrl', { value: fargateService.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
  }
}
```

Deploy with `cdk deploy` (see Part K). This single stack provisions everything in Part A/Option 2.

---

## PART F — DOCKER

`backend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/server.js"]
```

`infrastructure/docker-compose.yml` (local dev only):
```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: aegisbank
      POSTGRES_PASSWORD: localdevpass
      POSTGRES_DB: aegisbank
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
  backend:
    build: ../backend
    env_file: ../backend/.env
    ports: ["3000:3000"]
    depends_on: [postgres]
volumes:
  pgdata:
```

---

## PART G — CI/CD (GitHub Actions)

`.github/workflows/ci-cd.yml`:
```yaml
name: CI/CD
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: aegisbank_test }
        ports: ["5432:5432"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd backend && npm ci
      - run: cd backend && npx prisma migrate deploy
        env: { DATABASE_URL: postgresql://postgres:test@localhost:5432/aegisbank_test }
      - run: cd backend && npm test

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-south-1
      - run: cd frontend && npm ci && npm run build
      - run: cd infrastructure/cdk && npm ci && npx cdk deploy --require-approval never
```

**Required GitHub secrets:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (from the
`aegisbank-deployer` IAM user in Part D).

Pipeline: push to `main` → run tests against ephemeral Postgres → on success, build frontend and
`cdk deploy` (which builds+pushes the backend Docker image via CDK's Docker asset handling and
updates ECS).

---

## PART H — DATABASE DEPLOYMENT

- Production DB is created by CDK (Part E) with a CDK-generated master credential stored in Secrets
  Manager automatically — never hardcode a password.
- Schema migration: run once after first deploy — `[SERVER or CI]`:
  ```bash
  aws ecs execute-command --cluster AegisCluster --task <TASK_ID> --container AegisApi \
    --interactive --command "npx prisma migrate deploy"
  ```
  (or run migrations as a one-off ECS task / from CI with the RDS endpoint reachable).
- Seed data: `npx prisma db seed` the same way, once, for demo accounts.
- Backup: RDS automated backups, 7-day retention (configured in CDK). For a manual snapshot before
  risky changes: `aws rds create-db-snapshot --db-instance-identifier <id> --db-snapshot-identifier pre-change-snapshot`.
- Security: DB security group only allows inbound 5432 from the ECS service's security group
  (enforced by `db.connections.allowFrom(...)` in Part E) — never expose RDS publicly.

---

## PART I — "AI" MODEL DEPLOYMENT

Not applicable — this build uses no external AI/ML model or LLM API (Document 1 §8). No Bedrock
permissions, no model credentials, no inference cost or rate limiting are required. If ML-based
fraud scoring is added later, isolate any AI provider cost separately from AWS infrastructure cost
in future cost tracking, and add a dedicated IAM policy scoped only to that service (e.g. Bedrock
`InvokeModel` on a specific model ARN).

---

## PART J — MONITORING

- Application logs: ECS task → CloudWatch Logs (`awslogs` driver, configured automatically by
  `ApplicationLoadBalancedFargateService`), 7-day retention.
- Error logs: same log group; app should log errors as structured JSON with `level:"error"` for
  easy CloudWatch Logs Insights queries.
- Health check: ALB target group health check hits `GET /health` every 30s; ECS restarts unhealthy tasks automatically.
- Basic metrics: default ECS/RDS/ALB CloudWatch metrics (CPU, memory, connection count) — no custom
  dashboard needed for a demo, but one alarm is worth the near-zero cost:
  ```bash
  aws cloudwatch put-metric-alarm --alarm-name aegisbank-high-5xx \
    --metric-name HTTPCode_Target_5XX_Count --namespace AWS/ApplicationELB \
    --statistic Sum --period 300 --threshold 10 --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 --dimensions Name=LoadBalancer,Value=<alb-full-name>
  ```
- Avoid: X-Ray distributed tracing, third-party APM (Datadog/New Relic) — not justified at this scale.

---

## PART K — COMPLETE DEPLOYMENT TUTORIAL

Assume you have an AWS account and a GitHub repository for AegisBank.

1. **[LOCAL MACHINE] Install prerequisites:** Node.js 20, Docker Desktop, AWS CLI v2, `git`.
2. **[LOCAL MACHINE] Install AWS CLI** — see Part D step 1.
3. **[LOCAL MACHINE] Configure AWS credentials** — `aws configure` with the `aegisbank-deployer` keys.
4. **[LOCAL MACHINE] Clone repository:**
   ```bash
   git clone https://github.com/<you>/aegisbank.git && cd aegisbank
   ```
5. **[LOCAL MACHINE] Configure environment variables:** copy `.env.example` → `.env` in `backend/`
   for local dev; production values are injected by CDK/Secrets Manager, not a `.env` file.
6. **[AWS CLI] Create AWS resources:**
   ```bash
   cd infrastructure/cdk
   npm ci
   npx cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1   # one-time
   npx cdk deploy --require-approval never
   ```
7. **Deploy database:** created automatically by the `cdk deploy` above (RDS instance).
8. **Deploy backend:** also created by `cdk deploy` (CDK builds the Docker image from
   `backend/Dockerfile`, pushes to ECR, deploys to ECS Fargate).
9. **[LOCAL MACHINE] Deploy frontend:**
   ```bash
   cd ../../frontend && npm ci && npm run build
   cd ../infrastructure/cdk && npx cdk deploy   # re-run to sync the BucketDeployment with fresh dist/
   ```
10. **Configure AI service:** N/A — no AI service in this build (Part I).
11. **[SERVER/CI] Run migrations:**
    ```bash
    aws ecs execute-command --cluster AegisCluster --task <TASK_ID> --container AegisApi \
      --interactive --command "npx prisma migrate deploy"
    ```
12. **Create admin account:** run the seed script the same way, or `POST /auth/register` then
    manually update `role='admin'` via a one-off `execute-command` SQL statement.
13. **Verify deployment:** open the `ApiUrl` CDK output in a browser → `GET /health` → `{"status":"ok"}`.
14. **Run smoke tests:** `curl -X POST https://<api-url>/api/v1/auth/register -d '{...}'` and confirm 201.
15. **Configure logs:** already wired via Part J — check CloudWatch Logs console under `/ecs/AegisApi`.
16. **Configure domain/HTTPS (optional):** if using Route 53, create an `A`/`ALIAS` record pointing
    at the ALB/CloudFront, and an ACM certificate in the ALB's region for HTTPS on the custom domain.
17. **Verify production system:** run the 3 E2E journeys from Document 2 §9 manually against the live URL.
18. **How to update:** push to `main` → GitHub Actions runs tests → `cdk deploy` automatically (Part G).
19. **How to roll back:** `git revert <commit>` and push, which redeploys the previous version; or
    `aws ecs update-service --cluster AegisCluster --service <svc> --task-definition <previous-revision>`.
20. **[AWS CLI] How to shut everything down to avoid charges:**
    ```bash
    cd infrastructure/cdk
    npx cdk destroy
    ```
    Then manually check the console for: any leftover RDS manual snapshots, any leftover ECR images,
    any CloudWatch log groups (delete if you don't need the history) — `cdk destroy` removes the
    stack-managed resources but not manually-created snapshots.

---

## PART L — TROUBLESHOOTING

| Symptom | Likely cause | Fix |
|---|---|---|
| `cdk deploy` fails with credentials error | AWS CLI not configured / expired keys | Re-run `aws configure`, confirm `aws sts get-caller-identity` works |
| ECS task stuck "PROVISIONING" then stops | IAM permissions missing for task execution role | Ensure CDK's default execution role has `AmazonECSTaskExecutionRolePolicy` (added automatically by `ApplicationLoadBalancedFargateService`) |
| Frontend calls API and gets CORS error | Backend CORS origin doesn't match CloudFront/S3 URL | Set `CORS_ORIGIN` env var to the exact frontend origin, redeploy |
| Backend can't connect to RDS | Security group not allowing ECS→RDS on 5432, or wrong `DATABASE_URL` | Confirm `db.connections.allowFrom(fargateService.service, ec2.Port.tcp(5432))` is present; check the Secrets Manager-injected `DATABASE_URL` |
| ALB health check failing, task keeps restarting | `/health` not returning 200 fast enough, or wrong container port | Confirm `containerPort: 3000` matches `EXPOSE 3000`/`app.listen(3000)`; check CloudWatch logs for startup errors |
| DNS not resolving on custom domain | Route 53 record not created or not propagated | `dig <domain>`, wait for propagation, confirm `ALIAS` record points at correct ALB/CloudFront |
| ACM cert not attaching to ALB | Cert must be in the **same region** as the ALB for ALB (CloudFront certs must be in `us-east-1`) | Request cert in `ap-south-1` for ALB, or `us-east-1` if attaching to CloudFront instead |
| Docker build fails in CDK asset bundling | Missing `Dockerfile` or wrong path in `ecs.ContainerImage.fromAsset(...)` | Confirm path is relative to `infrastructure/cdk`, not repo root |
| Lambda/API Gateway errors | N/A in this architecture (no Lambda used) | — |
| "AI API permission denied" | N/A — no AI service used in this build | — |
| CI build fails: `prisma migrate deploy` can't reach DB | Test Postgres service not ready yet | Add a wait/retry step or `pg_isready` loop before migrate in the workflow |
| Migration fails: "relation already exists" | Migrations run out of order or against a DB that already has manually-created tables | Never hand-edit the DB schema; only via `prisma migrate`; if diverged, `prisma migrate resolve` |
| Frontend shows blank page after deploy | `BucketDeployment` didn't run after latest `npm run build`, or CloudFront cache stale | Re-run `cdk deploy` after building frontend; invalidate CloudFront cache: `aws cloudfront create-invalidation --distribution-id <id> --paths "/*"` |

---

## PART M — HANDOFF CHECKLIST

### Development
- [ ] Repository builds (`npm run build` in backend and frontend)
- [ ] Tests pass (`npm test`) in CI
- [ ] `.env.example` complete and accurate (Document 2 §8)
- [ ] Database migrated (`prisma migrate deploy` succeeded)
- [ ] Fraud/notification event flow works end-to-end (Document 2 §9 E2E journeys)
- [ ] Frontend works against deployed API

### Security
- [ ] No secrets committed to git (`git log -p | grep -i secret` clean, `.gitignore` covers `.env`)
- [ ] HTTPS enabled on ALB/CloudFront
- [ ] IAM roles scoped to specific resources (tightened post-bootstrap per Part D note)
- [ ] Input validation present on every endpoint (Document 1 §7 / Document 2 §5)
- [ ] Authentication + role checks tested for every protected/admin route

### Deployment
- [ ] `cdk deploy` succeeds cleanly from a fresh checkout
- [ ] `/health` endpoint reachable over HTTPS
- [ ] Database reachable only from ECS (not publicly exposed)
- [ ] Fraud/notification workers running inside the deployed task (poller active)
- [ ] CloudWatch Logs show application output

### Cost
- [ ] AWS Budget alert configured at $20 and $50 (Part C)
- [ ] No NAT Gateway present (Part E note — confirm `natGateways: 0`)
- [ ] Unused/duplicate ECR images cleaned up (lifecycle policy)
- [ ] `cdk destroy` tested at least once in a scratch account/stage to confirm full teardown works
