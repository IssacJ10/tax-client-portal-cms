#!/bin/bash
# JJElevate Strapi Deployment Script
# Run this after Cloud SQL is ready (STATUS: RUNNABLE)

set -e

PROJECT_ID="secret-rope-485200-h6"
REGION="northamerica-northeast2"
INSTANCE_NAME="jjelevate-dev-db"
DB_NAME="jjelevate"
DB_USER="jjelevate_app"
DB_PASSWORD="UPDATE_WITH_YOUR_DB_PASSWORD"

echo "=== JJElevate Strapi Deployment ==="
echo ""

# Step 1: Check Cloud SQL status
echo "Step 1: Checking Cloud SQL status..."
STATUS=$(gcloud sql instances describe $INSTANCE_NAME --project=$PROJECT_ID --format="value(state)" 2>/dev/null || echo "NOT_FOUND")
if [ "$STATUS" != "RUNNABLE" ]; then
    echo "ERROR: Cloud SQL instance is not ready. Current status: $STATUS"
    echo "Please wait for the instance to be RUNNABLE before deploying."
    exit 1
fi
echo "✓ Cloud SQL instance is ready!"

# Step 2: Create database (if not exists)
echo ""
echo "Step 2: Creating database..."
gcloud sql databases create $DB_NAME --instance=$INSTANCE_NAME --project=$PROJECT_ID 2>/dev/null || echo "Database already exists"
echo "✓ Database ready!"

# Step 3: Create user (if not exists)
echo ""
echo "Step 3: Creating database user..."
gcloud sql users create $DB_USER --instance=$INSTANCE_NAME --password=$DB_PASSWORD --project=$PROJECT_ID 2>/dev/null || echo "User already exists"
echo "✓ Database user ready!"

# Step 4: Initialize App Engine (if not exists)
echo ""
echo "Step 4: Initializing App Engine..."
gcloud app describe --project=$PROJECT_ID 2>/dev/null || gcloud app create --region=$REGION --project=$PROJECT_ID
echo "✓ App Engine ready!"

# Step 5: Build Strapi
echo ""
echo "Step 5: Building Strapi..."
npm run build
echo "✓ Build complete!"

# Step 6: Deploy to App Engine
echo ""
echo "Step 6: Deploying to App Engine..."
gcloud app deploy app.yaml --env-vars-file=env.yaml --project=$PROJECT_ID --quiet
echo "✓ Deployment complete!"

# Step 7: Show deployment URL
echo ""
echo "=== Deployment Successful! ==="
echo ""
echo "Strapi Admin URL: https://cms-dev-dot-$PROJECT_ID.nn.r.appspot.com/admin"
echo ""
echo "View logs: gcloud app logs tail -s cms-dev --project=$PROJECT_ID"
