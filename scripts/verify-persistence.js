const { createStrapi } = require('@strapi/strapi');

async function verify() {
    console.log("🚀 Starting DB Verification...");
    const strapi = await createStrapi({ distDir: './dist' }).load();
    await strapi.server.mount();

    // Fetch the latest Personal Filing with ALL associations populated
    const personalFilings = await strapi.documents('api::personal-filing.personal-filing').findMany({
        sort: 'createdAt:desc',
        limit: 1,
        populate: [
            'spouse',
            'dependents',
            'rentalIncome', 'rentalIncome.equipment',
            'selfEmployment', 'selfEmployment.capitalAssets',
            'vehicleExpenses',
            'homeOffice',
            'movingExpenses',
            'electionsCanada',
            'propertyAssets',
            'disabilityCredit',
            'workExpenses',
            'filing'
        ]
    });

    if (personalFilings.length === 0) {
        console.error("❌ No Personal Filings found in DB!");
        process.exit(1);
    }

    const pf = personalFilings[0];
    console.log(`🔎 Checking Personal Filing ID: ${pf.documentId} (Linked to Filing ${pf.filing?.documentId})`);

    // Expected values from our QA payload
    const expectations = [
        { label: "Spouse Name", actual: pf.spouse?.firstName, expected: "Spouse_Runtime" },
        { label: "Spouse Net Income", actual: pf.spouse?.netIncome, expected: 55000 },
        { label: "Spouse Status", actual: pf.spouse?.statusInCanada, expected: "CANADIAN_CITIZEN" },
        { label: "Dependent Name", actual: pf.dependents?.[0]?.firstName, expected: "Kid_Runtime" },
        { label: "Rental Income", actual: pf.rentalIncome?.totalRentReceived, expected: 12000 },
        { label: "Rental Asset", actual: pf.rentalIncome?.equipment?.[0]?.assetName, expected: "Washing Machine" },
        { label: "Self Emp GST", actual: pf.selfEmployment?.gstRegistered, expected: true }, // Boolean check
        { label: "Self Emp Asset", actual: pf.selfEmployment?.capitalAssets?.[0]?.assetName, expected: "Laptop" },
        { label: "Vehicle Make", actual: pf.vehicleExpenses?.make, expected: "Toyota" },
        { label: "Home Office Size", actual: pf.homeOffice?.totalHomeSize, expected: 2000 },
        { label: "Moving Params", actual: pf.movingExpenses?.kmDrivenForMoving, expected: 500 },
        { label: "CRA Auth", actual: pf.electionsCanada?.authorizeCRA, expected: true },
        { label: "Work Categories", actual: pf.workExpenses?.categories?.[0], expected: "MEALS" }
    ];

    let failures = 0;
    console.log("---------------------------------------------------");
    expectations.forEach(check => {
        if (check.actual == check.expected) { // Loose equality for numbers/strings
            console.log(`✅ ${check.label}: MATCH`);
        } else {
            console.error(`❌ ${check.label}: FAIL (Expected ${check.expected}, Got ${check.actual})`);
            failures++;
        }
    });
    console.log("---------------------------------------------------");

    if (failures === 0) {
        console.log("🎉 VERIFICATION SUCCESS: All fields are correctly stored in the Database!");
    } else {
        console.error("💀 VERIFICATION FAILED");
        process.exit(1);
    }

    // strapi.server.httpServer.close();
    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
