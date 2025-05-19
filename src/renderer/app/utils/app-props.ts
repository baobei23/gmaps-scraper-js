export const appProps = {
    "header_title": "Botasaurus",
    "description": "Build Awesome Scrapers with Botasaurus, The All in One Scraping Framework.",
    "right_header": {
        "text": "Love It? Star It! ★",
        "link": "https://github.com/omkarcloud/botasaurus"
    },
    "readme": "",
    "enable_cache": false,
    "scrapers": [
        {
            "name": "Scrape Google Maps",
            "scraper_name": "scrapeGoogleMaps",
            "input_js": "/**\n * @typedef {import('botasaurus-controls').Controls} Controls\n * @typedef {import('botasaurus-controls').FileTypes} FileTypes\n * \n */\n\n/**\n * @param {Controls} controls\n */\nfunction getInput(controls) {\n    controls\n        // Render a Text Input for query\n        .text('query', { \n            isRequired: true, \n            label: 'Pencarian', \n            placeholder: 'Hotel di Padang',\n            defaultValue: \"Hotel di Padang\" \n        })\n}\n",
            "input_js_hash": "03195d5b4416d034c075d5b8ba257e05",
            "filters": [],
            "sorts": [
                {
                    "id": "no_sort",
                    "label": "No Sort"
                }
            ],
            "views": [],
            "default_sort": "no_sort"
        }
    ]
}