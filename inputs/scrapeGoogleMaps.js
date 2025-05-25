/**
 * @typedef {import('botasaurus-controls').Controls} Controls
 * @typedef {import('botasaurus-controls').FileTypes} FileTypes
 * 
 */

/**
 * @param {Controls} controls
 */
function getInput(controls) {
    // Add a section for regular queries with dynamic input fields
    controls.section('Regular Queries', (section) => {
        // Standard query input with ability to add multiple entries
        section.listOfTexts('queries', {
            isRequired: (data) => !data.use_categories,
            label: 'Pencarian',
            placeholder: 'Hotel di Padang',
            defaultValue: ["Hotel di Padang"],
            helpText: 'You can add multiple queries by clicking the "Add" button below',
            isDisabled: (data) => data.use_categories,
            disabledMessage: 'Disabled because Category-based Search is enabled'
        });
        
        // Textarea for bulk input of queries (one per line)
        section.textarea('bulk_queries', {
            label: 'Bulk Edit Queries',
            placeholder: 'Enter one query per line\nFor example:\nHotel di Padang\nRestoran di Padang\nToko di Padang',
            isShown: (data) => !data.use_categories,
            helpText: 'Enter one query per line. These will replace the individual queries above.',
            isRequired: false,
            isDisabled: (data) => data.use_categories,
            disabledMessage: 'Disabled because Category-based Search is enabled'
        });
    });

    // Category-based query generator section
    controls.section('Category-based Search', (section) => {
        section.checkbox('use_categories', {
            label: 'Use Category-based Search',
            defaultValue: false,
            helpText: 'This will generate queries by combining your location with all Google Maps categories.'
        });

        section.text('location', {
            isRequired: (data) => data.use_categories,
            label: 'Location',
            placeholder: 'Padang',
            isShown: (data) => data.use_categories,
            helpText: 'Enter a location (city, area, etc.) to combine with categories',
            validate: (value, data) => {
                if (data.use_categories && (!value || value.trim() === '')) {
                    return "Location is required when using category-based search";
                }
                return undefined;
            }
        });

        section.numberGreaterThanOrEqualToOne('max_categories', {
            isRequired: (data) => data.use_categories,
            label: 'Max Categories',
            defaultValue: 10,
            isShown: (data) => data.use_categories,
            helpText: 'Maximum number of categories to include in search (limit to avoid too many queries)'
        });

        section.checkbox('randomize_categories', {
            label: 'Randomize Categories',
            defaultValue: true,
            isShown: (data) => data.use_categories,
            helpText: 'Randomize the order of categories instead of using alphabetical order'
        });

        section.text('category_search_status', {
            label: 'Status',
            isRequired: false,
            isShown: (data) => data.use_categories,
            isDisabled: true,
            defaultValue: 'Will generate queries combining categories with your location',
            helpText: 'This will create multiple search queries automatically.'
        });
    });
}
