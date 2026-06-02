/**
 * server/file-explorer/services/search.service.ts
 *
 * Service layer for all search operations on the agent sandbox.
 * Tool → SearchService → lib/search/{text-search,regex-search,file-search} (repository/infra layer)
 *
 * No tool may import those lib files directly.
 */

import {
  searchText,
  formatTextSearchResults,
  type TextSearchOptions,
  type TextSearchResult,
} from '../../tools/filesystem/lib/search/text-search.ts';

import {
  searchRegex,
  formatRegexResults,
  type RegexSearchOptions,
  type RegexSearchResult,
} from '../../tools/filesystem/lib/search/regex-search.ts';

import {
  findByName,
  findByExtension,
  findByPattern,
  type FileSearchOptions,
  type FileSearchResult,
} from '../../tools/filesystem/lib/search/file-search.ts';

export type {
  TextSearchOptions,
  TextSearchResult,
  RegexSearchOptions,
  RegexSearchResult,
  FileSearchOptions,
  FileSearchResult,
};

class SearchService {
  searchText(opts: TextSearchOptions): Promise<TextSearchResult[]> {
    return searchText(opts);
  }

  formatText(results: TextSearchResult[]): string {
    return formatTextSearchResults(results);
  }

  searchRegex(opts: RegexSearchOptions): Promise<RegexSearchResult[]> {
    return searchRegex(opts);
  }

  formatRegex(results: RegexSearchResult[]): string {
    return formatRegexResults(results);
  }

  findByName(opts: FileSearchOptions, name: string): Promise<FileSearchResult[]> {
    return findByName(opts, name);
  }

  findByExtension(opts: FileSearchOptions, ext: string): Promise<FileSearchResult[]> {
    return findByExtension(opts, ext);
  }

  findByPattern(opts: FileSearchOptions, pattern: RegExp): Promise<FileSearchResult[]> {
    return findByPattern(opts, pattern);
  }
}

export const searchToolService = new SearchService();
