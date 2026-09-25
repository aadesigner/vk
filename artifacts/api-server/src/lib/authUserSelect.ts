import { usersTable } from "@workspace/db";
export {
  toPublicUser,
  type AuthSessionUser,
  type OAuthUser,
} from "./authPublicUser.js";

/** Columns needed for session/auth responses — avoids optional schema columns (e.g. presence). */
export const authSessionUserSelect = {
  id: usersTable.id,
  email: usersTable.email,
  name: usersTable.name,
  avatarUrl: usersTable.avatarUrl,
  passwordHash: usersTable.passwordHash,
  isAdmin: usersTable.isAdmin,
  isBanned: usersTable.isBanned,
  countryCode: usersTable.countryCode,
  phonePrefix: usersTable.phonePrefix,
  phoneNational: usersTable.phoneNational,
  creditBalance: usersTable.creditBalance,
  createdAt: usersTable.createdAt,
} as const;

/** OAuth account linking reads — still excludes presence-only columns. */
export const oauthUserSelect = {
  ...authSessionUserSelect,
  googleId: usersTable.googleId,
  facebookId: usersTable.facebookId,
  linkedinId: usersTable.linkedinId,
  authProvider: usersTable.authProvider,
} as const;
