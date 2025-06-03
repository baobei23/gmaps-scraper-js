export const appProps = {
    "header_title": "BPS Scraper",
    "description": "Scrape Google Maps data",
    "right_header": {
        "text": "BPS",
        "link": "https://sumbar.bps.go.id"
    },
    "readme": "### requirements\n- node version: v20.13.1",
    "enable_cache": true,
    "scrapers": [
        {
            "name": "Scrape Google Maps",
            "scraper_name": "scrapeGoogleMaps",
            "input_js": "/**\n * @typedef {import('botasaurus-controls').Controls} Controls\n * @typedef {import('botasaurus-controls').FileTypes} FileTypes\n * \n */\n\n/**\n * @param {Controls} controls\n */\nfunction getInput(controls) {\n    controls\n        .listOfTexts('queries', { \n            label: 'Kata Kunci Pencarian (satu per baris)', \n            placeholder: 'misalnya, Restoran di Jakarta', \n            defaultValue: ['Hotel di Padang'],\n            isDisabled: (data) => data.use_categories,\n            disabledMessage: 'Dinonaktifkan jika \"Gunakan Pencarian Kategori\" aktif.'\n        })\n        .switch('use_categories', {\n            label: 'Gunakan Pencarian Kategori (menonaktifkan input manual di atas)',\n            defaultValue: false,\n            helpText: 'Jika diaktifkan, pencarian akan dilakukan berdasarkan semua kategori Google Maps untuk lokasi yang ditentukan di bawah ini.'\n        })\n        .text('category_location', {\n            label: 'Lokasi untuk Pencarian Kategori',\n            placeholder: 'misalnya, Padang',\n            isRequired: (data) => data.use_categories,\n            isDisabled: (data) => !data.use_categories,\n            disabledMessage: 'Diaktifkan hanya jika \"Gunakan Pencarian Kategori\" aktif.',\n            helpText: 'Masukkan nama daerah (kota, provinsi, dll.).'\n        })\n        .number('max_categories', {\n            label: 'Batas Jumlah Kategori (opsional)',\n            placeholder: 'misalnya, 100',\n            helpText: 'Batasi jumlah kategori yang akan digunakan untuk pencarian. Biarkan kosong untuk menggunakan semua kategori.',\n            min: 1,\n            isShown: (data) => data.use_categories,\n            isDisabled: (data) => !data.use_categories,\n            isRequired: false\n        });\n}\n",
            "input_js_hash": "43c7802ab7455d8fdb9f49263a5d39d7",
            "filters": [
                {
                    "id": "nama_search_text_input",
                    "type": "SearchTextInput",
                    "label": "Search Nama"
                },
                {
                    "id": "alamat_search_text_input",
                    "type": "SearchTextInput",
                    "label": "Search Alamat"
                },
                {
                    "id": "website_is_true_checkbox",
                    "type": "IsTrueCheckbox",
                    "label": "Has Website"
                },
                {
                    "id": "telepon_is_truthy_checkbox",
                    "type": "IsTruthyCheckbox",
                    "label": "Has Telepon"
                },
                {
                    "id": "kategori_search_text_input",
                    "type": "SearchTextInput",
                    "label": "Kategori Mengandung"
                },
                {
                    "id": "klaim_bool_select_dropdown",
                    "type": "BoolSelectDropdown",
                    "label": "Has Klaim",
                    "options": [
                        {
                            "value": "yes",
                            "label": "Yes"
                        },
                        {
                            "value": "no",
                            "label": "No"
                        }
                    ]
                }
            ],
            "sorts": [
                {
                    "id": "no_sort",
                    "label": "No Sort"
                },
                {
                    "id": "kategori_alphabetic_ascending_sort",
                    "label": "Kategori -- A to Z"
                },
                {
                    "id": "kategori_alphabetic_descending_sort",
                    "label": "Kategori -- Z to A"
                }
            ],
            "views": [],
            "default_sort": "no_sort"
        }
    ]
}