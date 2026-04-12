/**
 * XmlValidator - Validates XML DAT files
 *
 * @intent Validate XML well-formedness and extract game entries
 * @guarantee Uses chunked processing for large files
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import { XMLValidator, XMLParser } from 'fast-xml-parser';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface GameEntry {
  name: string;
  description?: string;
  [key: string]: unknown;
}

export interface ExtractResult {
  valid: boolean;
  games: GameEntry[];
  error?: string;
}

export function validateWellFormed(content: string): ValidationResult {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Empty XML content' };
  }

  const result = XMLValidator.validate(content, { allowBooleanAttributes: true });
  if (result === true) return { valid: true };

  return { valid: false, error: result.err.msg };
}

export async function validateFile(filePath: string): Promise<ValidationResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return validateWellFormed(content);
  } catch (err) {
    return { valid: false, error: `File read error: ${(err as Error).message}` };
  }
}

export function checkExtension(filePath: string): ValidationResult {
  const validExtensions = ['.dat', '.DAT', '.xml', '.XML'];
  const hasExtension = validExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  return hasExtension ? { valid: true } : { valid: false, error: 'File does not have .dat or .xml extension' };
}

export function extractGameEntries(content: string): ExtractResult {
  const validation = validateWellFormed(content);
  if (!validation.valid) return { valid: false, games: [], error: validation.error };

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true
    });

    const parsed = parser.parse(content);
    const games: GameEntry[] = [];

    // Try multiple formats
    if (parsed.datafile?.game) {
      extractDatafileGames(parsed.datafile.game, games);
    } else if (parsed.mame?.machine) {
      extractMameMachines(parsed.mame.machine, games);
    } else if (parsed.mame?.game) {
      extractMameMachines(parsed.mame.game, games);
    } else if (parsed.softwarelist?.software) {
      extractSoftwareList(parsed.softwarelist.software, games, parsed.softwarelist['@_name']);
    } else if (parsed.mame) {
      // MAME root - try to find games/machines at any level
      extractAllMameEntries(parsed.mame, games);
    } else if (parsed.datafile) {
      // Generic datafile - try anything inside
      extractGenericDatafile(parsed.datafile, games);
    } else {
      // Last resort: extract from parsed object directly
      extractDirectEntries(parsed, games);
    }

    return { valid: true, games };
  } catch (err) {
    return { valid: false, games: [], error: `Parse error: ${(err as Error).message}` };
  }
}

/**
 * Process XML file with chunked reading
 * Memory efficient: reads in chunks and processes entries
 */
