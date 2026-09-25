import express, { type Express, type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { isAllowedOrigin } from "./lib/allowedOrigins.js";
import { clientGuard } from "./lib/clientGuard.js";
import { publicAbuseLimiter } from "./lib/publicAbuseLimiter.js";
import { maintenanceMiddleware } from "./lib/maintenanceMiddleware.js";
import { accessBlockMiddleware } from "./lib/accessBlockMiddleware.js";
import { requestContextMiddleware } from "./lib/requestContextMiddleware.js";
import { mountStaticSite } from "./lib/staticSite.js";

const app: Express = express();

app.set("trust proxy", 1);

const STATIC_EXT_RE = /\.(?:js|mjs|css|woff2?|png|jpe?g|webp|svg|ico|gif|txt|xml|map)$/i;

app.use(
  compression({
    threshold: 1024,
    filter(req, res) {
      const path = req.path ?? "";
      if (path.startsWith("/api/vin/image")) return false;
      if (STATIC_EXT_RE.test(path)) return false;
      const type = res.getHeader("Content-Type");
      if (typeof type === "string") {
        if (type.startsWith("image/")) return false;
        if (type.includes("font/")) return false;
      }
      return compression.filter(req, res);
    },
  }),
);

const CORS_METHODS = "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS";
const CORS_HEADERS = "Content-Type,Authorization,X-Requested-With,X-Verifykm-Client";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          // ThreatMetrix (Cardinal/CyberSource DF) used by POK 3DS
          "'unsafe-eval'",
          "https://www.paypal.com",
          "https://www.paypalobjects.com",
          "https://www.google.com",
          "https://www.gstatic.com",
          "https://www.recaptcha.net",
          "https://js.paypal.com",
          "https://www.googletagmanager.com",
          "https://static.cloudflareinsights.com",
          "https://www.clarity.ms",
          "https://scripts.clarity.ms",
          "https://static.pokpay.io",
          "https://*.pokpay.io",
          "https://connect.facebook.net",
          "https://h.online-metrix.net",
          "https://*.online-metrix.net",
          "https://*.cardinalcommerce.com",
          "https://songbird.cardinalcommerce.com",
          "https://songbirdstag.cardinalcommerce.com",
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://www.paypal.com",
          "https://static.pokpay.io",
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://static.pokpay.io"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://www.paypal.com",
          "https://api.paypal.com",
          "https://api-m.paypal.com",
          "https://www.sandbox.paypal.com",
          "https://api-m.sandbox.paypal.com",
          "https://www.google.com",
          "https://www.gstatic.com",
          "https://www.recaptcha.net",
          "https://www.googletagmanager.com",
          "https://www.google-analytics.com",
          "https://*.google-analytics.com",
          "https://analytics.google.com",
          "https://cloudflareinsights.com",
          "https://www.clarity.ms",
          "https://*.clarity.ms",
          "https://scripts.clarity.ms",
          "https://c.clarity.ms",
          "https://h.clarity.ms",
          "https://api.pokpay.io",
          "https://api-staging.pokpay.io",
          "https://static.pokpay.io",
          "https://*.pokpay.io",
          // POK GuestCheckout 3DS / order status uses socket.io over WSS
          "wss://api.pokpay.io",
          "wss://api-staging.pokpay.io",
          "wss://*.pokpay.io",
          // Cardinal Cruise + ThreatMetrix device fingerprint
          "https://*.cardinalcommerce.com",
          "https://centinelapi.cardinalcommerce.com",
          "https://centinelapistag.cardinalcommerce.com",
          "https://geo.cardinalcommerce.com",
          "https://h.online-metrix.net",
          "https://*.online-metrix.net",
          "https://connect.facebook.net",
          "https://www.facebook.com",
        ],
        frameSrc: [
          "'self'",
          "https://www.paypal.com",
          "https://www.paypalobjects.com",
          "https://www.sandbox.paypal.com",
          "https://sandbox.paypal.com",
          "https://www.google.com",
          "https://www.recaptcha.net",
          "https://www.googletagmanager.com",
          "https://static.pokpay.io",
          "https://*.pokpay.io",
          "https://*.cardinalcommerce.com",
          "https://*.cybersource.com",
          "https://h.online-metrix.net",
          "https://*.online-metrix.net",
          // Bank ACS / 3-D Secure challenge pages (issuer-specific hosts)
          "https:",
        ],
        // Helmet defaults form-action to 'self', which blocks Cardinal Collect and hangs Pay.
        formAction: [
          "'self'",
          "https://*.cardinalcommerce.com",
          "https://centinelapi.cardinalcommerce.com",
          "https://centinelapistag.cardinalcommerce.com",
          "https://*.pokpay.io",
          "https://api.pokpay.io",
          "https://api-staging.pokpay.io",
          "https://h.online-metrix.net",
          "https://*.online-metrix.net",
          // Issuer ACS challenge form POSTs (host varies by bank)
          "https:",
        ],
        workerSrc: ["'self'", "blob:", "https://h.online-metrix.net", "https://*.online-metrix.net"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // PayPal / POK 3DS open popups / lightboxes — strict same-origin COOP breaks them.
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    // Default Helmet CORP is same-origin and blocks Facebook/WhatsApp/Telegram/Clarity
    // from loading /seo/og/*.webp preview images when a link is shared.
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();
  if (isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", CORS_METHODS);
    res.setHeader("Access-Control-Allow-Headers", CORS_HEADERS);
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  }
  res.status(403).json({ error: "CORS: origin not allowed" });
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cookieParser());
app.use((req, res, next) => {
  const isLargeCatalogBody =
    (req.path.startsWith("/api/admin/vin-catalog")
      || req.path.startsWith("/api/admin/pending-vin-checks"))
    && (req.method === "PATCH" || req.method === "POST")
    && !req.path.endsWith("/import")
    && !req.path.endsWith("/import-json");
  const limit = isLargeCatalogBody ? "15mb" : "50kb";
  express.json({ limit })(req, res, (err) => {
    if (err) return next(err);
    express.urlencoded({ extended: true, limit })(req, res, next);
  });
});

app.use("/api", requestContextMiddleware);
app.use("/api", publicAbuseLimiter);
app.use("/api", accessBlockMiddleware);
app.use("/api", clientGuard);
app.use("/api", maintenanceMiddleware);
app.use("/api", router);

mountStaticSite(app);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const errType = err && typeof err === "object" && "type" in err ? (err as { type?: string }).type : undefined;
  if (errType === "entity.too.large") {
    if (!res.headersSent) {
      res.status(413).json({ error: "Request body too large" });
    }
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error({ err, stack, method: req.method, url: req.url }, "Unhandled error");
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default app;
