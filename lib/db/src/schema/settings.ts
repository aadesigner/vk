import { pgTable, serial, text, real, boolean, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const pricingTable = pgTable("pricing", {
  id: serial("id").primaryKey(),
  basePrice: real("base_price").notNull().default(29.99),
  discountPrice: real("discount_price").notNull().default(19.99),
  currency: text("currency").notNull().default("EUR"),
  discountEnabled: boolean("discount_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * `vinready` is the combined "report ready + payment confirmation" email.
 * `confirm` is retained only so previously stored overrides stay readable; it is
 * no longer rendered or editable.
 */
export type EmailTemplateKey = "welcome" | "vinready" | "reset" | "abandoned" | "noinfo" | "noinforefund";
export type LegacyEmailTemplateKey = "confirm";
export type EmailTemplateOverride = { subject?: string; contentHtml?: string };
export type EmailTemplatesConfig =
  Partial<Record<EmailTemplateKey | LegacyEmailTemplateKey, EmailTemplateOverride>>;

export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  rateLimit: integer("rate_limit").notNull().default(10),
  rateLimitWindow: integer("rate_limit_window").notNull().default(60),
  maxVinsPerDay: integer("max_vins_per_day").notNull().default(50),
  abuseDetectionEnabled: boolean("abuse_detection_enabled").notNull().default(true),
  recaptchaEnabled: boolean("recaptcha_enabled").notNull().default(false),
  recaptchaSiteKey: text("recaptcha_site_key"),
  recaptchaSecretKey: text("recaptcha_secret_key"),
  recaptchaMinScore: real("recaptcha_min_score").notNull().default(0.5),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  /** When false, blocks new paid VIN lookups and checkout (admins exempt). */
  vinLookupEnabled: boolean("vin_lookup_enabled").notNull().default(true),
  /**
   * When false, skip GetCarAPI check + retrieve entirely.
   * Cascade becomes catalog → Carstat → pending (same as no API key).
   */
  getcarApiEnabled: boolean("getcar_api_enabled").notNull().default(true),
  /** Partial blocks when maintenanceMode is false: free_decoder | checkout | vin_reports */
  maintenanceRestrictions: jsonb("maintenance_restrictions").$type<string[]>().notNull().default([]),
  maintenanceMessage: text("maintenance_message"),
  /** Official / third-party plugin configuration (geo redirect, etc.) */
  pluginSettings: jsonb("plugin_settings").$type<Record<string, unknown>>(),
  paypalClientId: text("paypal_client_id"),
  paypalClientSecret: text("paypal_client_secret"),
  paypalSandbox: boolean("paypal_sandbox").notNull().default(true),
  paypalEnableCards: boolean("paypal_enable_cards").notNull().default(true),
  /** POK Payments (card gateway) — server-only credentials; prefer DB over env. */
  pokMerchantId: text("pok_merchant_id"),
  pokKeyId: text("pok_key_id"),
  pokKeySecret: text("pok_key_secret"),
  /** staging | production */
  pokEnv: text("pok_env").notNull().default("production"),
  // SMTP / Email
  smtpEnabled: boolean("smtp_enabled").notNull().default(false),
  smtpHost: text("smtp_host"),
  smtpPort: integer("smtp_port"),
  /** starttls | ssl | none */
  smtpSecurity: text("smtp_security").notNull().default("starttls"),
  smtpUser: text("smtp_user"),
  smtpPass: text("smtp_pass"),
  smtpFromEmail: text("smtp_from_email"),
  smtpFromName: text("smtp_from_name"),
  // Free VIN Decoder
  freeVinDecoderEnabled: boolean("free_vin_decoder_enabled").notNull().default(true),
  freeVinDecoderDailyLimit: integer("free_vin_decoder_daily_limit").notNull().default(0),
  freeVinDecoderRequireSignIn: boolean("free_vin_decoder_require_sign_in").notNull().default(false),
  // Security — user login lockout
  maxFailedLogins: integer("max_failed_logins").notNull().default(5),
  lockoutMinutes: integer("lockout_minutes").notNull().default(30),
  // Security — admin login lockout (separate counters)
  adminMaxFailedLogins: integer("admin_max_failed_logins").notNull().default(3),
  adminLockoutMinutes: integer("admin_lockout_minutes").notNull().default(30),
  // Security — rate limits
  registerMaxPerHour: integer("register_max_per_hour").notNull().default(5),
  vinRatePerMinute: integer("vin_rate_per_minute").notNull().default(20),
  sessionDays: integer("session_days").notNull().default(30),
  requireHttps: boolean("require_https").notNull().default(false),
  // Google OAuth
  googleLoginEnabled: boolean("google_login_enabled").notNull().default(true),
  googleClientId: text("google_client_id"),
  googleClientSecret: text("google_client_secret"),
  // Facebook OAuth
  facebookLoginEnabled: boolean("facebook_login_enabled").notNull().default(true),
  facebookAppId: text("facebook_app_id"),
  facebookAppSecret: text("facebook_app_secret"),
  // LinkedIn OAuth
  linkedinLoginEnabled: boolean("linkedin_login_enabled").notNull().default(true),
  linkedinClientId: text("linkedin_client_id"),
  linkedinClientSecret: text("linkedin_client_secret"),
  // Site URL + Email send toggles
  siteUrl: text("site_url").default("https://verifykm.com"),
  emailSendWelcome: boolean("email_send_welcome").notNull().default(true),
  /** @deprecated merged into emailSendVinReady; kept so old rows still read. */
  emailSendReportConfirm: boolean("email_send_report_confirm").notNull().default(true),
  /** Single trigger for the combined report-ready + payment-confirmation email. */
  emailSendVinReady: boolean("email_send_vin_ready").notNull().default(true),
  emailSendPasswordReset: boolean("email_send_password_reset").notNull().default(true),
  emailSendAbandonedCart: boolean("email_send_abandoned_cart").notNull().default(false),
  /** Customer email when admin closes a pending VIN with no data and grants 1 credit. */
  emailSendNoinfo: boolean("email_send_noinfo").notNull().default(true),
  /** Customer email when admin removes pending VIN and marks payment refunded. */
  emailSendNoinforefund: boolean("email_send_noinforefund").notNull().default(true),
  /** Admin alert when a customer pays for a manual-pending VIN. Off by default. */
  emailSendAdminPendingVin: boolean("email_send_admin_pending_vin").notNull().default(false),
  emailTemplates: jsonb("email_templates").$type<EmailTemplatesConfig>(),
  /** When true, email_logs rows older than EMAIL_LOG_RETENTION_DAYS are purged. */
  emailLogRetentionEnabled: boolean("email_log_retention_enabled").notNull().default(true),
  // Google Analytics / Tag Manager (public site tracking)
  analyticsGtmEnabled: boolean("analytics_gtm_enabled").notNull().default(false),
  analyticsGtmContainerId: text("analytics_gtm_container_id"),
  analyticsGaEnabled: boolean("analytics_ga_enabled").notNull().default(false),
  analyticsGaMeasurementId: text("analytics_ga_measurement_id"),
  analyticsClarityEnabled: boolean("analytics_clarity_enabled").notNull().default(false),
  analyticsClarityProjectId: text("analytics_clarity_project_id"),
  analyticsMetaPixelEnabled: boolean("analytics_meta_pixel_enabled").notNull().default(false),
  analyticsMetaPixelId: text("analytics_meta_pixel_id"),
  // Log retention (days; 0 = use 4-day default in cleanup job)
  logRetentionDays: integer("log_retention_days").notNull().default(4),
  // Failed transaction auto-removal (days, 0 = disabled)
  failedTxnRetentionDays: integer("failed_txn_retention_days").notNull().default(0),
  /** KRW per 1 USD — used to show Korean insurance claim amounts in USD */
  krwPerUsd: real("krw_per_usd").notNull().default(1415),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AnnouncementLangOverride = {
  message?: string;
  linkText?: string;
  linkUrl?: string;
  hidden?: boolean;
};

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  linkText: text("link_text"),
  linkUrl: text("link_url"),
  isActive: boolean("is_active").notNull().default(true),
  showTo: text("show_to").notNull().default("all"),
  pages: text("pages").notNull().default("all"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  translations: jsonb("translations").$type<Record<string, AnnouncementLangOverride>>(),
});

export type Pricing = typeof pricingTable.$inferSelect;
export type SystemSettings = typeof systemSettingsTable.$inferSelect;
export type Announcement = typeof announcementsTable.$inferSelect;
