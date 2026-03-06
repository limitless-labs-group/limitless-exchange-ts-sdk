import type { Market } from './market-class';

/**
 * Navigation node returned by /navigation endpoint.
 * @public
 */
export interface NavigationNode {
  id: string;
  name: string;
  slug: string;
  path: string;
  icon?: string;
  children: NavigationNode[];
}

/**
 * Filter group option for market pages.
 * @public
 */
export interface FilterGroupOption {
  label: string;
  value: string;
  metadata?: Record<string, unknown>;
}

/**
 * Filter group for market pages.
 * @public
 */
export interface FilterGroup {
  name?: string;
  slug?: string;
  allowMultiple?: boolean;
  presentation?: string;
  options?: FilterGroupOption[];
  source?: Record<string, unknown>;
}

/**
 * Breadcrumb item returned by /market-pages/by-path endpoint.
 * @public
 */
export interface BreadcrumbItem {
  name: string;
  slug: string;
  path: string;
}

/**
 * Market page data resolved by path.
 * @public
 */
export interface MarketPage {
  id: string;
  name: string;
  slug: string;
  fullPath: string;
  description: string | null;
  baseFilter: Record<string, unknown>;
  filterGroups: FilterGroup[];
  metadata: Record<string, unknown>;
  breadcrumb: BreadcrumbItem[];
}

/**
 * Property option returned by property-keys endpoints.
 * @public
 */
export interface PropertyOption {
  id: string;
  propertyKeyId: string;
  value: string;
  label: string;
  sortOrder: number;
  parentOptionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Property key returned by property-keys endpoints.
 * @public
 */
export interface PropertyKey {
  id: string;
  name: string;
  slug: string;
  type: 'select' | 'multi-select';
  metadata: Record<string, unknown>;
  isSystem: boolean;
  options?: PropertyOption[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Offset pagination metadata.
 * @public
 */
export interface OffsetPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Cursor pagination metadata.
 * @public
 */
export interface CursorPagination {
  nextCursor: string | null;
}

/**
 * Sort field for market-pages market listing.
 * @public
 */
export type MarketPageSortField = 'createdAt' | 'updatedAt' | 'deadline' | 'id';

/**
 * Sort value for market-pages market listing.
 * @public
 */
export type MarketPageSort = MarketPageSortField | `-${MarketPageSortField}`;

/**
 * Query params for /market-pages/:id/markets endpoint.
 * @public
 */
export type MarketPageFilterPrimitive = string | number | boolean;
export type MarketPageFilterValue = MarketPageFilterPrimitive | MarketPageFilterPrimitive[];

/**
 * Query params for /market-pages/:id/markets endpoint.
 * @public
 */
export interface MarketPageMarketsParams {
  page?: number;
  limit?: number;
  sort?: MarketPageSort;
  cursor?: string;
  filters?: Record<string, MarketPageFilterValue>;
}

/**
 * Offset response for /market-pages/:id/markets endpoint.
 * @public
 */
export interface MarketPageMarketsOffsetResponse {
  data: Market[];
  pagination: OffsetPagination;
}

/**
 * Cursor response for /market-pages/:id/markets endpoint.
 * @public
 */
export interface MarketPageMarketsCursorResponse {
  data: Market[];
  cursor: CursorPagination;
}

/**
 * Union response for /market-pages/:id/markets endpoint.
 * @public
 */
export type MarketPageMarketsResponse =
  | MarketPageMarketsOffsetResponse
  | MarketPageMarketsCursorResponse;
