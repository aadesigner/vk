export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  hasPassword: boolean;
  countryCode?: string | null;
  phonePrefix?: string | null;
  phoneNational?: string | null;
  creditBalance?: number;
  createdAt?: string | Date | null;
}
