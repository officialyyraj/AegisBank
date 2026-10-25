#!/usr/bin/env node
// infrastructure/cdk/bin/aegisbank.ts — CDK app entrypoint (Doc 3 Part E).
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { AegisBankStack } from '../lib/aegisbank-stack'

const app = new cdk.App()
new AegisBankStack(app, 'AegisBankStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'ap-south-1' },
  description: 'AegisBank demo — ECS Fargate + RDS Postgres + S3 + CloudFront + SES (Doc 3 Option 2)',
})
