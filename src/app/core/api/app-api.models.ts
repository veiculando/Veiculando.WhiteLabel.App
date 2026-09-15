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
}

export interface CheckoutQuote {
  quoteId: string;
  items: Array<InventoryPoint & { serverPrice: number }>;
  total: number;
  expiresAt: string;
  prototype?: boolean;
}

export interface OrderConfirmation {
  orderCode: string;
  total: number;
  createdAt: string;
  prototype?: boolean;
}
