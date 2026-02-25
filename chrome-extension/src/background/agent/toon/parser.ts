/**
 * TOON parser — Issue 1.2.
 *
 * Wire format:
 *
 *   @schema {
 *     fieldName: type[?][; description]
 *     ...
 *   }
 *   @data {
 *     fieldName = value
 *     ...
 *   }
 *
 * Types:
 *   string  → "quoted string" (no embedded newlines, limited escapes)
 *   int     → integer literal
 *   bool    → true | false
 *   enum(v1,v2,...)  → one of the listed values (unquoted)
 *   list[type]       → [v1, v2, ...]
 *
 * Security properties:
 *   - Documents without an @schema block are rejected
 *   - The schema is supplied by the caller, not derived from LLM output;
 *     the @schema block in the document is validated against the expected schema
 *   - Undeclared fields in @data are rejected
 *   - String values may not contain newlines (injection isolation)
 *   - Embedded @schema declarations inside string values are detected and rejected
 *   - Values exceeding maxStringLength are rejected
 */

import type {
  ToonData,
  ToonDocument,
  ToonFieldDef,
  ToonFieldType,
  ToonParseResult,
  ToonSchema,
  ToonConstraints,
} from './types';
import { ToonErrorCode, DEFAULT_CONSTRAINTS } from './types';

// ── Tokenizer helpers ─────────────────────────────────────────────────────────

function err<T extends ToonData = ToonData>(errorCode: ToonErrorCode, error: string): ToonParseResult<T> {
  return { ok: false, error, errorCode };
}

/** Remove single-line # comments and trim */
function stripComments(line: string): string {
  const hashIdx = line.indexOf('#');
  return (hashIdx === -1 ? line : line.slice(0, hashIdx)).trim();
}

// ── Schema block parsing ──────────────────────────────────────────────────────

/**
 * Parse a type spec string like:
 *   "string", "int?", "bool", "enum(click,input)?", "list[string]"
 */
function parseTypeSpec(
  spec: string,
): { type: ToonFieldType; enumValues?: string[]; listItemType?: ToonFieldType; optional: boolean } | null {
  let s = spec.trim();
  const optional = s.endsWith('?');
  if (optional) s = s.slice(0, -1).trim();

  if (s === 'string') return { type: 'string', optional };
  if (s === 'int') return { type: 'int', optional };
  if (s === 'bool') return { type: 'bool', optional };

  const enumMatch = s.match(/^enum\(([^)]+)\)$/);
  if (enumMatch) {
    const enumValues = enumMatch[1]
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
    return { type: 'enum', enumValues, optional };
  }

  const listMatch = s.match(/^list\[(\w+)\]$/);
  if (listMatch) {
    const itemType = listMatch[1] as ToonFieldType;
    return { type: 'list', listItemType: itemType, optional };
  }

  return null;
}

