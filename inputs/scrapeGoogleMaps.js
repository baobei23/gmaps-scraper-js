/**
 * @typedef {import('botasaurus-controls').Controls} Controls
 * @typedef {import('botasaurus-controls').FileTypes} FileTypes
 * 
 */

/**
 * @param {Controls} controls
 */
function getInput(controls) {
    controls
        // Render a Text Input for query
        .text('query', { 
            isRequired: true, 
            label: 'Pencarian', 
            placeholder: 'Hotel di Padang',
            defaultValue: "Hotel di Padang" 
        })
}
