export interface Role {
  id: number;
  name: string;
  slug: string;
}

export interface RegisteredPeriod {
  id: number;
  name: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  nim?: string;
  nip?: string;
  is_active: boolean;
  role: string;
  roles: Role[];
  registered_periods?: RegisteredPeriod[];
  created_at: string;
}

export type SortKey = "name" | "email" | "created_at";
export type SortDir = "asc" | "desc";
export type StatusFilter = "all" | "active" | "inactive";

export interface PaginationData {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
