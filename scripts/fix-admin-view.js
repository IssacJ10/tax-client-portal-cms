
const { createStrapi } = require('@strapi/strapi');

async function fixAdminView() {
    const strapi = await createStrapi({ distDir: './dist' }).load();

    try {
        console.log('Fixing Admin View Configuration for Tax Year...');

        const coreStore = strapi.store({
            type: 'plugin',
            name: 'content-manager',
        });

        // The key for the configuration of the tax-year model
        const key = 'configuration_content_types::api::tax-year.tax-year';

        // Fetch current config
        const currentConfig = await coreStore.get({ key });

        // Define the desired config
        // We force 'mainField' to 'year' so relations display the year string.
        const newConfig = {
            ...currentConfig,
            settings: {
                ...(currentConfig?.settings || {}),
                mainField: 'year',
                defaultSortBy: 'year',
                defaultSortOrder: 'DESC',
                searchable: true,
                filterable: true,
                bulkable: true,
            },
            metadatas: {
                ...(currentConfig?.metadatas || {}),
                id: {
                    edit: {},
                    list: { label: 'ID', searchable: true, sortable: true }
                },
                year: {
                    edit: {
                        label: 'Tax Year',
                        description: 'Format: YYYY',
                        placeholder: '2025',
                        visible: true,
                        editable: true
                    },
                    list: {
                        label: 'Tax Year',
                        searchable: true,
                        sortable: true
                    }
                },
                ...Object.keys(currentConfig?.metadatas || {}).reduce((acc, k) => {
                    if (k !== 'id' && k !== 'year') acc[k] = currentConfig.metadatas[k];
                    return acc;
                }, {})
            },
            layouts: {
                ...(currentConfig?.layouts || {}),
                list: ['year', 'isActive', 'filingDeadline', 'status'],
                edit: currentConfig?.layouts?.edit || [
                    [{ names: ['year'], size: 6 }, { names: ['isActive'], size: 6 }],
                    [{ names: ['filingDeadline'], size: 6 }, { names: ['status'], size: 6 }],
                    [{ names: ['instructions'], size: 12 }]
                ]
            }
        };

        // Update the store
        await coreStore.set({ key, value: newConfig });

        console.log('Successfully updated Tax Year view configuration!');
        console.log('Set mainField: "year"');

    } catch (error) {
        console.error('Configuration Fix Error:', error);
    }

    process.exit(0);
}

fixAdminView();
