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

This file is an index. The sub-skills live in sibling directories under this folder, each at
`<name>/SKILL.md`. Pick the row that matches the task, then read only that one `SKILL.md`.

## Context rules (read these first)

- The table below is enough to choose. Do not open a sub-skill to find out what it covers.
- Open a sub-skill only when the task needs its guidance and you can't do the task well without it.
  Simple, well-known questions (a basic CLI flag, a one-line explanation) don't need one.
- Read one `SKILL.md` at a time. Read a second only if the task clearly crosses into its area.
- A sub-skill's `references/`, `scripts/` and `assets/` are off limits until that sub-skill's
  `SKILL.md` tells you to open a specific file for the step you are on. Never list or bulk-read them.
- Don't re-read a sub-skill already loaded in this session.
- Some sub-skills (`aws-database`, `aws-networking`, `aws-serverless`, `aws-messaging-and-streaming`,
  `aws-storage`) are themselves routers. Read their `SKILL.md`, then open only the one reference it
  points you to.

## Sub-skills

Paths are relative to this directory.

| Task | Read |
|------|------|
| Get AWS CLI/SDK credentials, `aws login`, expired or missing credentials | `signing-in-to-aws/SKILL.md` |
| IAM roles, policies, trust policies, STS, Organizations, policy generation | `aws-iam/SKILL.md` |
| User sign-up/sign-in, Cognito, Amplify auth, JWT authorizers, OAuth/OIDC | `aws-auth/SKILL.md` |
| Security Hub, GuardDuty, Inspector, Macie, Detective, Security Lake | `aws-security/SKILL.md` |
| CDK (TypeScript/Python): constructs, stacks, `cdk deploy/synth/diff` | `aws-cdk/SKILL.md` |
| CloudFormation templates, validation, cfn-lint/cfn-guard, failed stacks | `aws-cloudformation/SKILL.md` |
| CodePipeline, CodeBuild, CodeDeploy, CodeArtifact, buildspec/appspec | `aws-deployment/SKILL.md` |
| EC2, Auto Scaling, AMIs, IMDSv2, Systems Manager | `aws-compute/SKILL.md` |
| EKS, ECS, Fargate, ECR, Elastic Beanstalk | `aws-containers/SKILL.md` |
| Lambda, API Gateway, Step Functions, EventBridge, event-driven design | `aws-serverless/SKILL.md` |
| Choosing or operating a database (Aurora, RDS, DynamoDB, etc.) | `aws-database/SKILL.md` |
| S3, EFS, FSx, EBS, storage selection, migration, cost | `aws-storage/SKILL.md` |
| Route 53, CloudFront, Transit Gateway, Direct Connect, VPN, WAF, Shield | `aws-networking/SKILL.md` |
| SQS, SNS, EventBridge, Kinesis, MQ, Firehose, SES, end-user messaging | `aws-messaging-and-streaming/SKILL.md` |
| CloudWatch, Log Insights, alarms, Application Signals, Omni | `aws-observability/SKILL.md` |
| First-time CloudWatch Omni setup (Space, access grants, ADOT) | `../setting-up-cloudwatch-observability/SKILL.md` |
| Bedrock: model invocation, Knowledge Bases, Agents, Guardrails, AgentCore | `amazon-bedrock/SKILL.md` |
| SageMaker: fine-tuning, model deployment, endpoints, MLflow | `aws-ai-ml/SKILL.md` |
| Cost analysis, budgets, Savings Plans, right-sizing, pricing, Free Tier | `aws-billing-and-cost-management/SKILL.md` |
| Writing code with the AWS SDK for JavaScript v3 (`@aws-sdk/*`) | `aws-sdk-js-v3-usage/SKILL.md` |
| Writing code with boto3/botocore | `aws-sdk-python-usage/SKILL.md` |
| Writing Swift code with `aws-sdk-swift` | `aws-sdk-swift-usage/SKILL.md` |
| Building full-stack apps with AWS Blocks (`@aws-blocks`) | `aws-blocks/SKILL.md` |
| Migrating a vibe-coded or frontend web app to AWS | `launch-with-aws/SKILL.md` |

## No match

If no row fits, don't force one. Answer from general knowledge, or use the AWS documentation tools
if the answer depends on current service details.
