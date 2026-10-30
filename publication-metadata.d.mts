export interface FeedMetadataPolicy {
  includeCategories?: string[];
  excludeCategories?: string[];
  originalWritingOnly?: boolean;
  omitFeedAuthor?: boolean;
  titleFromBody?: string;
  titleFromTitle?: string;
  authorFromTitle?: string;
  authorFromBody?: string;
}
interface SourceMetadata { sourceType?: string; contentTypes: readonly string[]; defaultLanguage?: string; feedMetadata?: FeedMetadataPolicy; }
interface EntryMetadata { title?: string; link?: string; guid?: string; category?: string | string[]; author?: string; creator?: string; body?: string; encoded?: string; description?: string; language?: string; }
export function cleanPublicationText(value?: unknown): string;
export function canonicalPublicationUrl(value?: unknown): string;
export function classifyPublicationEntry(source: SourceMetadata, entry: EntryMetadata): [string, string, boolean?];
export function publicationEntryMetadata(source: SourceMetadata, entry: EntryMetadata): { title: string; authorDisplay: string; canonicalUrl: string; contentType: string; formTag: string; language: string; qualityFlags: string[] } | null;
