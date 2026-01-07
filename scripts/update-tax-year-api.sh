#!/bin/bash
# Update Tax Year 2024 with V2 JSON via Strapi API
#
# Usage: ./scripts/update-tax-year-api.sh

echo "🚀 Updating Tax Year 2024 with V2 JSON format..."
echo ""

# Load questions_v2.json
QUESTIONS_V2=$(cat src/config/questions_v2.json)

# Get API Token (you need to replace this with actual token)
API_TOKEN="your-strapi-api-token-here"
STRAPI_URL="http://localhost:1337"

echo "📦 Loaded questions_v2.json ($(echo $QUESTIONS_V2 | jq '.questions | length') questions)"
echo ""

# Step 1: Find Tax Year 2024
echo "🔍 Finding Tax Year 2024..."
RESPONSE=$(curl -s -X GET "$STRAPI_URL/api/tax-years?filters[year][\$eq]=2024" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json")

DOCUMENT_ID=$(echo $RESPONSE | jq -r '.data[0].documentId')

if [ "$DOCUMENT_ID" = "null" ] || [ -z "$DOCUMENT_ID" ]; then
  echo "❌ Tax Year 2024 not found"
  echo "💡 Please create it in Strapi admin first"
  exit 1
fi

echo "✅ Found Tax Year (documentId: $DOCUMENT_ID)"
echo ""

# Step 2: Update filingQuestions
echo "🔄 Updating filingQuestions with V2 format..."

UPDATE_PAYLOAD=$(jq -n \
  --argjson questions "$QUESTIONS_V2" \
  '{
    data: {
      filingQuestions: $questions
    }
  }')

curl -s -X PUT "$STRAPI_URL/api/tax-years/$DOCUMENT_ID" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$UPDATE_PAYLOAD" > /dev/null

echo "✅ Tax Year updated successfully!"
echo ""
echo "📊 New configuration:"
echo "   - Format: V2 (native)"
echo "   - Header: $(echo $QUESTIONS_V2 | jq -r '.header.title')"
echo "   - Questions: $(echo $QUESTIONS_V2 | jq '.questions | length')"
echo "   - Steps: $(echo $QUESTIONS_V2 | jq '.steps | length')"
echo ""
echo "🎉 Done!"
