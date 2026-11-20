# infra/network
 
Creates the VPC, subnets, route tables, and an optional NAT gateway for TriageAgent.

## Terraform state bucket

Our Terraform state lives in the S3 bucket `triageagent-tfstate-team22` (us-east-1). Every folder uses this same bucket, just with its own `key` in `backend.tf` (for example `network/terraform.tfstate`, `workers/terraform.tfstate`).

I created it once from AWS CloudShell with these commands. You don't need to run them again:

```
BUCKET=triageagent-tfstate-team22
aws s3api create-bucket --bucket $BUCKET --region us-east-1
aws s3api put-bucket-versioning --bucket $BUCKET --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

Versioning is on so we can roll back a bad state file, and public access is blocked.

## First-time setup
 
```
cd infra/network
terraform init
terraform apply
```
 
Apply this before `infra/workers`, since the workers launch inside this VPC.
 
## NAT gateway on/off
 
The NAT gateway is off by default to save credits. Turn it on only while testing.
 
```
terraform apply -var="enable_nat=true"    # start testing
terraform apply -var="enable_nat=false"   # done for the day
```
 
While NAT is off, the EC2 workers can't reach SQS, ECR, or Bedrock. S3 and DynamoDB still work through the gateway endpoints.

**PLEASE READ:** `nat.tf` expects a public subnet named `aws_subnet.public` and a private route table named `aws_route_table.private`. Those aren't written yet. I'll use those names when I add them, so if you write any of the network code before I do, please stick with them (or tell me so I can update `nat.tf`).
 
## Outputs
  
Not added yet. I'm planning to expose these so other folders can read them through `terraform_remote_state`:
 
- `vpc_id`
- `private_subnet_ids`
If you're working on `infra/workers`, you can code against these names now. I'll let you know before changing them.
 
## Tearing down
 
Destroy `infra/workers` first, then this folder:
 
```
terraform destroy
```

## How we deploy

Everything deploys into one AWS account (Julia for now), so I'm the only one who runs `terraform apply`. My proposed method for deployment:

1. Write your Terraform in your own folder (`infra/workers`, `infra/api`, and so on).
2. You can run `terraform fmt` and `terraform validate` locally to catch errors.
3. Open a PR and tag me.
4. I'll review it, run `terraform plan` and `apply` from our account, and let you know when it's live.

If you need something from the network folder (a new output, a different subnet), ask in the PR or message me. Open to other deployment ideas.