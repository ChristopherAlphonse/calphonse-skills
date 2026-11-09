# AWS work: use Floci in Docker

Read this when a spike touches any AWS service. Read `evidence.md` too.

Floci is a local AWS emulator that runs in Docker and serves AWS APIs at `http://localhost:4566` (source: the Floci README, https://github.com/floci-io/floci). Use it for every AWS operation in a spike. Create, change and delete resources in Floci without asking.

Default to Terraform for infrastructure (unless the repo already uses another IaC tool) and to the AWS CLI or SDK for API calls.

## Hard rule: never touch real AWS

Spikes never call real AWS, even read-only. This holds even if the machine has AWS credentials or profiles configured.

- Use only the dummy credentials and the local endpoint below.
- If the question can only be answered on real AWS (real IAM enforcement, quotas, throttling, real latency, billing, networking), do not run it on AWS. Tell the user, and mark that part INCONCLUSIVE or "not tested on real AWS".

## Set up (do this at the start of every AWS spike)

1. Check whether Floci is up:

   ```
   curl -s -m 5 http://localhost:4566/_floci/health
   ```

   Output is JSON with `version` and a per-service state. Record the `version` for the README's Environment section.

2. If it is not up:
   - A stopped `floci` container exists: `docker start floci`.
   - No container exists (command from the README):

     ```
     docker run -d --name floci -p 4566:4566 -v /var/run/docker.sock:/var/run/docker.sock -u root floci/floci:latest
     ```

   - The socket mount is needed for services that run real containers (Lambda, RDS, ECS, EC2, ElastiCache, OpenSearch and others, per the README).
   - If port 4566 is taken by something that is not Floci, stop and ask the user.

3. Point the shell at Floci. Run this in every command that calls AWS, because shell state does not carry over between tool calls:

   ```
   unset AWS_PROFILE AWS_SESSION_TOKEN
   export AWS_ENDPOINT_URL=http://localhost:4566 AWS_DEFAULT_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test
   ```

4. Guard check before the first AWS call of a spike:

   ```
   aws sts get-caller-identity
   ```

   Expected: account `000000000000`. If the account is anything else, or the call errors, stop. Do not continue until you know the calls are going to Floci.

5. For code in the spike (SDK, Terraform, CDK), hardcode the local endpoint and the dummy credentials in the code. Do not rely on ambient configuration. Then a spike cannot reach real AWS by accident. The CLI honors `AWS_ENDPOINT_URL` (checked with CLI v2). For an SDK or IaC tool, confirm from the output that it reached Floci, for example by listing the resource you just created through the CLI.

## Always test it

If Floci can run the experiment, run it. Do not hand the user an untested answer about an AWS service, an IaC config or an SDK call when you could have executed it against Floci.

- Not testing is allowed only when you tried and Floci cannot do it (the service or feature returns an unsupported error), or the question is about something Floci cannot model (see the last section). Paste the failing output as evidence, and report INCONCLUSIVE for that part.
- "I assumed the config would work" is not a reason. Run `terraform plan` and `terraform apply`, call the API, then check the result with a separate read.

## Terraform

Terraform works against Floci through the normal `hashicorp/aws` provider (source: https://floci.io/floci/getting-started/terraform/). Checked with Terraform 1.17.1 and AWS provider 6.71.0: `init`, `validate`, `apply` and `destroy` succeeded for an S3 bucket, an SQS queue, a DynamoDB table and an SSM parameter, and a separate CLI read confirmed they existed. One run only.

Provider block to start from:

```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region     = "us-east-1"
  access_key = "test"
  secret_key = "test"

  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true
  s3_use_path_style           = true

  endpoints {
    s3       = "http://localhost:4566"
    sqs      = "http://localhost:4566"
    dynamodb = "http://localhost:4566"
    ssm      = "http://localhost:4566"
    # one line per AWS service the config uses
  }
}
```

- The Floci docs say an endpoint must be set for every AWS service the config uses. Add a line for each service. Without it, calls for that service would go to the default AWS endpoint, so check the provider block against the resources before every `apply`.
- Run it in the spike's own directory: `terraform init`, `terraform validate`, `terraform plan`, `terraform apply -auto-approve`. Verify with a separate read (CLI call), not only with Terraform's own "Apply complete".
- Test more than the happy path: run `plan` again and expect no changes, change a value and apply, and try a bad config to see the error.
- Always finish with `terraform destroy -auto-approve`, and confirm with the CLI that the resources are gone.
- Use the local state backend by default. The S3 backend with DynamoDB or S3-native locking also works (see the S3 backend section). Use it only if the spike asks about state.
- `aws_sqs_queue` takes about 25s to create and 42s to destroy. This is the AWS provider's own fixed wait, not Floci being slow. Measured on Floci 2.3.0 with provider 6.71.0: Floci answered each poll in about 4 ms, the polls repeated every 5s (create, 6 matches required) and every 3s (delete, 15 required), and the timings were the same in 3 plain runs, a FIFO queue, a queue with explicit attributes, and 5 queues in parallel (5 queues took the same 25s/42s because the waits overlap). The constants are in the provider source (`internal/service/sqs/queue.go`, v6.71.0). Shortening `timeouts` makes apply fail instead of going faster. No setting that avoids the wait was found. Plan for it, and put several queues in one config so the waits run in parallel.
- Terraform results are Terraform results on Floci. A clean `apply` does not mean real AWS would accept the same config (IAM, quotas, naming rules).
- Provider deprecation warnings are normal. The Floci docs' backend block still works, but Terraform 1.17.1 warns that `endpoint`, `dynamodb_endpoint` and `dynamodb_table` are deprecated.

## Terraform S3 backend (tested)

Checked on Floci 2.3.0, Terraform 1.17.1, provider 6.71.0, one run each:

- **State in S3:** works. The state object appeared in the bucket and no local `terraform.tfstate` held the resource. Deleting `.terraform` and re-running `init` + `plan` gave "No changes".
- **DynamoDB locking:** works. A second `plan -lock-timeout=5s` during an apply failed with `ConditionalCheckFailedException` and the same lock ID as the table item. Both the documented block and the modern `endpoints = {}` block locked.
- **S3-native locking (`use_lockfile = true`):** works with no DynamoDB table. A `.tflock` object appeared during the apply, the second plan failed with `PreconditionFailed` (412), and the object was gone afterward.
- Modern form (no deprecated arguments except `dynamodb_table`): `endpoints = { s3 = "http://localhost:4566" }` (add `dynamodb` if you use a lock table), `use_path_style = true`, `skip_credentials_validation`, `skip_region_validation`, `skip_requesting_account_id`, `skip_metadata_api_check`, dummy keys.
- Create the state bucket (and lock table) with the CLI before `terraform init`. Delete state object, bucket and table at the end.
- Not tested: `force-unlock` after a killed apply, KMS encryption, versioning, `terraform_remote_state`, migrating local state to S3.

## Other IaC tools: only if the user asks

Terraform is the only IaC tool a spike uses by default. If the repo already uses another tool, use that one. Otherwise do not use CDK or OpenTofu unless the user asks for them, because a result from another tool does not transfer to the real code.

Terraform was the easiest to run cleanly in testing: already installed, no bootstrap step, clean `destroy`, no special flags. What was found for the others (Floci 2.3.0, one run each):

- **OpenTofu** v1.13.2 ran the same config as Terraform, including update and destroy. It was not installed, so it needed a standalone binary in the scratch dir (checksum verified, no brew). It pulls the provider from registry.opentofu.org and has the same SQS waits.
- **CDK** (aws-cdk 2.1147.0, `aws-cdk-local` 3.1.0) deploys and destroys an app stack, but:
  - it needs `bootstrap` first (12 resources), and the bootstrap stack ended `DELETE_FAILED` because Floci could not delete the ECR repo, leaving an ECR repo, a stack and an asset bucket behind;
  - updating an existing stack fails unless you pass `--method=direct`, because Floci answers `ChangeSetNotFoundException` to CDK's `DeleteChangeSet`;
  - `cdklocal` needs `AWS_ENDPOINT_URL_S3` set;
  - the Floci docs site has no CDK page.
- Floci's API accepted invalid input (a bad bucket name, a queue timeout of 99999, an unknown template property), so "it deployed on Floci" does not show a template is valid on real AWS. This applies to Terraform too.

## Cleanup and permission rules

The user's settings may deny some cleanup commands (for example `aws s3 rm`). If a command is denied, do not work around it with an equivalent command. Finish the rest of the cleanup, then tell the user exactly what remains and the command that would remove it.
