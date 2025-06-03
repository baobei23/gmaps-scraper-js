import { Server } from 'botasaurus-server/server';
import { View, Field, filters, sorts } from 'botasaurus-server/ui';
import { scrapeGoogleMaps } from '../src/scraper';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to clean search strings
function cleanSearchString(s: string): string {
  if (typeof s === 'string') {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }
  return '';
}

// Helper function to create tasks from a list of queries
function createTasksForQueries(data: any, queries: string[]): any[] {
  const tasks: any[] = [];
  for (const query of queries) {
    if (query) {
      // Ensure query is not empty
      const task = { ...data };
      task['query'] = cleanSearchString(query);
      tasks.push(task);
    }
  }
  return tasks;
}

let googleMapsCategories: string[] = [];
try {
  // Determine the correct path to the CSV file relative to the workspace root
  // The script runs from somewhere like /Users/reginald/Documents/dev/gmaps-scraper-js
  // And the CSV is at inputs/googlemaps_category.csv
  const csvFilePath = path.join(
    process.cwd(),
    'inputs',
    'googlemaps_category.csv',
  );
  const csvData = fs.readFileSync(csvFilePath, 'utf-8');
  googleMapsCategories = csvData
    .split(/\r?\n/)
    .map((category) => category.trim())
    .filter((category) => category);
} catch (error) {
  console.error('Error reading or parsing googlemaps_category.csv:', error);
  // Keep googleMapsCategories as empty if file reading fails, so the feature is gracefully disabled.
}

function splitTaskByQuery(data: any): any[] {
  let allQueries: string[] = [];
  let categoriesToUse = [...googleMapsCategories]; // Start with all loaded categories

  if (
    data.use_categories &&
    data.category_location &&
    categoriesToUse.length > 0
  ) {
    const location = data.category_location.trim();

    // Apply category limit if specified and valid
    if (
      data.max_categories &&
      typeof data.max_categories === 'number' &&
      data.max_categories > 0
    ) {
      categoriesToUse = categoriesToUse.slice(0, data.max_categories);
      console.log(
        `[SERVER] Limiting to first ${data.max_categories} categories. Using ${categoriesToUse.length} categories.`,
      );
    } else {
      console.log(
        `[SERVER] Using all ${categoriesToUse.length} categories (no valid limit specified).`,
      );
    }

    if (location && categoriesToUse.length > 0) {
      allQueries = categoriesToUse.map(
        (category) => `${category} di ${location}`,
      );
    }
  } else {
    const manualQueries = data.queries || [];
    const bulkQueriesText = data.bulk_queries || '';
    const bulkQueriesList = bulkQueriesText
      .split(/r?n/)
      .map((q: string) => q.trim())
      .filter((q: string) => q);

    allQueries = [...manualQueries, ...bulkQueriesList];
  }

  // Remove duplicates and empty queries
  const uniqueQueries = Array.from(
    new Set(allQueries.filter((q) => q && q.trim() !== '')),
  );

  if (uniqueQueries.length === 0) {
    // If, after all processing, there are no queries, maybe throw an error or return a default task.
    // For now, let's prevent scraper runs with no actual query.
    // This could happen if user enables category search but provides no location,
    // or provides no manual/bulk queries.
    // The input validation should ideally catch this, but as a fallback:
    if (
      data.use_categories &&
      (!data.category_location || data.category_location.trim() === '')
    ) {
      throw new Error('Lokasi diperlukan untuk pencarian kategori.');
    }
    throw new Error('Tidak ada kata kunci pencarian yang valid diberikan.');
  }

  // The scrapeGoogleMaps scraper seems to take a single 'query' string.
  // So, we need to create one task per unique query.
  return createTasksForQueries(data, uniqueQueries);
}

function getTaskName(data: any): string {
  // data here is a single task object after splitTaskByQuery has run.
  // It will have a 'query' field.
  return data['query'] || 'Pencarian Google Maps';
}

const gmapsFilters = [
  new filters.SearchTextInput('nama'),
  new filters.SearchTextInput('alamat'),
  new filters.IsTrueCheckbox('website'),
  new filters.IsTruthyCheckbox('telepon'),
  new filters.SearchTextInput('kategori', { label: 'Kategori Mengandung' }),
  new filters.BoolSelectDropdown('klaim'),
];

const gmapsSorts = [
  new sorts.AlphabeticAscendingSort('kategori'),
  new sorts.AlphabeticDescendingSort('kategori'),
];

Server.addScraper(scrapeGoogleMaps, {
  createAllTask: true,
  splitTask: splitTaskByQuery,
  getTaskName: getTaskName,
  filters: gmapsFilters,
  sorts: gmapsSorts,
  views: [],
  removeDuplicatesBy: 'link', // Assuming 'link' is a unique identifier for place results
  // isGoogleChromeRequired:true, // Keep if playwright uses Chrome. Playwright can use others too.
});

Server.enableCache();

// Optional: Configure server details (example from server-example.ts)
// import { config } from '../../main/config'; // If you have a config file
Server.configure({
  headerTitle: 'BPS Scraper',
  description: 'Scrape Google Maps data',
  rightHeader: {
    text: 'BPS',
    link: 'https://sumbar.bps.go.id', // Update with your repo
  },
});

// Optional: Add support channels (example from server-example.ts)
// Server.addEmailSupport({
//   email: 'support@example.com',
//   subject: `Bantuan dengan Alat Scraper Google Maps`,
//   body: `Hai, saya butuh bantuan dengan Alat Scraper Google Maps`,
// });

// Server.addWhatsAppSupport({
//   number: '1234567890',
//   countryCallingCode: '1',
//   message: `Hai, saya butuh bantuan dengan Alat Scraper Google Maps`,
// });

// To handle potential linter error from server-example.ts: Object literal may only specify known properties...
// Server.setRateLimit({ google_maps_scraper:1 }); // If you want to rate limit this specific scraper
// If you want general rate limits:
// Server.setRateLimit({ task: 1 }); // Example: 1 task at a time globally
