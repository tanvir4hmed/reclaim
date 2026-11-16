# Deploying Re:Claim

Every push to `main` runs `.github/workflows/ci-deploy.yml`:

1. **test:** typecheck, lint, unit and property tests, and build for `web` and `api`.
2. **deploy:** only if tests pass. GitHub signs in to AWS with OIDC (short-lived credentials, no stored keys). It then asks AWS Systems Manager to run `deploy/remote-deploy.sh` on the instance. The script installs Docker, Compose and git if needed, adds swap on small instances, checks out the pushed commit, runs `docker compose up --build -d` with the site on port 80, and waits for `/api/health`.

No SSH port is needed.

## One-time AWS setup

Instance: `i-0984268d1f9dbed77`.

1. **Let SSM reach the instance.** In IAM, create a role for EC2 with the managed policy `AmazonSSMManagedInstanceCore`. Attach it to the instance (EC2 → instance → Actions → Security → Modify IAM role). Within a few minutes the instance should show as *Online* in Systems Manager → Fleet Manager. Amazon Linux 2023 and Ubuntu AMIs already include the SSM agent.
2. **Security group:** allow inbound TCP 80 from `0.0.0.0/0`, plus 443 later if you add HTTPS. SSH (22) can stay closed.
3. **GitHub OIDC provider** (once per AWS account):
   ```sh
   aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com --client-id-list sts.amazonaws.com
   ```
4. **Deploy role for GitHub:**
   - In `deploy/iam/github-oidc-trust-policy.json` and `deploy/iam/github-deploy-permissions.json`, replace `<AWS_ACCOUNT_ID>` and `<AWS_REGION>`.
   - The trust policy already contains this repository's immutable ids (owner `17692694`, repo `1460076969`), so only `main` and the `production` environment of this repo can assume the role.
   ```sh
   aws iam create-role --role-name reclaim-github-deploy --assume-role-policy-document file://deploy/iam/github-oidc-trust-policy.json
   aws iam put-role-policy --role-name reclaim-github-deploy --policy-name reclaim-ssm-deploy --policy-document file://deploy/iam/github-deploy-permissions.json
   ```
5. **(Optional) Elastic IP**, so the address survives a stop and start.

## GitHub settings

Go to Settings → Secrets and variables → Actions → **Variables** tab. None of these are secret: with OIDC there are no keys to store.

| Variable | Value | Where to find it |
| --- | --- | --- |
| `AWS_REGION` | for example `us-east-1` | EC2 console, top right; the instance's region |
| `EC2_INSTANCE_ID` | `i-0984268d1f9dbed77` | EC2 → Instances |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<account>:role/reclaim-github-deploy` | IAM → Roles → reclaim-github-deploy → ARN |
| `SITE_URL` (optional) | `http://<public IP or domain>` | EC2 → instance → Public IPv4 address (or the Elastic IP) |

Until `EC2_INSTANCE_ID` and `AWS_DEPLOY_ROLE_ARN` are set, pushes only run the tests and skip the deploy.

## Manual deploy or rollback

Actions → *CI and deploy* → *Run workflow* deploys the current `main`. To roll back, revert the commit and push.
