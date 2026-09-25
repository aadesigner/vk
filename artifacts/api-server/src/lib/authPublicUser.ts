export type AuthSessionUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  passwordHash: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  countryCode: string | null;
  phonePrefix: string | null;
  phoneNational: string | null;
  creditBalance: number;
  createdAt: Date;
};

export type OAuthUser = AuthSessionUser & {
  googleId: string | null;
  facebookId: string | null;
  linkedinId: string | null;
  authProvider: string;
};

export function toPublicUser(user: AuthSessionUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    isBanned: user.isBanned,
    hasPassword: !!user.passwordHash,
    countryCode: user.countryCode ?? null,
    phonePrefix: user.phonePrefix ?? null,
    phoneNational: user.phoneNational ?? null,
    creditBalance: user.creditBalance ?? 0,
    createdAt: user.createdAt,
  };
}
