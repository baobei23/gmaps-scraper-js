import { playwright } from 'botasaurus/playwright';
import { gotScraping } from 'got-scraping';
import * as fs from 'fs';
import * as path from 'path';

interface ExtractedInfo {
  nama: string | null;
  alamat: string | null;
  website: string | null;
  telepon: string | null;
  kategori: string[];
  klaim: boolean;
  pemilik: string | null;
}

function extractData(html: string): ExtractedInfo {
  try {
    // Ambil JSON APP_INITIALIZATION_STATE
    const splitByInit = html.split(';window.APP_INITIALIZATION_STATE=');
    if (splitByInit.length < 2) return { nama: null, alamat: null, website: null, telepon: null, kategori: [], klaim: false, pemilik: null };

    const jsonString = splitByInit[1].split(';window.APP_FLAGS')[0];
    const outerArr = JSON.parse(jsonString);

    const rawData: string | undefined = outerArr?.[3]?.[6];
    if (!rawData || typeof rawData !== 'string') return { nama: null, alamat: null, website: null, telepon: null, kategori: [], klaim: false, pemilik: null };

    const cleaned = rawData.startsWith(")]}'") ? rawData.slice(5) : rawData;
    const parsedData = JSON.parse(cleaned);

    const nama = parsedData?.[6]?.[11] ?? null;
    const alamat = parsedData?.[6]?.[39] ?? null;
    const website = parsedData?.[6]?.[7]?.[0] ?? null;
    const telepon = parsedData?.[6]?.[178]?.[0]?.[3] ?? null;
    const kategori = parsedData?.[6]?.[13] ?? [];
    const klaim = parsedData?.[6]?.[49]?.[1] ? true : false;
    const pemilik = parsedData?.[6]?.[57]?.[1] ?? null;
    return { nama, alamat, website, telepon, kategori, klaim, pemilik };
  } catch {
    return { nama: null, alamat: null, website: null, telepon: null, kategori: [], klaim: false, pemilik: null };
  }
}

// Function to load Google Maps categories from CSV file
function loadGoogleMapsCategories(): string[] {
  try {
    // Use a more reliable way to get the path to the inputs directory
    const appRootPath = process.cwd();
    const csvPath = path.join(appRootPath, 'inputs', 'googlemaps_category.csv');
    console.log('Looking for categories file at:', csvPath);
    const content = fs.readFileSync(csvPath, 'utf8');
    return content.split('\n').filter(line => line.trim() !== '');
  } catch (error) {
    console.error('Error loading Google Maps categories:', error);
    return [];
  }
}

// Function to scrape a single query
async function scrapeSingleQuery(query: string, page: any) {
  // Construct Google Maps search URL from the query
  const searchLink = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

  // 1. Open Google Maps search page
  await page.goto(searchLink, { waitUntil: 'domcontentloaded' });

  // Attempt to accept Google cookies popup if it appears.
  try {
    await page.click('button:has-text("Accept all")', { timeout: 3000 });
  } catch {}

  const FEED_SELECTOR = '[role="feed"]';
  const linkSet = new Set<string>();

  // Helper to extract all place links currently in the DOM
  const extractLinks = async () => {
    const links = await page.$$eval(
      `${FEED_SELECTOR} > div > div > a`,
      (anchors) => anchors.map((a) => (a as HTMLAnchorElement).href),
    );
    links.forEach((l) => linkSet.add(l));
  };

  // Helper to detect end of results
  const hasReachedEnd = async () => {
    return (await page.$('p.fontBodyMedium > span > span')) !== null;
  };

  // 2. Scroll and collect links
  while (true) {
    await extractLinks();

    // Scroll to bottom of the feed
    await page.evaluate((sel) => {
      const feed = document.querySelector(sel);
      if (feed) (feed as HTMLElement).scrollTo(0, feed.scrollHeight);
    }, FEED_SELECTOR);

    await page.waitForTimeout(1500);

    if (await hasReachedEnd()) {
      await extractLinks();
      break; 
    }
  }

  return Array.from(linkSet);
}

// Function to extract data from place links
async function extractPlacesData(links: string[], cookieHeader: string) {
  // 4. Fetch each place page concurrently (max 5 at a time) & extract title
  const CONCURRENCY = 5;
  const results: any[] = [];

  for (let i = 0; i < links.length; i += CONCURRENCY) {
    const batch = links.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (placeLink) => {
        try {
          const response = await gotScraping({
            url: placeLink,
            headers: { 
              cookie: cookieHeader,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            },
            timeout: { request: 12000 },
            retry: { limit: 5 },
          });
          const { nama, alamat, website, telepon, kategori, klaim, pemilik } = extractData(response.body);
          return { nama, alamat, website, telepon, kategori, klaim, pemilik, link: placeLink};
        } catch (error: any) {
          return { link: placeLink, error: error.message };
        }
      }),
    );
    results.push(...batchResults);
  }

  return results;
}

const scrapeGoogleMaps = playwright<any>({
  headless: false,
  output: null,
  name: 'scrapeGoogleMaps',
  reuseDriver: true, // Reuse the browser instance across multiple tasks
  run: async ({ data, page }) => {
    // Prepare the queries to search
    let queriesToSearch: string[] = [];
    
    // Method 1: Normal queries input
    if (data.queries && data.queries.length > 0 && data.queries[0] !== '') {
      queriesToSearch = data.queries;
    } 
    // Method 2: Bulk edit textarea
    else if (data.use_bulk_edit && data.bulk_queries && data.bulk_queries.trim() !== '') {
      queriesToSearch = data.bulk_queries.split('\n').filter((q: string) => q.trim() !== '');
    }
    // Method 3: Location + Categories search
    else if (data.location && data.location.trim() !== '') {
      const location = data.location.trim();
      const categories = loadGoogleMapsCategories();
      
      // Create queries by combining each category with the location
      queriesToSearch = categories.map(category => `${category} ${location}`);
    }

    if (queriesToSearch.length === 0) {
      return { error: "No search queries provided" };
    }

    // Create a map to store all unique place links across all queries
    const allPlaceLinks = new Set<string>();
    
    // Process each query sequentially
    for (const query of queriesToSearch) {
      console.log(`Searching for: ${query}`);
      const links = await scrapeSingleQuery(query, page);
      
      // Add all links to the set of all place links
      links.forEach(link => allPlaceLinks.add(link));
    }

    // Prepare HTTP cookies for got-scraping requests
    const cookiesArr = await page.context().cookies();
    const cookieHeader = cookiesArr.map((c) => `${c.name}=${c.value}`).join('; ');

    // Extract data from all unique place links
    const results = await extractPlacesData(Array.from(allPlaceLinks), cookieHeader);
    
    return results;
  },
});

export { scrapeGoogleMaps };