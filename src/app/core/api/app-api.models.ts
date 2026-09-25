export type AccountType = 'pf' | 'pj';
export type KycStatus = 'incomplete' | 'pending' | 'in_review' | 'adjustments_required' | 'approved' | 'rejected' | 'suspended';

export interface SessionResponse {
  token: string;
  expiresInMinutes: number;
  name: string;
  email: string;
  accountType?: AccountType;
  kycStatus: KycStatus;
}

export interface InventoryPoint {
  id: number;
  code: string;
  name: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  mediaType: string;
  format: string;
  price: number;
  available: boolean;
  imageUrl?: string;
  audience?: number;
  audienceMatch?: number;
  recommended?: boolean;
  illuminated?: boolean;
}

export interface InventorySearch {
  query?: string;
  city?: string;
  mediaType?: string;
  minPrice?: number;
  maxPrice?: number;
  periodCode?: string;
  gender?: number;
  ageRangeIds?: string;
  incomeRangeIds?: string;
  psychographicIds?: string;
  poiCategoryIds?: string;
  totalBudget?: number;
}

export interface InventoryFilters {
  mediaTypes: string[];
  cities: Array<{ name: string; state: string }>;
  periods: Array<{ code: string; name: string; periodicity: string; startDate: string; endDate: string }>;
  audience: {
    ageRanges: Array<{ id: number; name: string }>;
    incomeRanges: Array<{ id: number; name: string }>;
    psychographicProfiles: Array<{ id: number; name: string }>;
    poiCategories?: Array<{ id: number; name: string }>;
  };
}

export interface CheckoutQuote {
  quoteId: string;
  items: Array<Pick<InventoryPoint, 'id' | 'code'> & { serverPrice: number }>;
  total: number;
  expiresAt: string;
  prototype?: boolean;
}

export interface CheckoutPeriod {
  codigo: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
}

export interface CheckoutCampaign {
  id: number;
  code: string;
  name: string;
  periods: CheckoutPeriod[];
}

export interface CheckoutContext {
  campaigns: CheckoutCampaign[];
}

export interface OrderConfirmation {
  orderCode: string;
  orderCodes?: string[];
  total: number;
  createdAt: string;
  prototype?: boolean;
}