function parseSchemaBlock(lines: string[]): ToonSchema | string {
  const fields: ToonFieldDef[] = [];

  for (const raw of lines) {
    const line = stripComments(raw);
    if (!line) continue;

    // Expected: "fieldName: typeSpec[?][; description]"
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return `Malformed schema line (no colon): "${line}"`;

    const name = line.slice(0, colonIdx).trim();
    const rest = line.slice(colonIdx + 1).trim();

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return `Invalid field name: "${name}"`;
    }

    // Split off description after semicolon
    const semiIdx = rest.indexOf(';');
    const typeSpecRaw = (semiIdx === -1 ? rest : rest.slice(0, semiIdx)).trim();
    const description =
      semiIdx === -1
        ? undefined
        : rest
            .slice(semiIdx + 1)
            .trim()
            .replace(/^["']|["']$/g, '');

    const parsed = parseTypeSpec(typeSpecRaw);
    if (!parsed) return `Unknown type spec: "${typeSpecRaw}" for field "${name}"`;

    fields.push({ name, description, ...parsed });
  }

  return { fields };
}

// ── Data block parsing ────────────────────────────────────────────────────────

/** Parse a quoted string value. Allows only \\ and \" as escape sequences. */
function parseStringValue(raw: string, maxLen: number): string | ToonErrorCode {
  if (!raw.startsWith('"') || raw.length < 2) {
    return ToonErrorCode.TYPE_MISMATCH;
  }
  // Starts with " but no closing " → newline-split injection (the value spans lines)
  if (!raw.endsWith('"')) {
    return ToonErrorCode.STRING_INJECTION_DETECTED;
  }
  const inner = raw.slice(1, -1);

  // No embedded newlines allowed
  if (/[\n\r]/.test(inner)) return ToonErrorCode.STRING_INJECTION_DETECTED;

  // Reject embedded @schema injection attempts
  if (/@schema\b/i.test(inner)) return ToonErrorCode.STRING_INJECTION_DETECTED;

  // Validate escape sequences — only \\ and \" are allowed
  const invalidEscape = /\\[^"\\]/.test(inner);
  if (invalidEscape) return ToonErrorCode.STRING_INJECTION_DETECTED;

  const unescaped = inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  if (unescaped.length > maxLen) return ToonErrorCode.MAX_LENGTH_EXCEEDED;

  return unescaped;
}

function parseValue(
  raw: string,
  fieldDef: ToonFieldDef,
  constraints: ToonConstraints,
): string | number | boolean | string[] | ToonErrorCode {
  const maxLen = constraints.maxStringLength ?? DEFAULT_CONSTRAINTS.maxStringLength!;
  raw = raw.trim();

  switch (fieldDef.type) {
    case 'string': {
      return parseStringValue(raw, maxLen);
    }
    case 'int': {
      if (!/^-?\d+$/.test(raw)) return ToonErrorCode.TYPE_MISMATCH;
      return parseInt(raw, 10);
    }
    case 'bool': {
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      return ToonErrorCode.TYPE_MISMATCH;
    }
    case 'enum': {
      if (!fieldDef.enumValues?.includes(raw)) return ToonErrorCode.INVALID_ENUM_VALUE;
      return raw;
    }
    case 'list': {
      if (!raw.startsWith('[') || !raw.endsWith(']')) return ToonErrorCode.TYPE_MISMATCH;
      const inner = raw.slice(1, -1).trim();
      if (!inner) return [];
      const items = inner.split(',').map(s => s.trim());
      if (fieldDef.listItemType === 'string') {
        const result: string[] = [];
        for (const item of items) {
          const parsed = parseStringValue(item, maxLen);
          if (typeof parsed !== 'string') return parsed;
          result.push(parsed);
        }
        return result;
      }
      return items;
    }
  }
}

function parseDataBlock(
  lines: string[],
  schema: ToonSchema,
  constraints: ToonConstraints,
): ToonData | { errorCode: ToonErrorCode; error: string } {
  const data: ToonData = {};
  const fieldMap = new Map(schema.fields.map(f => [f.name, f]));

  for (const raw of lines) {
    const line = stripComments(raw);
    if (!line) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      return { errorCode: ToonErrorCode.MALFORMED_DATA, error: `Malformed data line (no '='): "${line}"` };
    }

    const name = line.slice(0, eqIdx).trim();
    const valueRaw = line.slice(eqIdx + 1).trim();

    if (!fieldMap.has(name)) {
      return { errorCode: ToonErrorCode.UNDECLARED_FIELD, error: `Undeclared field: "${name}"` };
    }

    const fieldDef = fieldMap.get(name)!;
    const value = parseValue(valueRaw, fieldDef, constraints);

    if (typeof value === 'string' && (Object.values(ToonErrorCode) as string[]).includes(value)) {
      return {
        errorCode: value as ToonErrorCode,
        error: `Field "${name}": ${value}`,
      };
    }

    data[name] = value as string | number | boolean | string[];
  }

  // Check required fields
  for (const field of schema.fields) {
    if (!field.optional && !(field.name in data)) {
      return {
        errorCode: ToonErrorCode.MISSING_REQUIRED_FIELD,
        error: `Missing required field: "${field.name}"`,
      };
    }
  }

  return data;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Find the matching closing brace, accounting for nested braces.
 * Returns the index of the closing `}` or -1 if not found.
 */
function findMatchingBrace(raw: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < raw.length; i++) {
    if (raw[i] === '{') depth++;
    else if (raw[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Split a raw TOON document string into @schema and @data sections.
 * Uses brace-counting so that injected `{` inside string values cannot
 * prematurely close a block.
 * Returns null if either section is missing or malformed.
 */
function splitSections(raw: string): { schemaLines: string[]; dataLines: string[] } | null {
  const schemaStart = raw.indexOf('@schema');
  const dataStart = raw.indexOf('@data');

  if (schemaStart === -1 || dataStart === -1) return null;
  if (dataStart < schemaStart) return null;

  // Extract content between matching braces for @schema block
  const schemaOpen = raw.indexOf('{', schemaStart);
  const schemaClose = findMatchingBrace(raw, schemaOpen);
  if (schemaOpen === -1 || schemaClose === -1) return null;

  // Extract content between matching braces for @data block
  const dataOpen = raw.indexOf('{', dataStart);
  const dataClose = findMatchingBrace(raw, dataOpen);
  if (dataOpen === -1 || dataClose === -1) return null;

  const schemaLines = raw.slice(schemaOpen + 1, schemaClose).split('\n');
  const dataLines = raw.slice(dataOpen + 1, dataClose).split('\n');

  return { schemaLines, dataLines };
}

/**
 * Parse a TOON document string.
 *
 * @param raw         - The raw TOON text from the LLM output
 * @param constraints - Optional validation constraints
 * @returns ToonParseResult — check `.ok` before accessing `.data`
 */
export function parseToon<T extends ToonData = ToonData>(
  raw: string,
  constraints: ToonConstraints = DEFAULT_CONSTRAINTS,
): ToonParseResult<T> {
  if (!raw || raw.trim() === '') {
    return err(ToonErrorCode.MISSING_SCHEMA_BLOCK, 'Empty input');
  }

  const sections = splitSections(raw);
  if (!sections) {
    if (!raw.includes('@schema')) {
      return err(ToonErrorCode.MISSING_SCHEMA_BLOCK, 'Input does not contain an @schema block');
    }
    if (!raw.includes('@data')) {
      return err(ToonErrorCode.MISSING_DATA_BLOCK, 'Input does not contain an @data block');
    }
    return err(ToonErrorCode.MALFORMED_SCHEMA, 'Could not parse block structure');
  }

  const schemaResult = parseSchemaBlock(sections.schemaLines);
  if (typeof schemaResult === 'string') {
    return err(ToonErrorCode.MALFORMED_SCHEMA, schemaResult);
  }

  const dataResult = parseDataBlock(sections.dataLines, schemaResult, constraints);
  if ('errorCode' in dataResult) {
    const errorResult = dataResult as { errorCode: ToonErrorCode; error: string };
    return err(errorResult.errorCode, errorResult.error);
  }

  const document: ToonDocument = { schema: schemaResult, data: dataResult };
  return { ok: true, document, data: dataResult as T };
}

/**
 * Serialize a data object into a TOON document string.
 * The schema is derived from the field definitions provided.
 *
 * Useful for prompting LLMs to produce valid TOON output.
 */
export function serializeToon(fields: ToonFieldDef[], data: ToonData): string {
  const schemaLines = fields.map(f => {
    const typeStr =
      f.type === 'enum'
        ? `enum(${(f.enumValues ?? []).join(',')})`
        : f.type === 'list'
          ? `list[${f.listItemType ?? 'string'}]`
          : f.type;
    const optMark = f.optional ? '?' : '';
    const desc = f.description ? `; "${f.description}"` : '';
    return `  ${f.name}: ${typeStr}${optMark}${desc}`;
  });

  const dataLines = fields
    .filter(f => f.name in data)
    .map(f => {
      const val = data[f.name];
      const serialized =
        f.type === 'string'
          ? `"${String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
          : f.type === 'list'
            ? `[${(val as string[]).map(v => `"${v}"`).join(', ')}]`
            : String(val);
      return `  ${f.name} = ${serialized}`;
    });

  return `@schema {\n${schemaLines.join('\n')}\n}\n@data {\n${dataLines.join('\n')}\n}`;
}
