import * as querystring from 'querystring';
import { Server } from 'botasaurus-server/server'
import { View, Field, ExpandDictField, ExpandListField, filters, sorts } from 'botasaurus-server/ui';
import urlLib from 'url'
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { config } from '../../main/config';
import { scrapeGoogleMaps } from '../src/scraper';
import { cleanSearchString, prepareTaskData } from '../src/preprocessors';

// Function to read categories from the CSV file
function readCategoriesFromCSV(): string[] {
  try {
    const categoriesPath = path.join(__dirname, '../../../inputs/googlemaps_category.csv');
    const fileContent = fs.readFileSync(categoriesPath, 'utf8');
    const lines = fileContent.split('\n');
    return lines
      .map(line => line.trim())
      .filter(line => line && line.length > 0); // Filter out empty lines
  } catch (error) {
    console.error('Error reading categories file:', error);
    return [];
  }
}

function extractDomainFromLink(url: string): string {
  try {
    return new URL(url).hostname;
  } catch (error) {
    return url;
  }
}

// @ts-ignore
function unquotePlus(inputStr: string): string {
  return querystring.unescape(inputStr.replace(/\+/g, ' ')).trim();
}

function convertToString(inputStr: string): string {
  return unquotePlus(inputStr);
}

function shuffle(array: any[]) {
  let currentIndex = array.length;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

function randomizeStrings(stringList: string[]): string[] {
  const randomizedList = [...stringList];
  shuffle(randomizedList);
  return randomizedList;
}

// Process bulk queries text to array
function processBulkQueries(bulkText: string): string[] {
  if (!bulkText || bulkText.trim() === '') return [];
  
  return bulkText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.length > 0);
}

// Generate category-based queries
function generateCategoryQueries(location: string, maxCategories: number, randomize: boolean): string[] {
  const categories = readCategoriesFromCSV();
  let selectedCategories = categories;
  
  if (randomize) {
    selectedCategories = randomizeStrings(categories);
  }
  
  // Limit the number of categories if requested
  if (maxCategories && maxCategories > 0 && maxCategories < selectedCategories.length) {
    selectedCategories = selectedCategories.slice(0, maxCategories);
  }
  
  // Combine categories with location
  return selectedCategories.map(category => `${category} ${location}`);
}

function createTasksForLinks(data: any, links: string[]): any {
  const task = { ...data };
  task['links'] = links;
  task['query'] = 'Links';
  return task;
}

function createTasksForQueries(data: any, queries: string[]): any[] {
  const tasks: any[] = [];
  for (const query of queries) {
    const task = { ...data };
    task['query'] = cleanSearchString(query);
    tasks.push(task);
  }
  return tasks;
}

function extractPathFromLink(link: string): any {
  if (typeof link === 'string') {
    try {
      const parsedUrl = new urlLib.URL(link);
      return parsedUrl.pathname;
    } catch (error) {
      return null;
    }
  }
  return null;
}

function filterLinks(queries: string[]): string[] {
  return queries.filter(query => query.startsWith('http://') || query.startsWith('https://'));
}

function splitByGmapsSearchLinks(links: string[]): [string[], string[]] {
  const searchQueries: string[] = [];
  const inPlaceLinks: string[] = [];

  for (const link of links) {
    const parsedLink = extractPathFromLink(link);
    
    if (!parsedLink) {
      continue;
    }

    if (parsedLink.startsWith('/maps/search')) {
      const x = convertToString(parsedLink.replace('/maps/search/', '').split('/')[0]);
      if (x) {
        searchQueries.push(x);
      } else if (link.includes('query_place_id') || link.includes('=place_id:')) {
        inPlaceLinks.push(link);
      }
    } else {
      inPlaceLinks.push(link);
    }
  }

  return [inPlaceLinks, searchQueries];
}

function splitAndCreateTasks(data: any, queries: string[]): any[] {
  console.log(`Creating tasks from ${queries.length} queries`);
  
  // If no queries, return an empty array
  if (!queries || queries.length === 0) {
    console.error("No queries provided to splitAndCreateTasks!");
    return [];
  }

  const allLinks = filterLinks(queries);
  const [placesLinks, searchQueries] = splitByGmapsSearchLinks(allLinks);
  const placesLinksSet = new Set(allLinks);

  for (const query of queries) {
    if (!placesLinksSet.has(query)) {
      searchQueries.push(query);
    }
  }

  const tasks = createTasksForQueries(data, searchQueries);
  console.log(`Created ${tasks.length} query tasks`);

  if (placesLinks.length > 0) {
    const linksTask = createTasksForLinks(data, placesLinks);
    tasks.unshift(linksTask);
    console.log(`Added 1 links task with ${placesLinks.length} links`);
  }

  console.log(`Total tasks created: ${tasks.length}`);
  return tasks;
}

function splitTaskByQuery(data: any): any[] {
  console.log("Split task called with data:", JSON.stringify({
    use_categories: data.use_categories,
    location: data.location ? data.location : "(not provided)",
    queries_count: Array.isArray(data.queries) ? data.queries.length : 0
  }));
  
  // Get processed data with queries
  const processedData = prepareTaskData(data);
  
  if (!processedData.queries || processedData.queries.length === 0) {
    console.error("No queries were generated after preparing task data!");
    
    // If using category search but no queries were generated, create a default query
    if (data.use_categories && data.location) {
      console.log("Using fallback query for location:", data.location);
      processedData.queries = [`Hotel in ${data.location}`];
    } else {
      return [];
    }
  }
  
  // Create tasks from the processed queries
  return splitAndCreateTasks(processedData, processedData.queries);
}

function getTaskName(data: any): string {
  return data['query'];
}

// Configure the server
Server.addScraper(
  scrapeGoogleMaps,
  {
    createAllTask: true,
    splitTask: splitTaskByQuery,
    getTaskName: getTaskName,
    isGoogleChromeRequired: true,
  }
);

Server.setRateLimit({ task: 1 });
Server.enableCache();
Server.configure({
  headerTitle: 'Google Maps Scraper',
  description: 'Find businesses on Google Maps with advanced search capabilities.',
  rightHeader: {
    text: 'Made with Botasaurus',
    link: 'https://github.com/omkarcloud/google-maps-scraper',
  },
});

// Add Email support details
Server.addEmailSupport({
  email: 'support@example.com', 
  subject: `Help with ${config.productName} Tool`,
  body: `Hi, I need help with using the ${config.productName} Tool`,
});

Server.addWhatsAppSupport({
  number: '1234567890',
  countryCallingCode: '1',
  message: `Hi, I need help with using the ${config.productName} Tool`,
});