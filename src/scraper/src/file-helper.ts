import * as fs from 'fs';
import * as path from 'path';

/**
 * Gets the absolute path to the file in the project
 * @param filePath Relative file path from project root
 */
export function getFilePath(filePath: string): string | null {
  // Try multiple project root paths
  const possibleRoots = [
    // Current working directory
    process.cwd(),
    // Up one level (if in src or dist)
    path.join(process.cwd(), '..'),
    // From __dirname
    path.join(__dirname, '../../..'),
    // From module's directory
    path.dirname(require.main?.filename || ''),
  ];

  for (const root of possibleRoots) {
    const fullPath = path.join(root, filePath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Reads a file safely and returns its contents
 * @param filePath Path to the file
 * @param encoding File encoding
 */
export function readFileSync(filePath: string, encoding: BufferEncoding = 'utf8'): string | null {
  const absolutePath = getFilePath(filePath);
  
  if (!absolutePath) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  
  try {
    return fs.readFileSync(absolutePath, encoding);
  } catch (error) {
    console.error(`Error reading file ${absolutePath}:`, error);
    return null;
  }
}

/**
 * Read the category file and return its contents as an array of lines
 */
export function readCategoryFile(): string[] {
  // Try with standard name first
  const fileContent = readFileSync('inputs/googlemaps_category.csv');
  
  if (fileContent) {
    const lines = fileContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line.length > 0);
    
    console.log(`Successfully loaded ${lines.length} categories from CSV file`);
    return lines;
  }
  
  // If file not found or empty, return default categories
  console.error('Could not load category file, using default categories');
  return [
    'Restaurant', 'Hotel', 'Bank', 'Hospital', 'School', 
    'Café', 'Supermarket', 'Pharmacy', 'Gas Station', 'Park'
  ];
} 