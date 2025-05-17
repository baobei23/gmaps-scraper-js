import { playwright } from 'botasaurus/playwright';
import { gotScraping } from 'got-scraping';

interface ExtractedInfo {
  nama: string | null;
  alamat: string | null;
  telepon: string | null;
  kategori: string[];
  pemilik: string | null;
}

function extractTitle(html: string): ExtractedInfo {
  try {
    // Ambil JSON APP_INITIALIZATION_STATE
    const splitByInit = html.split(';window.APP_INITIALIZATION_STATE=');
    if (splitByInit.length < 2) return { nama: null, alamat: null, telepon: null, kategori: [], pemilik: null };

    const jsonString = splitByInit[1].split(';window.APP_FLAGS')[0];
    const outerArr = JSON.parse(jsonString);

    const rawData: string | undefined = outerArr?.[3]?.[6];
    if (!rawData || typeof rawData !== 'string') return { nama: null, alamat: null, telepon: null, kategori: [], pemilik: null };

    const cleaned = rawData.startsWith(")]}'") ? rawData.slice(5) : rawData;
    const parsedData = JSON.parse(cleaned);

    const nama = parsedData?.[6]?.[11] ?? null;
    const alamat = parsedData?.[6]?.[39] ?? null;
    const telepon = parsedData?.[6]?.[178]?.[0]?.[3] ?? null;
    const kategori = parsedData?.[6]?.[13] ?? [];
    const pemilik = parsedData?.[6]?.[178]?.[0]?.[1] ?? null;
    return { nama, alamat, telepon, kategori, pemilik };
  } catch {
    return { nama: null, alamat: null, telepon: null, kategori: [], pemilik: null };
  }
}

const scrapeGoogleMaps = playwright<any>({
  headless: true,
  reuseDriver: true,
  name: 'scrapeGoogleMaps',
  run: async ({ data, page }) => {
    const searchLink: string = data['link'];

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

    // Helper to detect end of results (same selector logic as Python version)
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

      await page.waitForTimeout(500);

      if (await hasReachedEnd()) break;
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
              headers: { cookie: cookieHeader },
              timeout: { request: 12000 },
              retry: { limit: 5 },
            });
            const { nama, alamat, telepon, kategori, pemilik } = extractTitle(response.body);
            return { nama, alamat, telepon, kategori, pemilik, link: placeLink};
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