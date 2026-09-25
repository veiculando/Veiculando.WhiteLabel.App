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
  illuminated?: boolean;
}

export interface InventorySearch {
  query?: string;
  city?: string;
  mediaType?: string;
  minPrice?: number;
  maxPrice?: number;
  periodCode?: string;
}

export interface InventoryFilters {
  mediaTypes: string[];
  cities: Array<{ name: string; state: string }>;
  periods: Array<{ code: string; name: string; periodicity: string; startDate: string; endDate: string }>;
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
