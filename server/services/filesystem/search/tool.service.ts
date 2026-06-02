/**
 * server/file-explorer/services/search/tool.service.ts
 *
 * Tool-facing service for agent sandbox search operations.
 * Tool → searchToolService → lib/search/{text-search,regex-search,file-search} (infra layer)
 */

import {
  searchText,
  formatTextSearchResults,
  type TextSearchOptions,
  type TextSearchResult,
} from '../../../tools/filesystem/lib/search/text-search.ts';

import {
  searchRegex,
  formatRegexResults,
  type RegexSearchOptions,
  type RegexSearchResult,
} from '../../../tools/filesystem/lib/search/regex-search.ts';

import {
  findByName,
  findByExtension,
  findByPattern,
  type FileSearchOptions,
  type FileSearchResult,
} from '../../../tools/filesystem/lib/search/file-search.ts';

export type {
  TextSearchOptions, TextSearchResult,
  RegexSearchOptions, RegexSearchResult,
  FileSearchOptions, FileSearchResult,
};

class SearchToolService {
  searchText(opts: TextSearchOptions): Promise<TextSearchResult[]>           { return searchText(opts); }
  formatText(results: TextSearchResult[]): string                             { return formatTextSearchResults(results); }
  searchRegex(opts: RegexSearchOptions): Promise<RegexSearchResult[]>        { return searchRegex(opts); }
  formatRegex(results: RegexSearchResult[]): string                          { return formatRegexResults(results); }
  findByName(opts: FileSearchOptions, name: string): Promise<FileSearchResult[]>      { return findByName(opts, name); }
  findByExtension(opts: FileSearchOptions, ext: string): Promise<FileSearchResult[]>  { return findByExtension(opts, ext); }
  findByPattern(opts: FileSearchOptions, pattern: RegExp): Promise<FileSearchResult[]>{ return findByPattern(opts, pattern); }
}

export const searchToolService = new SearchToolService();