export async function processXmlFile(
  filePath: string,
  sourceType: string,
  onEntry: (entry: GameEntry) => void
): Promise<number> {
  if (!fsSync.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

  const stats = fsSync.statSync(filePath);
  console.log(`[validator] Processing ${filePath} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);

  const stream = fsSync.createReadStream(filePath, { highWaterMark: 1024 * 1024, encoding: 'utf-8' });
  return processStream(stream, sourceType, onEntry);
}

/**
 * Process XML from URL - streaming with chunked processing
 */
export async function processXmlFromUrl(
  url: string,
  sourceType: string,
  onEntry: (entry: GameEntry) => void
): Promise<number> {
  console.log(`[validator] Fetching XML from: ${url}`);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const len = res.headers.get('content-length');
  if (len) console.log(`[validator] Content-Length: ${(parseInt(len) / 1024 / 1024).toFixed(1)} MB`);
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let count = 0;
  let softwarelistName = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    
    // Extract softwarelist name if present
    if (!softwarelistName) {
      const listMatch = buffer.match(/<softwarelist[^>]*name=["']([^"']+)["']/);
      if (listMatch) softwarelistName = listMatch[1];
    }

    const result = processBuffer(buffer, sourceType, softwarelistName, onEntry);
    buffer = result.remaining;
    count += result.count;
  }

  // Final cleanup
  const finalResult = processBuffer(buffer, sourceType, softwarelistName, onEntry, true);
  count += finalResult.count;

  console.log(`[validator] Processed ${count} entries from ${sourceType}`);
  return count;
}

async function processStream(stream: fsSync.ReadStream, sourceType: string, onEntry: (entry: GameEntry) => void): Promise<number> {
  let buffer = '';
  let count = 0;
  let softwarelistName = '';

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: string | Buffer) => {
      const textChunk = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      buffer += textChunk;
      
      if (!softwarelistName) {
        const listMatch = buffer.match(/<softwarelist[^>]*name=["']([^"']+)["']/);
        if (listMatch) softwarelistName = listMatch[1];
      }

      const result = processBuffer(buffer, sourceType, softwarelistName, onEntry);
      buffer = result.remaining;
      count += result.count;
    });

    stream.on('end', () => {
      const finalResult = processBuffer(buffer, sourceType, softwarelistName, onEntry, true);
      count += finalResult.count;
      console.log(`[validator] Processed ${count} entries from ${sourceType}`);
      resolve(count);
    });

    stream.on('error', reject);
  });
}

function processBuffer(buffer: string, sourceType: string, softwarelistName: string, onEntry: (entry: GameEntry) => void, isFinal = false): { remaining: string, count: number } {
  let count = 0;
  let currentPos = 0;

  while (true) {
    // Find the next start tag
    const machineStart = buffer.indexOf('<machine', currentPos);
    const softwareStart = buffer.indexOf('<software', currentPos);
    const gameStart = buffer.indexOf('<game', currentPos);

    let startIdx = -1;
    let tagType = '';
    
    if (machineStart !== -1 && (softwareStart === -1 || machineStart < softwareStart) && (gameStart === -1 || machineStart < gameStart)) {
      startIdx = machineStart; tagType = 'machine';
    } else if (softwareStart !== -1 && (gameStart === -1 || softwareStart < gameStart)) {
      startIdx = softwareStart; tagType = 'software';
    } else if (gameStart !== -1) {
      startIdx = gameStart; tagType = 'game';
    }

    if (startIdx === -1) break;

    // Find the matching end tag
    const endTag = `</${tagType}>`;
    const endIdx = buffer.indexOf(endTag, startIdx);

    if (endIdx === -1) {
      // If not final and tag is incomplete, stop and keep in buffer
      if (!isFinal) break;
      // If final, try to find the end of the opening tag if it's a self-closing one
      const openEndIdx = buffer.indexOf('>', startIdx);
      if (openEndIdx !== -1 && buffer[openEndIdx - 1] === '/') {
        const entryXml = buffer.slice(startIdx, openEndIdx + 1);
        const entry = parseXmlEntry(entryXml, tagType, sourceType, softwarelistName);
        if (entry) { count++; onEntry(entry); }
        currentPos = openEndIdx + 1;
        continue;
      }
      break;
    }

    const entryXml = buffer.slice(startIdx, endIdx + endTag.length);
    const entry = parseXmlEntry(entryXml, tagType, sourceType, softwarelistName);
    if (entry) { count++; onEntry(entry); }
    currentPos = endIdx + endTag.length;
  }

  return { remaining: buffer.slice(currentPos), count };
}

function parseXmlEntry(xml: string, tagType: string, sourceType: string, softwarelistName: string): GameEntry | null {
  try {
    const parser = new XMLParser({ 
      ignoreAttributes: false, 
      attributeNamePrefix: '@_', 
      parseAttributeValue: false, 
      parseTagValue: false,
      trimValues: true 
    });
    const parsed = parser.parse(xml);

    let data: any;
    if (tagType === 'machine') data = parsed.machine;
    else if (tagType === 'software') data = parsed.software;
    else if (tagType === 'game') data = parsed.game;

    if (!data) return null;

    const entry: GameEntry = {
      name: data['@_name'] || data.name,
      description: data.description,
      source: sourceType,
      ...data
    };

    if (tagType === 'machine') {
      entry.year = data.year;
      entry.manufacturer = data.manufacturer;
    } else if (tagType === 'software') {
      entry.year = data.year;
      entry.publisher = data.publisher;
      if (softwarelistName) entry.softwarelist = softwarelistName;
    }

    return entry;
  } catch { return null; }
}

function extractDatafileGames(data: unknown, games: GameEntry[]): void {
  const arr = Array.isArray(data) ? data : [data];
  for (const g of arr) if (g && typeof g === 'object') games.push({ name: g['@_name'] || (g as any).name, description: (g as any).description, ...(g as Record<string, unknown>) });
}

function extractMameMachines(data: unknown, games: GameEntry[]): void {
  const arr = Array.isArray(data) ? data : [data];
  for (const m of arr) if (m && typeof m === 'object') {
    const n = m['@_name'] || (m as any).name;
    if (n) games.push({ name: n, description: (m as any).description, year: (m as any).year, manufacturer: (m as any).manufacturer, ...(m as Record<string, unknown>) });
  }
}

function extractSoftwareList(data: unknown, games: GameEntry[], listName?: string): void {
  const arr = Array.isArray(data) ? data : [data];
  for (const s of arr) if (s && typeof s === 'object') {
    const n = s['@_name'] || (s as any).name;
    if (n) games.push({ name: n, description: (s as any).description, year: (s as any).year, publisher: (s as any).publisher, softwarelist: listName, ...(s as Record<string, unknown>) });
  }
}

/**
 * Recursively extract all entries from MAME XML
 */
function extractAllMameEntries(obj: unknown, games: GameEntry[]): void {
  if (!obj || typeof obj !== 'object') return;
  const o = obj as Record<string, unknown>;
  
  // Check for machine/game at this level
  if (o.machine) extractMameMachines(o.machine as unknown, games);
  else if (o.game) extractMameMachines(o.game as unknown, games);
  else if (o.machines) extractAllMameEntries(o.machines, games);
  else if (o.games) extractAllMameEntries(o.games, games);
  
  // Recurse into children
  for (const [key, value] of Object.entries(o)) {
    if (value && typeof value === 'object' && key !== 'machine' && key !== 'game' && key !== 'machines' && key !== 'games') {
      extractAllMameEntries(value, games);
    }
  }
}

/**
 * Generic datafile extraction
 */
function extractGenericDatafile(datafile: unknown, games: GameEntry[]): void {
  if (!datafile || typeof datafile !== 'object') return;
  const d = datafile as Record<string, unknown>;
  
  // Try common container names
  const containers = ['game', 'machine', 'software', 'entry', 'item', 'record'];
  for (const key of Object.keys(d)) {
    if (containers.includes(key.toLowerCase())) {
      const data = d[key];
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item && typeof item === 'object') {
            const entry = item as Record<string, unknown>;
            const name = entry['@_name'] || entry.name || entry['@name'];
            if (name) games.push({ name: String(name), description: String(entry.description || ''), ...entry });
          }
        }
      } else if (data && typeof data === 'object') {
        const entry = data as Record<string, unknown>;
        const name = entry['@_name'] || entry.name || entry['@name'];
        if (name) games.push({ name: String(name), description: String(entry.description || ''), ...entry });
      }
    }
  }
}

/**
 * Last resort: extract entries directly from parsed object
 */
function extractDirectEntries(obj: unknown, games: GameEntry[]): void {
  if (!obj || typeof obj !== 'object') return;
  const o = obj as Record<string, unknown>;
  
  // Look for arrays of objects with name-like properties
  for (const [key, value] of Object.entries(o)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const entry = item as Record<string, unknown>;
          const name = entry['@_name'] || entry.name || entry['@name'] || entry.id;
          if (name) {
            games.push({
              name: String(name),
              description: String(entry.description || entry.title || ''),
              source: 'mame',
              ...entry
            });
          }
        }
      }
    } else if (value && typeof value === 'object') {
      // Single object
      const entry = value as Record<string, unknown>;
      const name = entry['@_name'] || entry.name || entry['@name'] || entry.id;
      if (name) {
        games.push({
          name: String(name),
          description: String(entry.description || entry.title || ''),
          source: 'mame',
          ...entry
        });
      }
    }
  }
}

export class XmlValidator {
  static validate(content: string): ValidationResult {
    return validateWellFormed(content);
  }

  static async validateFilePath(filePath: string): Promise<ValidationResult> {
    return validateFile(filePath);
  }

  static extract(content: string): ExtractResult {
    return extractGameEntries(content);
  }

  static async processFile(filePath: string, sourceType: string, onEntry: (entry: GameEntry) => void): Promise<number> {
    return processXmlFile(filePath, sourceType, onEntry);
  }

  static async processUrl(url: string, sourceType: string, onEntry: (entry: GameEntry) => void): Promise<number> {
    return processXmlFromUrl(url, sourceType, onEntry);
  }
}
