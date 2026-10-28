---
name: aws
description: >-
  Index and router for AWS work. Use for any AWS task (services, CLI/SDK, infrastructure as code,
  IAM, networking, storage, databases, compute, containers, serverless, messaging, CI/CD, security,
  observability, billing, Bedrock/SageMaker, Cognito auth, getting AWS credentials, migrating an
  app to AWS). Picks the one sub-skill that fits and loads it on demand; nothing under this
  directory is read until a task needs it.
---

# AWS

This file is an index. The sub-skills live under `references/`, each at
`references/<name>/guide.md`. Pick the row that matches the task, then read only that one `guide.md`.

## Context rules (read these first)

- The table below is enough to choose. Do not open a sub-skill to find out what it covers.
- Open a sub-skill only when the task needs its guidance and you can't do the task well without it.
  Simple, well-known questions (a basic CLI flag, a one-line explanation) don't need one.
- Read one `guide.md` at a time. Read a second only if the task clearly crosses into its area.
- A sub-skill's `references/`, `scripts/` and `assets/` are off limits until that sub-skill's
  `guide.md` tells you to open a specific file for the step you are on. Never list or bulk-read them.
- Don't re-read a sub-skill already loaded in this session.
- Some sub-skills (`aws-database`, `aws-networking`, `aws-serverless`, `aws-messaging-and-streaming`,
  `aws-storage`) are themselves routers. Read their `guide.md`, then open only the one reference it
  points you to.

## Sub-skills

Paths are relative to this directory.

| Task | Read |
|------|------|
| Get AWS CLI/SDK credentials, `aws login`, expired or missing credentials | `references/signing-in-to-aws/guide.md` |
| IAM roles, policies, trust policies, STS, Organizations, policy generation | `references/aws-iam/guide.md` |
| User sign-up/sign-in, Cognito, Amplify auth, JWT authorizers, OAuth/OIDC | `references/aws-auth/guide.md` |
| Security Hub, GuardDuty, Inspector, Macie, Detective, Security Lake | `references/aws-security/guide.md` |
| CDK (TypeScript/Python): constructs, stacks, `cdk deploy/synth/diff` | `references/aws-cdk/guide.md` |
| CloudFormation templates, validation, cfn-lint/cfn-guard, failed stacks | `references/aws-cloudformation/guide.md` |
| CodePipeline, CodeBuild, CodeDeploy, CodeArtifact, buildspec/appspec | `references/aws-deployment/guide.md` |
| EC2, Auto Scaling, AMIs, IMDSv2, Systems Manager | `references/aws-compute/guide.md` |
| EKS, ECS, Fargate, ECR, Elastic Beanstalk | `references/aws-containers/guide.md` |
| Lambda, API Gateway, Step Functions, EventBridge, event-driven design | `references/aws-serverless/guide.md` |
| Choosing or operating a database (Aurora, RDS, DynamoDB, etc.) | `references/aws-database/guide.md` |
| S3, EFS, FSx, EBS, storage selection, migration, cost | `references/aws-storage/guide.md` |
| Route 53, CloudFront, Transit Gateway, Direct Connect, VPN, WAF, Shield | `references/aws-networking/guide.md` |
| SQS, SNS, EventBridge, Kinesis, MQ, Firehose, SES, end-user messaging | `references/aws-messaging-and-streaming/guide.md` |
| CloudWatch, Log Insights, alarms, Application Signals, Omni | `references/aws-observability/guide.md` |
| First-time CloudWatch Omni setup (Space, access grants, ADOT) | `references/setting-up-cloudwatch-observability/guide.md` |
| Bedrock: model invocation, Knowledge Bases, Agents, Guardrails, AgentCore | `references/amazon-bedrock/guide.md` |
| SageMaker: fine-tuning, model deployment, endpoints, MLflow | `references/aws-ai-ml/guide.md` |
| Cost analysis, budgets, Savings Plans, right-sizing, pricing, Free Tier | `references/aws-billing-and-cost-management/guide.md` |
| Writing code with the AWS SDK for JavaScript v3 (`@aws-sdk/*`) | `references/aws-sdk-js-v3-usage/guide.md` |
| Writing code with boto3/botocore | `references/aws-sdk-python-usage/guide.md` |
| Writing Swift code with `aws-sdk-swift` | `references/aws-sdk-swift-usage/guide.md` |
| Building full-stack apps with AWS Blocks (`@aws-blocks`) | `references/aws-blocks/guide.md` |
| Migrating a vibe-coded or frontend web app to AWS | `references/launch-with-aws/guide.md` |

## No match

If no row fits, don't force one. Answer from general knowledge, or use the AWS documentation tools
if the answer depends on current service details.
