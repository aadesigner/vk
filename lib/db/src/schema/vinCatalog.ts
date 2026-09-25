import { pgTable, serial, text, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const vinCatalogTable = pgTable("vin_catalog", {
  id: serial("id").primaryKey(),
  vin: text("vin").notNull(),
  providerName: text("provider_name"),
  data: jsonb("data").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("vin_catalog_vin_unique").on(table.vin),
  index("vin_catalog_provider_name_idx").on(table.providerName),
  index("vin_catalog_imported_at_idx").on(table.importedAt),
]);

export type VinCatalog = typeof vinCatalogTable.$inferSelect;
