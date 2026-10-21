import type { ImportFormat } from './cards';

export type ImportRow = { front: string; back?: string; tags?: string[] };

export type ParsedImport = {
   rows: ImportRow[];
   errors: Array<{ row: number; message: string }>;
};

/** Column delimiters a user may pick for CSV content. */
export const COLUMN_DELIMITERS = [',', ';', '\t', '|'] as const;
export type ColumnDelimiter = (typeof COLUMN_DELIMITERS)[number];

/** Delimiter choices including `auto` (infer from the content). */
export const DELIMITER_CHOICES = ['auto', ...COLUMN_DELIMITERS] as const;
export type DelimiterChoice = (typeof DELIMITER_CHOICES)[number];

/** How the tags column is split into individual tags. `none` keeps the field whole. */
export const TAG_SEPARATORS = [',', ';', '|', ' ', 'none'] as const;
export type TagSeparator = (typeof TAG_SEPARATORS)[number];

export type ImportParseOptions = {
   delimiter?: DelimiterChoice;
   tagSeparator?: TagSeparator;
};

/** Thrown when import content cannot be parsed at all (e.g. invalid JSON). */
export class ImportParseError extends Error {
   constructor(message: string) {
      super(message);
      this.name = 'ImportParseError';
   }
}

/** Rows beyond this are skipped to bound import cost. */
export const MAX_IMPORT_ROWS = 2000;

function splitDelimitedLine(line: string, delimiter: string): string[] {
   const fields: string[] = [];
   let current = '';
   let inQuotes = false;
   for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
         if (char === '"') {
            if (line[i + 1] === '"') {
               current += '"';
               i++;
            } else {
               inQuotes = false;
            }
         } else {
            current += char;
         }
      } else if (char === '"') {
         inQuotes = true;
      } else if (char === delimiter) {
         fields.push(current);
         current = '';
      } else {
         current += char;
      }
   }
   fields.push(current);
   return fields.map((field) => field.trim());
}

/** Pick the delimiter that yields the most columns on the first non-empty line. */
function detectDelimiter(content: string): ColumnDelimiter {
   const line = content.split(/\r?\n/).find((value) => value.trim().length > 0) ?? '';
   let best: ColumnDelimiter = ',';
   let bestCount = 0;
   for (const candidate of COLUMN_DELIMITERS) {
      const count = line.split(candidate).length - 1;
      if (count > bestCount) {
         best = candidate;
         bestCount = count;
      }
   }
   return best;
}

function splitTags(field: string, separator: TagSeparator): string[] {
   const trimmed = field.trim();
   if (!trimmed) return [];
   if (separator === 'none') return [trimmed];
   return trimmed
      .split(separator)
      .map((tag) => tag.trim())
      .filter(Boolean);
}

function parseDelimited(
   content: string,
   delimiter: string,
   hasHeader: boolean,
   tagSeparator: TagSeparator,
): ParsedImport {
   const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
   const rows: ImportRow[] = [];
   const errors: ParsedImport['errors'] = [];
   const start = hasHeader ? 1 : 0;

   for (let index = start; index < lines.length; index++) {
      const fields = splitDelimitedLine(lines[index], delimiter);
      const front = fields[0];
      if (!front) {
         errors.push({ row: index + 1, message: 'Missing front field' });
         continue;
      }
      rows.push({
         front,
         back: fields[1] || undefined,
         tags: splitTags(fields[2] ?? '', tagSeparator),
      });
   }
   return { rows, errors };
}

function parseJson(content: string): ParsedImport {
   let data: unknown;
   try {
      data = JSON.parse(content);
   } catch {
      throw new ImportParseError('Import content is not valid JSON');
   }
   if (!Array.isArray(data)) {
      throw new ImportParseError('JSON import must be an array of cards');
   }
   const rows: ImportRow[] = [];
   const errors: ParsedImport['errors'] = [];
   data.forEach((item, index) => {
      const record = item as Record<string, unknown>;
      const front = typeof record.front === 'string' ? record.front : undefined;
      if (!front) {
         errors.push({ row: index + 1, message: 'Missing front field' });
         return;
      }
      rows.push({
         front,
         back: typeof record.back === 'string' ? record.back : undefined,
         tags: Array.isArray(record.tags) ? (record.tags as string[]).slice(0, 20) : [],
      });
   });
   return { rows, errors };
}

/** Parse CSV/TSV/JSON import content into rows (shared by API and webapp). */
export function parseImportContent(
   format: ImportFormat,
   content: string,
   hasHeader: boolean,
   options: ImportParseOptions = {},
): ParsedImport {
   if (format === 'json') return parseJson(content);
   const tagSeparator = options.tagSeparator ?? ';';
   let delimiter: string;
   if (format === 'tsv') {
      delimiter = '\t';
   } else if (options.delimiter === 'auto') {
      delimiter = detectDelimiter(content);
   } else {
      delimiter = options.delimiter ?? ',';
   }
   return parseDelimited(content, delimiter, hasHeader, tagSeparator);
}
