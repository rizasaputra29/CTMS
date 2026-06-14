export interface Period {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  bidding_start: string | null;
  bidding_end: string | null;
  bidding_reminder_at?: string | null;
  pdc1_start: string | null;
  pdc1_end: string | null;
  pdc1_reminder_at?: string | null;
  pdc2_start: string | null;
  pdc2_end: string | null;
  pdc2_reminder_at?: string | null;
  expo_date: string | null;
  expo_reminder_at?: string | null;
  ta_start: string | null;
  ta_end: string | null;
  ta_reminder_at?: string | null;
  min_group_size: number | null;
  max_group_size: number | null;
  max_supervisor_load: number | null;
}
