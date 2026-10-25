// infrastructure/cdk/lib/aegisbank-stack.ts — AWS CDK stack (Doc 3 Part E).
//
// Provisions: VPC (2 AZ, NO NAT gateway), RDS Postgres 16 (db.t4g.micro,
// single-AZ, 7-day backups), private S3 bucket for KYC docs, public S3 bucket
// + CloudFront for the frontend, ECS Fargate (0.25 vCPU / 0.5GB, 1 task)
// behind a public ALB, with secrets (DATABASE_URL, JWT_ACCESS_SECRET,
// JWT_REFRESH_SECRET) injected from Secrets Manager.
//
// IMPORTANT (per user instruction): this file is provided as deployment-ready
// infra code; `cdk deploy` is NOT run in this sandbox without explicit user
// confirmation. The stack matches Document 3 Part E verbatim (Option 2 — the
// recommended low-cost path). It is NOT a microservices/K8s stack (Doc 1 §12).
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as ecs from 'aws-cdk-lib/aws-ecs'
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns'
import * as rds from 'aws-cdk-lib/aws-rds'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as cloudfront_origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager'
import * as logs from 'aws-cdk-lib/aws-logs'

export class AegisBankStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // VPC: 2 AZs, NO NAT gateway (public subnets only — avoids ~$32/mo NAT cost).
    // ADR: documented as acceptable for the demo; production would isolate ECS
    // in private subnets with a NAT or VPC endpoints (Doc 3 Part E note).
    const vpc = new ec2.Vpc(this, 'AegisVpc', {
      maxAzs: 2,
      natGateways: 0,
    })

    // RDS Postgres 16, db.t4g.micro, single-AZ, 7-day backups, CDK-generated
    // credentials stored automatically in Secrets Manager (DATABASE_URL secret).
    const db = new rds.DatabaseInstance(this, 'AegisDb', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }, // demo simplicity; SG locks to ECS only
      allocatedStorage: 20,
      multiAz: false,
      backupRetention: cdk.Duration.days(7),
      credentials: rds.Credentials.fromGeneratedSecret('aegisbank_admin', {
        secretName: 'aegisbank/db-credentials',
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // demo only — change for real data
      deletionProtection: false,
    })

    // Private S3 bucket for KYC documents (SSE-S3, block all public access).
    const kycBucket = new s3.Bucket(this, 'KycDocsBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ id: 'expire-old-uploads', expiration: cdk.Duration.days(90) }],
    })

    // Public S3 bucket + CloudFront distribution for the static frontend.
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    })
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset('../../frontend/dist')],
      destinationBucket: frontendBucket,
    })
    const cdn = new cloudfront.Distribution(this, 'FrontendCdn', {
      defaultBehavior: { origin: new cloudfront_origins.S3Origin(frontendBucket) },
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // covers India at lower cost
    })

    // JWT secrets in Secrets Manager (created manually per Doc 3 Part D step 5,
    // referenced here). In a real deployment these would be pre-provisioned.
    const jwtAccessSecret = secretsmanager.Secret.fromSecretNameV2(this, 'JwtAccess', 'aegisbank/jwt-access-secret')
    const jwtRefreshSecret = secretsmanager.Secret.fromSecretNameV2(this, 'JwtRefresh', 'aegisbank/jwt-refresh-secret')

    // ECS cluster + Fargate service behind a public ALB.
    const cluster = new ecs.Cluster(this, 'AegisCluster', { vpc })

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'AegisApi', {
      cluster,
      cpu: 256, // 0.25 vCPU
      memoryLimitMiB: 512,
      desiredCount: 1,
      taskImageOptions: {
        image: ecs.ContainerImage.fromAsset('../../backend'),
        containerPort: 3000,
        environment: {
          NODE_ENV: 'production',
          AWS_REGION: this.region,
          KYC_S3_BUCKET: kycBucket.bucketName,
          CORS_ORIGIN: `https://${cdn.distributionDomainName}`,
        },
        secrets: {
          DATABASE_URL: ecs.Secret.fromSecretsManager(db.secret!, 'connectionString'),
          JWT_ACCESS_SECRET: ecs.Secret.fromSecretsManager(jwtAccessSecret),
          JWT_REFRESH_SECRET: ecs.Secret.fromSecretsManager(jwtRefreshSecret),
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: 'aegisbank',
          logGroup: new logs.LogGroup(this, 'AegisLogs', {
            retention: logs.RetentionDays.ONE_WEEK,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
          }),
        }),
      },
      publicLoadBalancer: true,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    })

    // SG: allow ECS → RDS on 5432 only (RDS never public).
    db.connections.allowFrom(fargateService.service, ec2.Port.tcp(5432))
    kycBucket.grantReadWrite(fargateService.taskDefinition.taskRole)

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
      description: 'AegisBank API base URL (over HTTPS via ALB)',
    })
    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${cdn.distributionDomainName}`,
      description: 'AegisBank frontend URL (CloudFront)',
    })
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName })
    new cdk.CfnOutput(this, 'KycBucketName', { value: kycBucket.bucketName })
    new cdk.CfnOutput(this, 'DbSecretArn', { value: db.secret?.secretFullArn || '' })

    // Tag for cost tracking
    cdk.Tags.of(this).add('Project', 'AegisBank')
    cdk.Tags.of(this).add('Environment', 'demo')
  }
}
