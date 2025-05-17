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
            "input_js": "/**\n * @typedef {import('botasaurus-controls').Controls} Controls\n * @typedef {import('botasaurus-controls').FileTypes} FileTypes\n * \n */\n\n/**\n * @param {Controls} controls\n */\nfunction getInput(controls) {\n    controls\n        // Render a Link Input\n        .link('link', { isRequired: true, defaultValue: \"https://stackoverflow.blog/open-source\" })\n}\n",
            "input_js_hash": "69fc72f1db61af05ec70a6f385e8591a",
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