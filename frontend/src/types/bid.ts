/**
 * Bid Type Definitions
 */

export interface BidTitle {
  id: number;
  title: string;
  lecturer?: {
    id: number;
    name: string;
  };
}

export interface BidGroup {
  id: number;
  name: string;
}

export interface Bid {
  id: number;
  group_id: number;
  title_id: number;
  lecturer_recommendation?: 'ACCEPT' | 'REJECT' | 'PENDING' | null;
  status: string;
  priority?: number;
  created_at: string;
  updated_at: string;
  
  // Relations
  title?: BidTitle;
  group?: BidGroup;
}
