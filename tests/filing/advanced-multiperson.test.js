const request = require('supertest');
const { createStrapi } = require('@strapi/strapi');
const fs = require('fs');
const path = require('path');

let strapi;

describe('Advanced Multi-Person Persistence Verification', () => {
    let strapiInstance;
    let jwt;
    let userId;
    let taxYearId;
    let filingTypeId;
    let filingStatusId;
    const testEmail = `multi-${Date.now()}@test.com`;

    beforeAll(async () => {
        strapi = await createStrapi({ distDir: './dist' }).load();
        await strapi.server.mount();

        // 1. Get Role
        const authenticatedRole = await strapi.documents('plugin::users-permissions.role').findMany({ filters: { type: 'authenticated' } });
        const roleId = authenticatedRole[0].documentId;

        // 2. Create User
        const user = await strapi.documents('plugin::users-permissions.user').create({
            data: {
                username: testEmail,
                email: testEmail,
                password: 'Password123!',
                role: roleId,
                confirmed: true
            }
        });
        userId = user.id;
        jwt = strapi.plugins['users-permissions'].services.jwt.issue({ id: user.id });

        // 3. Ensure Master Data (Type/Status)
        // Tax Year
        let taxYear = await strapi.documents('api::tax-year.tax-year').findMany({ filters: { year: '2024' } });
        if (taxYear.length === 0) {
            taxYear = [await strapi.documents('api::tax-year.tax-year').create({ data: { year: '2024', isActive: true } })];
        }
        taxYearId = taxYear[0].documentId;

        // Filing Type
        let fType = await strapi.documents('api::filing-type.filing-type').findMany({ filters: { type: 'PERSONAL' } });
        if (fType.length === 0) {
            fType = [await strapi.documents('api::filing-type.filing-type').create({ data: { type: 'PERSONAL', code: 'T1', displayName: 'Personal' } })];
        }
        filingTypeId = fType[0].documentId;

        // Filing Status
        let fStatus = await strapi.documents('api::filing-status.filing-status').findMany({ filters: { statusCode: 'IN_PROGRESS' } });
        if (fStatus.length === 0) {
            fStatus = [await strapi.documents('api::filing-status.filing-status').create({ data: { displayName: 'In Progress', statusCode: 'IN_PROGRESS', description: 'Draft status' } })];
        }
        filingStatusId = fStatus[0].documentId;

        // Grant Permissions
        const roleNumericId = authenticatedRole[0].id;
        await strapi.db.query('plugin::users-permissions.permission').create({ data: { action: 'api::filing.filing.create', role: roleNumericId } });
        await strapi.db.query('plugin::users-permissions.permission').create({ data: { action: 'api::filing.filing.update', role: roleNumericId } });
        await strapi.db.query('plugin::users-permissions.permission').create({ data: { action: 'api::filing.filing.find', role: roleNumericId } });
    });

    afterAll(async () => {
        if (strapi) {
            await strapi.destroy();
        }
    });

    it('should save detailed income for Spouse and Dependents via "people" array', async () => {
        // 2. Prepare Detailed Payload
        const PEOPLE_PAYLOAD = {
            filingSetup: {
                type: 'MULTI_PERSON',
                includeSpouse: 'YES',
                numEarningDependents: 1
            },
            people: [
                {
                    role: 'PRIMARY',
                    data: {
                        personalInfo: {
                            firstName: 'Primary',
                            lastName: 'Filer',
                            sin: '111-111-111',
                            dateOfBirth: '1980-01-01',
                            maritalStatus: 'MARRIED'
                        },
                        income: { total: 50000 } // Old structure just in case
                    }
                },
                {
                    role: 'SPOUSE',
                    data: {
                        personalInfo: {
                            firstName: 'Spouse',
                            lastName: 'Filer',
                            sin: '222-222-222',
                            dateOfBirth: '1982-01-01'
                        },
                        spouse: {
                            netIncome: 45000
                        },
                        incomeSources: {
                            t4_income: true,
                            self_employment: false
                        },
                        taxSlips: {
                            t4s: [{ employer: 'Spouse Job Inc', income: 45000 }]
                        },
                        netIncome: 45000 // Detailed field 
                    }
                },
                {
                    role: 'DEPENDENT',
                    dependentIndex: 0,
                    data: {
                        personalInfo: {
                            firstName: 'Junior',
                            lastName: 'Filer',
                            dateOfBirth: '2010-01-01',
                            relationship: 'Child',
                            earnsIncome: 'YES'
                        },
                        incomeSources: {
                            t4a_income: true
                        },
                        taxSlips: {
                            t4as: [{ payer: 'University', amount: 5000 }]
                        },
                        netIncome: 5000
                    }
                }
            ]
        };

        const createRes = await strapi.controller('api::filing.filing').create({
            state: { user: { id: userId } },
            request: {
                body: {
                    data: {
                        filingType: filingTypeId,
                        taxYear: taxYearId,
                        filingStatus: filingStatusId,
                        filingData: PEOPLE_PAYLOAD
                    }
                }
            }
        });

        // 3. Verify Database Persistence for Spouse & Dependent Details
        // Create returns the entity directly in our mock context because of created: (data) => data
        // But the controller might wrap it in { data: ... } sanitized response.
        // Let's assume createRes is the response.

        const filingDocId = createRes.data?.documentId || createRes.documentId;

        const personalFilings = await strapi.documents('api::personal-filing.personal-filing').findMany({
            filters: { filing: { documentId: filingDocId } },
            populate: ['spouse', 'dependents']
        });

        expect(personalFilings.length).toBe(1);
        const pf = personalFilings[0];

        // 3a. Verify Primary
        expect(pf.firstName).toBe('Primary');

        // 3b. Verify Spouse Detailed Income
        expect(pf.spouse).toBeDefined();
        expect(pf.spouse.firstName).toBe('Spouse');
        expect(pf.spouse.netIncome).toBe(45000);

        // 3c. Verify JSON Fields (The Critical Part)
        expect(pf.spouse.incomeSources).toEqual({ t4_income: true, self_employment: false });
        expect(pf.spouse.taxSlips).toEqual({ t4s: [{ employer: 'Spouse Job Inc', income: 45000 }] });

        // 3d. Verify Dependent Detailed Income
        expect(pf.dependents).toBeDefined();
        expect(pf.dependents.length).toBe(1);
        const dep = pf.dependents[0];
        expect(dep.firstName).toBe('Junior');
        expect(dep.netIncome).toBe(5000);
        expect(dep.incomeSources).toEqual({ t4a_income: true });
        expect(dep.taxSlips).toEqual({ t4as: [{ payer: 'University', amount: 5000 }] });

        console.log('✅ Advanced Multi-Person Persistence Verified!');
    });
});
