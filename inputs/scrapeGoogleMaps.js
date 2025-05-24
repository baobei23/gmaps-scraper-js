/**
 * @typedef {import('botasaurus-controls').Controls} Controls
 * @typedef {import('botasaurus-controls').FileTypes} FileTypes
 * 
 */

/**
 * @param {Controls} controls
 */
function getInput(controls) {
    // Regular Search Section
    controls.section('Search Queries', (section) => {
        section
            .listOfTexts('queries', {
                isRequired: (data) => {
                    // Required only if location is not provided
                    return !data.location || data.location.trim() === '';
                },
                label: 'Search Queries',
                placeholder: 'Hotel di Padang',
                defaultValue: ["Hotel di Padang"],
                helpText: 'Add multiple queries to search on Google Maps',
                isDisabled: (data) => {
                    // Disable if location is provided
                    return data.location && data.location.trim() !== '';
                },
                disabledMessage: 'Please clear the location field below to use this feature'
            });
    });

    // Location + Categories Section
    controls.section('Location Category Search', (section) => {
        section
            .text('location', {
                isRequired: (data) => {
                    // Required only if queries are not provided
                    return (!data.queries || data.queries.length === 0 || data.queries[0] === '');
                },
                label: 'Location Name',
                placeholder: 'Padang',
                helpText: 'Enter a location to search with categories from Google Maps',
                isDisabled: (data) => {
                    // Disable if regular queries are provided
                    return (data.queries && data.queries.length > 0 && data.queries[0] !== '');
                },
                disabledMessage: 'Please clear the search queries above to use this feature'
            });
    });
}
