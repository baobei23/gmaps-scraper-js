import * as fs from 'fs';
import * as path from 'path';

/**
 * Reads categories from the CSV file
 */
export function readCategoriesFromCSV(): string[] {
  try {
    // Try multiple potential locations for the CSV file
    const possiblePaths = [
      path.join(__dirname, '../../../inputs/googlemaps_category.csv'),
      path.join(__dirname, '../../inputs/googlemaps_category.csv'),
      path.join(__dirname, '../inputs/googlemaps_category.csv'),
      path.join(process.cwd(), 'inputs/googlemaps_category.csv'),
      './inputs/googlemaps_category.csv'
    ];
    
    let fileContent = '';
    let usedPath = '';
    
    // Try each path until we find the file
    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          fileContent = fs.readFileSync(filePath, 'utf8');
          usedPath = filePath;
          console.log(`Found categories file at: ${filePath}`);
          break;
        }
      } catch (err) {
        // Continue to next path
      }
    }
    
    if (!fileContent) {
      console.error('Could not find googlemaps_category.csv in any of the expected locations');
      // Return some default categories as fallback
      return [
        'Restaurant', 'Hotel', 'Bank', 'Hospital', 'School', 
        'Café', 'Supermarket', 'Pharmacy', 'Gas Station', 'Park'
      ];
    }
    
    const lines = fileContent.split('\n');
    const categories = lines
      .map(line => line.trim())
      .filter(line => line && line.length > 0); // Filter out empty lines
      
    console.log(`Successfully loaded ${categories.length} categories from ${usedPath}`);
    return categories;
    
  } catch (error) {
    console.error('Error reading categories file:', error);
    // Return some default categories as fallback
    return [
      'Restaurant', 'Hotel', 'Bank', 'Hospital', 'School', 
      'Café', 'Supermarket', 'Pharmacy', 'Gas Station', 'Park'
    ];
  }
}

/**
 * Randomizes an array of strings
 */
export function randomizeStrings(stringList: string[]): string[] {
  const randomizedList = [...stringList];
  shuffle(randomizedList);
  return randomizedList;
}

/**
 * Shuffles array in place
 */
export function shuffle(array: any[]): void {
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

/**
 * Converts bulk text queries to an array of queries
 */
export function processBulkQueries(bulkText: string): string[] {
  if (!bulkText || bulkText.trim() === '') return [];
  
  return bulkText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && line.length > 0);
}

/**
 * Generates queries combining categories with a location
 */
export function generateCategoryQueries(location: string, maxCategories: number, randomize: boolean): string[] {
  console.log(`Generating category queries for location: ${location}, max: ${maxCategories}, randomize: ${randomize}`);
  const categories = readCategoriesFromCSV();
  
  if (categories.length === 0) {
    console.error("No categories were loaded, cannot generate queries");
    return [];
  }
  
  let selectedCategories = categories;
  
  if (randomize) {
    selectedCategories = randomizeStrings(categories);
  }
  
  // Limit the number of categories if requested
  if (maxCategories && maxCategories > 0 && maxCategories < selectedCategories.length) {
    selectedCategories = selectedCategories.slice(0, maxCategories);
  }
  
  // Combine categories with location
  const queries = selectedCategories.map(category => `${category} ${location}`);
  console.log(`Generated ${queries.length} queries. Example: "${queries[0]}"`);
  return queries;
}

/**
 * Process input data to create the final queries array
 */
export function processInputData(data: any): string[] {
  console.log("Processing input data:", JSON.stringify({
    use_categories: data.use_categories,
    location: data.location,
    bulk_queries_length: data.bulk_queries ? data.bulk_queries.length : 0,
    queries_length: Array.isArray(data.queries) ? data.queries.length : 0
  }));
  
  // Check if using category-based search
  if (data.use_categories && data.location) {
    const queries = generateCategoryQueries(
      data.location, 
      data.max_categories || 10, 
      data.randomize_categories !== false
    );
    
    if (queries.length === 0) {
      console.error("No queries generated from categories! Falling back to default query.");
      return ["Hotel in " + data.location];
    }
    
    return queries;
  }
  
  // Check if using bulk queries
  if (data.bulk_queries && data.bulk_queries.trim() !== '') {
    return processBulkQueries(data.bulk_queries);
  }
  
  // Otherwise use the regular queries list
  return Array.isArray(data.queries) ? data.queries : [];
}

/**
 * Clean up a search string
 */
export function cleanSearchString(s: string): string {
  if (typeof s === 'string') {
    return s.trim().toLowerCase().replace(/\s+/g, ' ');
  }
  return s;
}

/**
 * Prepare data for task execution by processing all inputs
 */
export function prepareTaskData(data: any): any {
  console.log("Preparing task data from:", JSON.stringify({
    use_categories: data.use_categories,
    location: data.location,
    max_categories: data.max_categories
  }));
  
  // Process input data to get final queries list
  const processedQueries = processInputData(data);
  console.log(`Generated ${processedQueries.length} queries after processing`);
  
  if (processedQueries.length === 0) {
    console.error("No queries were generated! Check your inputs.");
  }
  
  // Remove the processed fields that shouldn't be passed to tasks
  const cleanedData = { ...data };
  delete cleanedData.bulk_queries;
  delete cleanedData.use_categories;
  delete cleanedData.location;
  delete cleanedData.max_categories;
  delete cleanedData.randomize_categories;
  
  // Add the processed queries to the data
  cleanedData.queries = processedQueries;
  
  return cleanedData;
} 