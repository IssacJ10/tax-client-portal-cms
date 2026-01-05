
const { createStrapi } = require('@strapi/strapi');

async function fixFilingView() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('Fixing Filing Admin View Configuration...');

        const coreStore = strapi.store({
            type: 'plugin',
            name: 'content-manager',
        });

        const key = 'configuration_content_types::api::filing.filing';

        // Fetch current config for Filing
        let config = await coreStore.get({ key });

        if (!config) {
            console.log('No existing configuration found. Creating default...');
            config = {
                settings: {
                    bulkable: true,
                    filterable: true,
                    searchable: true,
                    pageSize: 10,
                    mainField: 'id',
                    defaultSortBy: 'id',
                    defaultSortOrder: 'DESC'
                },
                metadatas: {
                    id: { edit: {}, list: { label: 'ID', searchable: true, sortable: true } },
                    taxYear: {
                        edit: {
                            label: 'Tax Year',
                            description: '',
                            placeholder: '',
                            visible: true,
                            editable: true,
                            mainField: 'year'
                        },
                        list: {
                            label: 'Tax Year',
                            searchable: true,
                            sortable: true,
                            mainField: 'year'
                        }
                    },
                    user: {
                        edit: { label: 'User', mainField: 'email', visible: true, editable: true },
                        list: { label: 'User', mainField: 'email', searchable: true, sortable: true }
                    }
                },
                layouts: {
                    list: ['id', 'user', 'taxYear', 'status'],
                    edit: [
                        [{ names: ['user'], size: 6 }, { names: ['taxYear'], size: 6 }],
                        [{ names: ['status'], size: 6 }, { names: ['progress'], size: 6 }],
                        [{ names: ['filingData'], size: 12 }]
                    ]
                }
            };
        } else {
            console.log('Existing configuration found. Patching...');
            // Ensure taxYear metadata exists and enforce mainField
            config.metadatas = {
                ...config.metadatas,
                taxYear: {
                    ...(config.metadatas.taxYear || {}),
                    edit: {
                        ...(config.metadatas.taxYear?.edit || {}),
                        mainField: 'year',
                        visible: true
                    },
                    list: {
                        ...(config.metadatas.taxYear?.list || {}),
                        mainField: 'year'
                    }
                }
            };
        }

        await coreStore.set({ key, value: config });

        console.log('Successfully updated Filing view configuration!');
        console.log('Forced metadatas.taxYear.mainField = "year"');

    } catch (error) {
        console.error('Configuration Fix Error:', error);
    }

    process.exit(0);
}

fixFilingView();
