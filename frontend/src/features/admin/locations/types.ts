export interface Location {
  id: number;
  name: string;
  capacity: number | null;
  type: "offline" | "online";
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
