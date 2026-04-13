/**
 * Period Type Definitions
 */

export interface Period {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  is_finalized?: boolean;
  
  // Bidding config
  bidding_start: string | null;
  bidding_end: string | null;
  bidding_reminder_at?: string | null;
  
  // PDC1 Phase
  pdc1_start: string | null;
  pdc1_end: string | null;
  pdc1_reminder_at?: string | null;
  
  // PDC2 Phase
  pdc2_start: string | null;
  pdc2_end: string | null;
  pdc2_reminder_at?: string | null;
  
  // Expo
  expo_date: string | null;
  expo_reminder_at?: string | null;
  
  // TA Defense
  ta_start: string | null;
  ta_end: string | null;
  ta_reminder_at?: string | null;
  
  // Group configuration
  min_group_size: number | null;
  max_group_size: number | null;
  max_supervisor_load: number | null;
  allow_solo?: boolean;
  require_all_students_grouped?: boolean;
}
