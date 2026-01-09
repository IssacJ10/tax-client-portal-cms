# Database Setup Instructions

## Important: Seed Master Data Before Running Tests

The new database schema requires master data (FilingTypes and FilingStatuses) to exist before filings can be created. Tests will fail if this data is not present.

## Setup Steps

### 1. Start Strapi
```bash
npm run develop
```

Wait for Strapi to fully start (you should see the admin URL).

### 2. In a New Terminal, Run Seed Script
```bash
# Option 1: Seed all master data at once (recommended)
node scripts/seed-all.js

# Option 2: Seed individually
node scripts/seed-filing-types.js
node scripts/seed-filing-statuses.js
```

### 3. Verify Seed Data
You can verify the data was created by:
- Opening Strapi Admin: http://localhost:1337/admin
- Navigate to Content Manager
- Check "Filing Types" (should have 3 entries: PERSONAL, CORPORATE, TRUST)
- Check "Filing Statuses" (should have 7 entries: NOT_STARTED, IN_PROGRESS, etc.)

### 4. Run Tests
```bash
npm test
```

## Troubleshooting

### If seed script fails with "STRAPI_ADMIN_JWT not set"
The scripts use a default JWT token. If it doesn't work:
1. Generate a new API token in Strapi Admin: Settings → API Tokens → Create new token
2. Set it as an environment variable:
   ```bash
   export STRAPI_ADMIN_JWT="your-token-here"
   node scripts/seed-all.js
   ```

### If tests fail with "not found" errors
This means the master data wasn't seeded. Make sure:
1. Strapi is running
2. Seed script completed successfully
3. You can see the data in Strapi Admin

## What Changed

The filing schema now uses **relations** instead of **enumerations**:

### Before (Old Schema)
```javascript
{
  filingType: "PERSONAL",  // String enumeration
  filingStatus: "In Progress"  // String enumeration
}
```

### After (New Schema)
```javascript
{
  filingType: 123,  // ID from filing-types table
  status: 456       // ID from filing-statuses table
}
```

Tests have been updated to:
1. Query master tables for IDs during setup
2. Use those IDs when creating test filings
3. Verify relations work correctly
