import * as querystring from 'querystring';
import { Server } from 'botasaurus-server/server'
import { View, Field, ExpandDictField, ExpandListField, filters, sorts  } from 'botasaurus-server/ui';
import { getCities } from './country';
import urlLib from 'url'
import { categoryOptions } from './category';
import { googleMapsScraper, websiteContactsScraper } from '../src/gmaps'
import { canSearch, incrementPromptSearches, incrementSearches, resetPromptSearches, showStarPrompt } from '../../main/purchases'
import { config } from '../../main/config';

function extractDomainFromLink(url: string): string {
  return new URL(url).hostname
}

// @ts-ignore
function unquotePlus(inputStr: string): string {
    return querystring.unescape(inputStr.replace(/\+/g, ' ')).trim();
  }

function convertToString(inputStr: string): string {
  return unquotePlus(inputStr);
}

function createTasksForLinks(data: any, links: string[]): any {
  const task = { ...data };
  task['links'] = links;
  task['query'] = 'Links';
  return task;
}
function shuffle(array) {
    let currentIndex = array.length;
  
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
  
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

function prependToStrings(stringsList: string[], prependStr: string): string[] {
  prependStr = prependStr + ' in ';
  return stringsList.map(s => prependStr + s);
}

function cleanSearchString(s: string) {
  if (typeof s === 'string') {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }
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
function extractPathFromLink(link) :any{
  if (typeof link === 'string') {
    const parsedUrl = new urlLib.URL(link);
    return parsedUrl.pathname;
  }
  return null
}
function splitByGmapsSearchLinks(links: string[]): [string[], string[]] {
  const searchQueries: string[] = [];
  const inPlaceLinks: string[] = [];

  for (const link of links) {
    const parsedLink = extractPathFromLink(link);

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

function filterLinks(queries: string[]): string[] {
  return queries.filter(query => query.startsWith('http://') || query.startsWith('https://'));
}

function splitAndCreateTasks(data: any, queries: string[]): any[] {
  const allLinks = filterLinks(queries);
  const [placesLinks, searchQueries] = splitByGmapsSearchLinks(allLinks);
  const placesLinksSet = new Set(allLinks);

  for (const query of queries) {
    if (!placesLinksSet.has(query)) {
      searchQueries.push(query);
    }
  }

  const tasks = createTasksForQueries(data, searchQueries);

  if (placesLinks.length > 0) {
    const linksTask = createTasksForLinks(data, placesLinks);
    tasks.unshift(linksTask);
  }

  return tasks;
}

function handleStarPrompt() {
  if (showStarPrompt()) {
    resetPromptSearches()
    throw new Error("SHOW_STAR_MODAL")
  } else {
    incrementPromptSearches()
  }
}

function splitTaskByQuery(data: any): any[] {
  let tasks
  if (data['country']) {
    let cities = getCities(data['country']);

    if (data['randomize_cities']) {
      cities = randomizeStrings(cities);
    }

    if (data['max_cities']) {
      cities = cities.slice(0, data['max_cities']);
    }

    const queries = prependToStrings(cities, data['business_type']);
    delete data['queries'];
    tasks = createTasksForQueries(data, queries)
  } else {
    const queries = data['queries'];
    delete data['queries'];
    tasks = splitAndCreateTasks(data, queries);
  }
  if (canSearch(tasks.length)){
    incrementSearches(tasks.length)
  } else {
    throw new Error("NOT_ENOUGH_CREDITS")
  }
  
  handleStarPrompt()

  return tasks;
}

function getTaskName(data: any): string {
  return data['query'];
}

const review_fields = [
  new Field('review_id'),
  new Field('review_link'),
  new Field('name'),
  new Field('reviewer_id'),
  new Field('reviewer_profile'),
  new Field('rating'),
  new Field('review_text'),
  new Field('published_at'),
  new Field('published_at_date'),
  new Field('response_from_owner_text'),
  new Field('response_from_owner_ago'),
  new Field('response_from_owner_date'),
  new Field('total_number_of_reviews_by_reviewer'),
  new Field('total_number_of_photos_by_reviewer'),
  new Field('is_local_guide'),
  new Field('review_translated_text'),
  new Field('response_from_owner_translated_text'),
  new Field('experience_details'),
  new Field('review_photos'),
]
const featuredReviewsView = new View('Featured Reviews', [
  new Field('place_id'),
  new Field('name', { outputKey: 'place_name' }),
  new ExpandListField('featured_reviews', review_fields),
]);

const detailedReviewsView = new View('Detailed Reviews', [
  new Field('place_id'),
  new Field('name', { outputKey: 'place_name' }),
  new ExpandListField('detailed_reviews', review_fields),
]);

function competitorsToString(data: any): string {
  if (Array.isArray(data)) {
    const formattedStrings: string[] = [];

    for (const competitor of data) {
      const name = competitor.name || 'No Name';
      const link = competitor.link || 'No Link';
      const reviews = competitor.reviews || 'No Reviews';

      formattedStrings.push(
        `Name: ${name}\n` +
        `Link: ${link}\n` +
        `Reviews: ${reviews} reviews\n`
      );
    }

    return formattedStrings.join('\n').trim();
  } else {
    return data;
  }
}

function joinReviewKeywords(data: any, record: any): string {
  return data.map((kw: any) => kw.keyword).join(', ');
}

function joinClosedOn(data: any, record: any): string {
  if (Array.isArray(data)) {
    return data.join(', ');
  } else {
    return data;
  }
}

const joinWithCommas = (value: any[], record: any) => (value || []).join(', ');

function showIf(inputData: any): boolean {
  return !!inputData['api_key'];
}

const socialFields = [
  new Field('emails', { map: joinWithCommas, showIf: showIf }),
  new Field('phones', { map: joinWithCommas, showIf: showIf }),
  new Field('linkedin', { showIf: showIf }),
  new Field('twitter', { showIf: showIf }),
  new Field('facebook', { showIf: showIf }),
  new Field('youtube', { showIf: showIf }),
  new Field('instagram', { showIf: showIf }),
];

const overviewView = new View('Overview', [
  new Field('place_id'),
  new Field('name'),
  new Field('description'),
  new Field('is_spending_on_ads'),
  new Field('reviews'),
  new Field('rating'),
  new Field('competitors', { map: (value: any, record: any) => competitorsToString(value) }),
  new Field('website'),
  new Field('phone'),
  new Field('can_claim'),
  ...socialFields,
  new ExpandDictField('owner', [
    new Field('name', { outputKey: 'owner_name' }),
    new Field('link', { outputKey: 'owner_profile_link' }),
  ]),
  new Field('featured_image'),
  new Field('main_category'),
  new Field('categories', { map: joinWithCommas }),
  new Field('workday_timing'),
  new Field('is_temporarily_closed'),
  new Field('closed_on', { map: joinClosedOn }),
  new Field('address'),
  new Field('review_keywords', { map: joinReviewKeywords }),
  new Field('link'),
  new Field('query'),
]);

const bestCustomers = new sorts.Sort('Best Potential Customers', [
  new sorts.AlphabeticAscendingSort('name'),
  new sorts.NumericDescendingSort('reviews'),
  new sorts.TrueFirstSort('website'),
  new sorts.TruthyFirstSort('linkedin'),
  new sorts.TrueFirstSort('is_spending_on_ads'),
], {
  isDefault:true
});

const fls = [
  new filters.MinNumberInput('reviews', { label: 'Min Reviews' }),
  new filters.MaxNumberInput('reviews', { label: 'Max Reviews' }),
  new filters.BoolSelectDropdown('website', { prioritizeNo: true }),
  new filters.IsTruthyCheckbox('phone'),
  new filters.SearchTextInput('detailed_address.city',{label:"City"}),
  new filters.SearchTextInput('detailed_address.postal_code',{label:"Postal Code"}),
  new filters.IsTrueCheckbox('is_spending_on_ads'),
  new filters.BoolSelectDropdown('can_claim'),
  new filters.BoolSelectDropdown('is_temporarily_closed', { label: 'Is Open', invertFilter: true }),
  new filters.MultiSelectDropdown('categories', categoryOptions, { label: 'Category In', }),
  new filters.MinNumberInput('rating', { label: 'Min Rating' }),
];

const gmapsSorts = [
    bestCustomers,
    new sorts.NumericDescendingSort('reviews'),
    new sorts.NumericAscendingSort('reviews'),
    new sorts.NumericAscendingSort('name'),
]
const gmapsView = [
    overviewView,
    featuredReviewsView,
    detailedReviewsView,
]
Server.addScraper(
    googleMapsScraper,
    {
    createAllTask: true,
    splitTask: splitTaskByQuery,
    getTaskName: getTaskName,
    filters: fls,
    sorts: gmapsSorts,
    views: gmapsView,
    removeDuplicatesBy: 'place_id',
    isGoogleChromeRequired:true, 
  }
);
function processDomain(url: string): string {
  const strippedUrl = url.startsWith("www.") ? url.slice(4) : url;

  // Split the url by "."
  const parts = strippedUrl.split(".");

  // If there is only one "." in the url
  if (parts.length === 1) {
    return strippedUrl;
  } else if (parts.length === 2) {
    return parts[0];
  } else {
    // Remove the last TLD and join the remaining parts
    return parts.slice(0, -1).join(".");
  }
}

function getWebsiteContactsScraperTaskName(data: any): string {
  const websites = data["websites"];

  // Extract main domain info
  const domains = websites.map((url: string) => processDomain(extractDomainFromLink(url)));

  if (domains.length === 1) {
    return domains[0];
  } else if (domains.length <= 2) {
    const d1 = domains[0];
    const d2 = domains[1];
    return `${d1} and ${d2}`;
  } else {
    const d1 = domains[0];
    const d2 = domains[1];
    const n = domains.length - 2;
    return `${d1}, ${d2} and ${n} more`;
  }
}

const socialMediaFilters = [
  "emails", "phones", "linkedin", "twitter", "facebook",
  "youtube", "instagram", "github", "snapchat", "tiktok"
];


Server.addScraper(
  websiteContactsScraper,
  {
    getTaskName: getWebsiteContactsScraperTaskName,
    filters: [
      new filters.SearchTextInput("website"),
      ...socialMediaFilters.map(socialMedia => new filters.BoolSelectDropdown(socialMedia))
    ],
    sorts: [
      new sorts.AlphabeticAscendingSort("website"),
      new sorts.AlphabeticDescendingSort("website"),
    ],
  }
);

Server.setRateLimit({ google_maps_scraper:1, website_contacts_scraper: 1,});
Server.enableCache();
Server.configure({
  headerTitle: 'Made with Botasaurus',
  description: 'Find thousands of new customers personal phone, email and grow your business exponentially.',
  rightHeader: {
    text: 'Love It? Star It! ★',
    link: 'https://github.com/omkarcloud/google-maps-scraper',
  },
});

// Add Email support details
Server.addEmailSupport({
  email: 'happy.to.help@omkar.cloud', // Replace with your support email
  subject: `Help with ${config.productName} Tool`, // Default email subject
  body: `Hi, I need help with using the ${config.productName} Tool`, // Default email body
});

Server.addWhatsAppSupport({
  number: '8178804274', // Your 10-digit phone number (without the country code)
  countryCallingCode: '91', // Your country calling code (e.g., 81 for Japan, 1 for the US)
  message: `Hi, I need help with using the ${config.productName} Tool`, // Default message for WhatsApp
});