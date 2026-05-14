/**
 * Auth Type Definitions
 * Authentication, authorization, and user session types
 */

import type { User, UserRole } from './user';

/**
 * Auth context type
 */
export interface AuthContextType {
  user: User | null;
  activeRole: UserRole | null;
  login: (token: string, userData: User, roles: string[]) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  isLoading: boolean;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  token: string;
  user: User;
  roles: string[];
}

/**
 * Password reset request
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * Password update request
 */
export interface PasswordUpdateRequest {
  current_password: string;
  new_password: string;
  new_password_confirmation: string;
}

/**
 * Permission types
 */
export type Permission =
  | 'view_dashboard'
  | 'manage_users'
  | 'manage_groups'
  | 'manage_periods'
  | 'manage_titles'
  | 'manage_schedules'
  | 'evaluate_students'
  | 'submit_documents'
  | 'view_grades'
  | 'admin_access';

/**
 * Role permissions mapping
 */
export interface RolePermissions {
  mahasiswa: Permission[];
  dosen: Permission[];
  admin: Permission[];
}

/**
 * JWT token payload
 */
export interface TokenPayload {
  sub: number;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

/**
 * Session info
 */
export interface SessionInfo {
  user: User;
  activeRole: UserRole;
  expiresAt: number;
}

/**
 * Auth error
 */
export interface AuthError {
  message: string;
  code?: string;
}
