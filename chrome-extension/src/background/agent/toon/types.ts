/**
 * Type definitions for TOON (Tree-of-Object-Notation) — Issue 1.2.
 *
 * TOON is a schema-pinned, injection-hostile serialization format for
 * agent-to-agent communication. Unlike JSON:
 *  - The schema is part of the wire format and is validated by the parser
 *  - Types are explicit — no implicit coercion ("true" ≠ true)
 *  - String values cannot contain embedded newlines or escape sequences
 *    beyond \\ and \" — this makes natural-language injection structurally invalid
 *  - Every document MUST begin with an @schema block before the @data block
 */

/** Supported field types in a TOON schema */
export type ToonFieldType = 'string' | 'int' | 'bool' | 'enum' | 'list';

/** A single field definition from the @schema block */
export interface ToonFieldDef {
  name: string;
  type: ToonFieldType;
  /** For enum fields: the allowed values */
  enumValues?: string[];
  /** For list fields: the type of each element */
  listItemType?: ToonFieldType;
  optional: boolean;
  description?: string;
}

/** Parsed @schema block */
export interface ToonSchema {
  fields: ToonFieldDef[];
}

/** Parsed @data block — a mapping from field name to typed value */
export type ToonData = Record<string, string | number | boolean | string[]>;

/** Fully parsed TOON document */
export interface ToonDocument {
  schema: ToonSchema;
  data: ToonData;
}

/** Discriminated result union returned by the parser */
export type ToonParseResult<T extends ToonData = ToonData> =
  | { ok: true; document: ToonDocument; data: T }
  | { ok: false; error: string; errorCode: ToonErrorCode };

export enum ToonErrorCode {
  MISSING_SCHEMA_BLOCK = 'MISSING_SCHEMA_BLOCK',
  MISSING_DATA_BLOCK = 'MISSING_DATA_BLOCK',
  MALFORMED_SCHEMA = 'MALFORMED_SCHEMA',
  MALFORMED_DATA = 'MALFORMED_DATA',
  UNDECLARED_FIELD = 'UNDECLARED_FIELD',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  INVALID_ENUM_VALUE = 'INVALID_ENUM_VALUE',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  STRING_INJECTION_DETECTED = 'STRING_INJECTION_DETECTED',
  MAX_LENGTH_EXCEEDED = 'MAX_LENGTH_EXCEEDED',
}

/** Per-field validation constraints */
export interface ToonConstraints {
  /** Maximum length for string values (default: 4096 chars) */
  maxStringLength?: number;
}

export const DEFAULT_CONSTRAINTS: ToonConstraints = {
  maxStringLength: 4096,
};
