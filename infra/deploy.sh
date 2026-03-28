#!/usr/bin/env bash
set -euo pipefail

# ─── gitvisual AWS deployment ────────────────────────────────────────
# This script:
#   1. Deploys the CloudFormation stack (S3 + CloudFront + deploy user)
#   2. Prints the credentials you need to add as GitHub repo secrets
#   3. Optionally does the first deploy
#
# Prerequisites:
#   - AWS CLI installed and configured (aws configure)
#   - Permissions to create CloudFormation stacks, S3, CloudFront, IAM
#
# Usage:
#   ./infra/deploy.sh                          # CloudFront URL only
#   ./infra/deploy.sh gitvisual.dev ARN        # With custom domain
# ─────────────────────────────────────────────────────────────────────

STACK_NAME="gitvisual-site"
REGION="us-east-1"
DOMAIN="${1:-}"
CERT_ARN="${2:-}"

echo "==> Deploying CloudFormation stack: ${STACK_NAME}"

PARAMS="ParameterKey=DomainName,ParameterValue=${DOMAIN} ParameterKey=CertificateArn,ParameterValue=${CERT_ARN}"

aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "$(dirname "$0")/template.yml" \
  --parameter-overrides $PARAMS \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset

echo ""
echo "==> Stack deployed. Fetching outputs..."
echo ""

# Get outputs
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs' \
  --output json)

CF_URL=$(echo "$OUTPUTS" | python3 -c "import sys,json; print(next(o['OutputValue'] for o in json.load(sys.stdin) if o['OutputKey']=='CloudFrontURL'))")
BUCKET=$(echo "$OUTPUTS" | python3 -c "import sys,json; print(next(o['OutputValue'] for o in json.load(sys.stdin) if o['OutputKey']=='BucketName'))")
DIST_ID=$(echo "$OUTPUTS" | python3 -c "import sys,json; print(next(o['OutputValue'] for o in json.load(sys.stdin) if o['OutputKey']=='DistributionId'))")
ACCESS_KEY=$(echo "$OUTPUTS" | python3 -c "import sys,json; print(next(o['OutputValue'] for o in json.load(sys.stdin) if o['OutputKey']=='DeployAccessKeyId'))")
SECRET_KEY=$(echo "$OUTPUTS" | python3 -c "import sys,json; print(next(o['OutputValue'] for o in json.load(sys.stdin) if o['OutputKey']=='DeploySecretAccessKey'))")

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Deployment complete!                                       ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "  CloudFront URL:  ${CF_URL}"
echo "  S3 Bucket:       ${BUCKET}"
echo "  Distribution ID: ${DIST_ID}"
echo ""
echo "─── Add these as GitHub repo secrets ─────────────────────────"
echo ""
echo "  AWS_ACCESS_KEY_ID:                ${ACCESS_KEY}"
echo "  AWS_SECRET_ACCESS_KEY:            ${SECRET_KEY}"
echo "  AWS_S3_BUCKET:                    ${BUCKET}"
echo "  AWS_CLOUDFRONT_DISTRIBUTION_ID:   ${DIST_ID}"
echo ""
echo "  gh secret set AWS_ACCESS_KEY_ID --body '${ACCESS_KEY}'"
echo "  gh secret set AWS_SECRET_ACCESS_KEY --body '${SECRET_KEY}'"
echo "  gh secret set AWS_S3_BUCKET --body '${BUCKET}'"
echo "  gh secret set AWS_CLOUDFRONT_DISTRIBUTION_ID --body '${DIST_ID}'"
echo ""

read -p "Do a first deploy now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "==> Building..."
  npm run build -- --base /

  echo "==> Uploading to S3..."
  aws s3 sync dist/ "s3://${BUCKET}" \
    --delete \
    --exclude "assets/*" \
    --cache-control "no-cache, no-store, must-revalidate" \
    --region "$REGION"

  aws s3 sync dist/assets/ "s3://${BUCKET}/assets/" \
    --cache-control "public, max-age=31536000, immutable" \
    --region "$REGION"

  echo "==> Invalidating CloudFront cache..."
  aws cloudfront create-invalidation \
    --distribution-id "$DIST_ID" \
    --paths "/*" \
    --region "$REGION" > /dev/null

  echo ""
  echo "  Site is live at: ${CF_URL}"
  echo "  (CloudFront may take 1-2 minutes to propagate)"
fi
