/**
 * Brave Search MCP Integration — Agent Guard
 *
 * Provides a structured, MCP-style interface to Brave's Search API.
 * This is Agent Guard's first real-world MCP demo: the agent can call
 * `braveSearch` as a tool, bypassing browser navigation entirely for
 * information retrieval tasks.
 *
 * Security: every result is passed through the Guard content sanitizer
 * before being returned to the LLM, preventing search-result injection.
 *
 * API Docs: https://api.search.brave.com/app/documentation/web-search/get-started
 */

import { sanitizeForLLM } from '../security/content/sanitizer';
import { serializeToon } from '@src/background/agent/toon/parser';
import type { ToonFieldDef, ToonData } from '@src/background/agent/toon/types';
import { createLogger } from '@src/background/log';

const logger = createLogger('BraveSearchMCP');

const BRAVE_SEARCH_API = 'https://api.search.brave.com/res/v1/web/search';

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  /** ISO 8601 date if available */
  publishedDate?: string;
  /** Domain that published the result */
  domain: string;
}

export interface BraveSearchResponse {
  query: string;
  totalResults: number;
  results: BraveSearchResult[];
  /** Sanitized summary safe to inject into the LLM context */
  sanitizedSummary: string;
  /** Whether Guard sanitization modified any result content */
  wasModified: boolean;
}

export interface BraveSearchOptions {
  /** Maximum results to return (1–20, default 5) */
  count?: number;
  /** Safe search level: off | moderate | strict */
  safeSearch?: 'off' | 'moderate' | 'strict';
  /** Country code for localized results (e.g. 'US', 'IN') */
  country?: string;
  /** Search language (e.g. 'en') */
  searchLang?: string;
  /** Freshness filter: 'pd' (past day), 'pw' (past week), 'pm' (past month) */
  freshness?: 'pd' | 'pw' | 'pm';
}

/**
 * Execute a Brave Web Search and return Guard-sanitized results.
 * This is the primary MCP tool for real-time information retrieval.
 */
export async function braveWebSearch(
  apiKey: string,
  query: string,
  options: BraveSearchOptions = {},
): Promise<BraveSearchResponse> {
  if (!apiKey?.trim()) {
    throw new Error('Brave Search API key is required. Get one free at https://api.search.brave.com/');
  }

  if (!query?.trim()) {
    throw new Error('Search query cannot be empty.');
  }

  const { count = 5, safeSearch = 'moderate', country = 'US', searchLang = 'en', freshness } = options;

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(Math.max(count, 1), 20)),
    safesearch: safeSearch,
    country,
    search_lang: searchLang,
    result_filter: 'web',
    ...(freshness ? { freshness } : {}),
  });

  logger.info(`[BraveSearch] Searching: "${query}" (count=${count})`);

  let rawData: any;
  try {
    const response = await fetch(`${BRAVE_SEARCH_API}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Brave Search API error ${response.status}: ${errorText}`);
    }

    rawData = await response.json();
  } catch (error: any) {
    logger.error('[BraveSearch] API call failed:', error);
    throw new Error(`Brave Search failed: ${error?.message || 'Unknown network error'}`);
  }

  // Parse results
  const webResults: BraveSearchResult[] = (rawData?.web?.results || []).map((r: any) => {
    let domain = '';
    try {
      domain = new URL(r.url || '').hostname;
    } catch {
      domain = r.url || '';
    }
    return {
      title: r.title || '',
      url: r.url || '',
      description: r.description || '',
      publishedDate: r.age || undefined,
      domain,
    };
  });

  // Build raw text for sanitization
  const rawText = webResults.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description}`).join('\n\n');

  // Pass through Guard's content sanitizer to prevent search-result injection
  const sanitized = sanitizeForLLM(rawText);
  const wasModified = sanitized !== rawText;

  if (wasModified) {
    logger.warn('[BraveSearch] Guard sanitizer modified search results — potential injection attempt detected.');
  }

  logger.info(`[BraveSearch] Returned ${webResults.length} results. Modified by Guard: ${wasModified}`);

  return {
    query,
    totalResults: rawData?.query?.total_count || webResults.length,
    results: webResults,
    sanitizedSummary: sanitized,
    wasModified,
  };
}

/**
 * Format BraveSearchResponse as a TOON document for injection-safe LLM consumption.
 *
 * TOON's schema-pinned format means an adversarial search result cannot smuggle
 * a new @schema block or embedded newlines into the agent's context window —
 * the parser would reject them at read time if the agent ever echoes back the
 * block for re-parsing, and the structure itself signals to the LLM that the
 * content is data, not instructions.
 *
 * Layout: one top-level TOON block holds metadata + parallel list fields
 * (titles, urls, domains, descriptions) indexed by position.
 */
export function formatSearchResultsForLLM(response: BraveSearchResponse): string {
  const fields: ToonFieldDef[] = [
    { name: 'query', type: 'string', optional: false, description: 'Original search query' },
    { name: 'totalResults', type: 'int', optional: false, description: 'Total results available from API' },
    { name: 'count', type: 'int', optional: false, description: 'Number of results in this response' },
    { name: 'wasModified', type: 'bool', optional: false, description: 'True if Guard sanitizer altered any content' },
    { name: 'titles', type: 'list', listItemType: 'string', optional: false, description: 'Result titles (indexed)' },
    { name: 'urls', type: 'list', listItemType: 'string', optional: false, description: 'Result URLs (indexed)' },
    { name: 'domains', type: 'list', listItemType: 'string', optional: false, description: 'Source domains (indexed)' },
    {
      name: 'descriptions',
      type: 'list',
      listItemType: 'string',
      optional: false,
      description: 'Result descriptions (indexed)',
    },
  ];

  // Truncate each string field to stay within TOON's 4096-char default limit.
  // Descriptions are the most injection-prone field, so cap them tightly.
  const clamp = (s: string, max: number) => s.slice(0, max);

  const data: ToonData = {
    query: clamp(response.query, 256),
    totalResults: response.totalResults,
    count: response.results.length,
    wasModified: response.wasModified,
    titles: response.results.map(r => clamp(r.title, 200)),
    urls: response.results.map(r => clamp(r.url, 512)),
    domains: response.results.map(r => clamp(r.domain, 128)),
    descriptions: response.results.map(r => clamp(r.description, 400)),
  };

  return serializeToon(fields, data);
}

/**
 * MCP Tool descriptor for Brave Search.
 * Follows the Model Context Protocol tool schema.
 */
export const BRAVE_SEARCH_MCP_TOOL = {
  name: 'brave_web_search',
  description:
    'Search the web using Brave Search API. Returns real-time, privacy-focused search results without navigating the browser. Use this for research, fact-checking, or finding URLs to navigate to. Results are sanitized by Agent Guard before being returned.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query. Be specific for better results.',
      },
      count: {
        type: 'number',
        description: 'Number of results (1–10, default 5)',
        default: 5,
      },
      freshness: {
        type: 'string',
        enum: ['pd', 'pw', 'pm'],
        description: 'Optional time filter: pd=past day, pw=past week, pm=past month',
      },
    },
    required: ['query'],
  },
} as const;
