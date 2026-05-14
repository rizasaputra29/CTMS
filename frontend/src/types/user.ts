/**
 * User Type Definitions
 * Base user types, students, lecturers, and supervisors
 */

import type { Period } from './period';

/**
 * Base user interface
 * Extended by Student and Lecturer
 */
export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  nim?: string;
  nip?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Student extends User with NIM
 */
export interface Student extends User {
  nim: string;
}

/**
 * Lecturer extends User with NIP
 */
export interface Lecturer extends User {
  nip?: string;
  expertise?: string[];
}

/**
 * Lecturer with workload information
 * Used in supervisor assignment and finalization
 */
export interface LecturerWithLoad extends User {
  current_load: number;
  max_load: number;
  remaining_capacity: number;
  is_overloaded: boolean;
}

/**
 * Supervisor with evaluation components status
 * Used in dashboard to show evaluation progress
 */
export interface SupervisorInEvaluation {
  id: number;
  name: string;
  status: 'pending' | 'completed' | 'in_progress';
  submitted_components: number;
  total_components: number;
}

/**
 * Basic supervisor info
 * Used in groups and schedules
 */
export interface SupervisorInfo {
  id: number;
  name: string;
  email?: string;
}

/**
 * User with their period information
 */
export interface UserWithPeriod extends User {
  period?: Period;
}

/**
 * User role types
 */
export type UserRole = 'mahasiswa' | 'dosen' | 'admin';

/**
 * User status
 */
export type UserStatus = 'active' | 'inactive' | 'suspended';
