import { Server } from 'botasaurus-server/server';
import { scrapeGoogleMaps } from '../src/scraper';

Server.addScraper(scrapeGoogleMaps);