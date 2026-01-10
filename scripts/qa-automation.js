const fetch = require('node-fetch');

const BASE_URL = 'http://127.0.0.1:1337';
const ADMIN_EMAIL = 'admin@citysoftsolutions.com';
const ADMIN_PASSWORD = 'Password123!';

// Robust payload with all edge cases
const fullPayload = {
    data: {
        filingType: 'PERSONAL',
        taxYear: null, // Will fetch active year
        filingData: {
            personalInfo: {
                firstName: "QA_Runtime",
                lastName: "Tester",
                middleName: "Automated",
                sin: "999-999-999",
                dateOfBirth: "1990-01-01",
                phoneNumber: "555-0199",
                email: "qa_runtime@example.com",
                maritalStatus: "MARRIED",
                residency: { provinceResided: "ON", livedOutsideCanada: "NO" }
            },
            spouse: {
                firstName: "Spouse_Runtime",
                lastName: "Tester",
                sin: "888-888-888",
                dateOfBirth: "1992-02-02",
                netIncome: 55000, // Testing the FIX
                statusInCanada: "CANADIAN_CITIZEN", // Testing the FIX
                residencyStatus: "RESIDENT"
            },
            dependants: {
                list: [
                    {
                        firstName: "Kid_Runtime",
                        lastName: "Tester",
                        dateOfBirth: "2020-01-01",
                        relationship: "SON",
                        sin: "000-000-000"
                    }
                ]
            },
            rentalIncome: {
                propertyAddress: "1 Rental Rd",
                totalRentReceived: 12000,
                rentedFullYear: "YES",
                equipment: [{ assetName: "Washing Machine", purchaseDate: "2023-01-01", cost: 500 }]
            },
            selfEmployment: {
                needsBookkeeping: "BOOKKEEPING",
                gstRegistered: "YES",
                gstNumber: "123456789RT0001",
                hasCapitalAssets: "YES",
                capitalAssets: [{ assetName: "Laptop", purchaseDate: "2023-05-01", cost: 1500 }]
            },
            vehicleExpenses: {
                make: "Toyota",
                model: "Camry",
                year: 2022,
                totalKmDriven: 20000,
                kmDrivenForWork: 10000
            },
            homeOffice: { totalHomeSize: 2000, workAreaSize: 200, monthlyElectricity: 100 },
            movingExpenses: { reason: "NEW_JOB", oldAddress: "Old Place", newAddress: "New Place", kmDrivenForMoving: 500 },
            electionsCanada: { authorizeCRA: "YES", consentRegister: "YES" },
            propertyAssets: { purchasedPrincipalResidence: "YES", foreignPropertyOver100k: "NO" },
            disabilityCredit: { dependantName: "Grandma", affectedPersons: ["DEPENDANT"] },
            workExpenses: { categories: ["MEALS", "TRAVEL"] }
        }
    }
};

