import { playwright } from 'botasaurus/playwright';
import { gotScraping } from 'got-scraping';

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

const scrapeGoogleMaps = playwright<any>({
  headless: false,
  output: null,
  reuseDriver: false,
  name: 'scrapeGoogleMaps',
  run: async ({ data, page }) => {
    // Get the query from input data
    const query: string = data['query'];
    
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

    // 2. Scroll and collect linkss
    while (true) {
      await extractLinks();

      // Scroll to bottom of the feed
      await page.evaluate((sel) => {
        const feed = document.querySelector(sel);
        if (feed) (feed as HTMLElement).scrollTo(0, feed.scrollHeight);
      }, FEED_SELECTOR);

      await page.waitForTimeout(2000);

      if (await hasReachedEnd()) {
        await extractLinks();
        break; }
    }

    // 3. Prepare HTTP cookies for got-scraping requests
    const cookiesArr = await page.context().cookies();
    const cookieHeader = cookiesArr.map((c) => `${c.name}=${c.value}`).join('; ');

    // 4. Fetch each place page concurrently (max 5 at a time) & extract title
    const CONCURRENCY = 5;
    const results: any[] = [];
    const links = Array.from(linkSet);

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
  },
});

export { scrapeGoogleMaps };