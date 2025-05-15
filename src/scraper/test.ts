/**
 * This is a playground to test your code
 * You can write code to quickly test your scraper
 */
import { scrapeGoogleMaps } from './src/scraper';

async function main() {
  console.log(
    await scrapeGoogleMaps({ link: 'https://stackoverflow.blog/open-source' }),
  );
}

main();