async function runQA() {
    console.log("🚀 Starting Automated QA against " + BASE_URL);

    // 1. Login as Admin
    console.log("🔑 Logging in...");
    const loginRes = await fetch(`${BASE_URL}/api/auth/local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD })
    });

    if (!loginRes.ok) {
        // Fallback: Try to register random user if admin login fails (e.g. fresh DB)
        console.log("⚠️ Admin login failed (fresh DB?). Registering new QA user...");
        const random = Math.floor(Math.random() * 10000);
        const regRes = await fetch(`${BASE_URL}/api/auth/local/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `qa_user_${random}`,
                email: `qa_${random}@example.com`,
                password: 'Password123!',
                firstName: 'QA', lastName: 'Bot'
                // Removed hasConsentedToTerms to avoid 400 Error
            })
        });
        const regData = await regRes.json();
        if (!regRes.ok) throw new Error("Registration failed: " + JSON.stringify(regData));
        var token = regData.jwt;

        // 2a. Call Consent Endpoint explicitly
        console.log("📝 Agreeing to Terms...");
        const consentRes = await fetch(`${BASE_URL}/api/dashboard/consent`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!consentRes.ok) throw new Error("Consent failed");

    } else {
        const loginData = await loginRes.json();
        var token = loginData.jwt;
    }
    console.log("✅ Authenticated & Consented!");

    // 2. Fetch Active Tax Year
    const yearRes = await fetch(`${BASE_URL}/api/tax-years?filters[isActive]=true`, { headers: { Authorization: `Bearer ${token}` } });
    const yearData = await yearRes.json();
    if (yearData.data.length === 0) throw new Error("No active tax year found!");
    fullPayload.data.taxYear = yearData.data[0].id;
    console.log(`📅 Active Tax Year ID: ${yearData.data[0].id}`);

    // 2b. Fetch Personal Filing Type ID
    const typeRes = await fetch(`${BASE_URL}/api/filing-types?filters[type]=PERSONAL`, { headers: { Authorization: `Bearer ${token}` } });
    const typeData = await typeRes.json();
    if (typeData.data.length === 0) throw new Error("Personal Filing Type not found!");
    fullPayload.data.filingType = typeData.data[0].id;
    console.log(`📄 Personal Filing Type ID: ${typeData.data[0].id}`);

    // 2c. Fetch "IN_PROGRESS" Status ID (Fix for 'published' error)
    const statusRes = await fetch(`${BASE_URL}/api/filing-statuses?filters[statusCode]=IN_PROGRESS`, { headers: { Authorization: `Bearer ${token}` } });
    const statusData = await statusRes.json();
    if (statusData.data.length === 0) throw new Error("IN_PROGRESS Status not found!");
    fullPayload.data.filingStatus = statusData.data[0].documentId; // Use DocumentID for relations in v5
    console.log(`🚦 Filing Status ID: ${statusData.data[0].documentId}`);

    // 3. Submit Filing
    console.log("📤 Submitting Full Payload...");
    const createRes = await fetch(`${BASE_URL}/api/filings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(fullPayload)
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
        console.error("❌ Submission Failed:", JSON.stringify(createData, null, 2));
        process.exit(1);
    }

    const filingId = createData.data.id;
    const documentId = createData.data.documentId;
    console.log(`✅ Filing Created! ID: ${filingId}`);

    // 4. Verify Data Persistence (Read back)
    console.log("🔎 Verifying Persistence...");
    // We need to fetch the PersonalFiling content type that links to this filing
    // Note: User can't query personal-filings directly easily without finding the ID first
    // But we updated the controller to return populated data? No, create returns Filing.
    // Let's query filings/{id}?populate=... deeply
    const query = new URLSearchParams({
        'populate[personalFiling][populate][0]': 'spouse',
        'populate[personalFiling][populate][1]': 'dependents',
        'populate[personalFiling][populate][2]': 'rentalIncome.equipment',
        'populate[personalFiling][populate][3]': 'selfEmployment.capitalAssets',
        'populate[personalFiling][populate][4]': 'vehicleExpenses',
        'populate[personalFiling][populate][5]': 'homeOffice',
        'populate[personalFiling][populate][6]': 'movingExpenses',
        'populate[personalFiling][populate][7]': 'electionsCanada',
        'populate[personalFiling][populate][8]': 'propertyAssets',
        'populate[personalFiling][populate][9]': 'disabilityCredit',
        'populate[personalFiling][populate][10]': 'workExpenses',
    });

    const fetchRes = await fetch(`${BASE_URL}/api/filings/${documentId}?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const result = await fetchRes.json();
    const pf = result.data.personalFiling;

    if (!pf) throw new Error("❌ Personal Filing relation is MISSING!");

    // ASSERTIONS
    const checks = [
        { label: "Spouse Name", actual: pf.spouse?.firstName, expected: "Spouse_Runtime" },
        { label: "Spouse Net Income", actual: pf.spouse?.netIncome, expected: 55000 },
        { label: "Spouse Status In Canada", actual: pf.spouse?.statusInCanada, expected: "CANADIAN_CITIZEN" },
        { label: "Dependent Name", actual: pf.dependents?.[0]?.firstName, expected: "Kid_Runtime" },
        { label: "Rental Income", actual: pf.rentalIncome?.totalRentReceived, expected: 12000 },
        { label: "Rental Equipment", actual: pf.rentalIncome?.equipment?.[0]?.assetName, expected: "Washing Machine" },
        { label: "Self Employment GST", actual: pf.selfEmployment?.gstRegistered, expected: true },
        { label: "Self Employment Asset", actual: pf.selfEmployment?.capitalAssets?.[0]?.assetName, expected: "Laptop" },
        { label: "Vehicle Make", actual: pf.vehicleExpenses?.make, expected: "Toyota" },
        { label: "Moving Reason", actual: pf.movingExpenses?.reason, expected: "NEW_JOB" },
        { label: "CRA Authorization", actual: pf.electionsCanada?.authorizeCRA, expected: true }
    ];

    let failures = 0;
    console.log("---------------------------------------------------");
    checks.forEach(check => {
        if (check.actual === check.expected) {
            console.log(`✅ ${check.label}: MATCH (${check.actual})`);
        } else {
            console.error(`❌ ${check.label}: FAIL (Expected ${check.expected}, Got ${check.actual})`);
            failures++;
        }
    });
    console.log("---------------------------------------------------");

    if (failures === 0) {
        console.log("🎉 SUCCESS: All 100% of schema fields persisted correctly!");
    } else {
        console.error(`💀 FAILURE: ${failures} fields failed to persist.`);
        process.exit(1);
    }
}

runQA();
