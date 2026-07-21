import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  numeric,
  date,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Catálogo de temas (snapshot del schema FormField[] por versión). */
export const themes = pgTable("themes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  description: text("description").notNull().default(""),
  unit: text("unit").notNull().default(""),
  valueLabel: text("value_label").notNull().default("Valor"),
  schemaVersion: integer("schema_version").notNull().default(1),
  fieldSchema: jsonb("field_schema").notNull().$type<unknown[]>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Mapeo Keycloak sub → perfil local + rol de app. */
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    keycloakSub: text("keycloak_sub").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    role: text("role").notNull().default("analista"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_keycloak_sub_uidx").on(t.keycloakSub),
    uniqueIndex("users_email_uidx").on(t.email),
  ],
);

/** Cargas masivas Excel. */
export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id),
    schemaVersion: integer("schema_version").notNull(),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path"),
    status: text("status").notNull().default("pending"),
    accepted: integer("accepted").notNull().default(0),
    rejected: integer("rejected").notNull().default(0),
    duplicates: integer("duplicates").notNull().default(0),
    errors: jsonb("errors").$type<unknown[]>().default([]),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("uploads_theme_idx").on(t.themeId)],
);

/**
 * Registros operativos.
 * Columnas fijas + payload jsonb para campos específicos del tema.
 */
export const records = pgTable(
  "records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id),
    departamento: text("departamento").notNull(),
    municipio: text("municipio").notNull(),
    fecha: date("fecha").notNull(),
    estado: text("estado").notNull(),
    valor: numeric("valor", { precision: 18, scale: 2 }).notNull().default("0"),
    payload: jsonb("payload").notNull().$type<Record<string, unknown>>().default({}),
    source: text("source").notNull().default("form"),
    contentHash: text("content_hash").notNull(),
    uploadId: uuid("upload_id").references(() => uploads.id),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("records_theme_fecha_idx").on(t.themeId, t.fecha),
    index("records_theme_dept_idx").on(t.themeId, t.departamento),
    index("records_theme_estado_idx").on(t.themeId, t.estado),
    uniqueIndex("records_theme_hash_uidx").on(t.themeId, t.contentHash),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);

/**
 * ACL por tema.
 * - admin / auditor: bypass (todos los temas).
 * - Si el usuario no tiene filas ACL: acceso completo según su rol (local-friendly).
 * - Si tiene ≥1 fila: solo esos temas.
 * - ACL_STRICT=true: sin filas = sin acceso (modo producción).
 */
export const userThemeAccess = pgTable(
  "user_theme_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    themeId: text("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
    canRead: integer("can_read").notNull().default(1),
    canWrite: integer("can_write").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("user_theme_access_uidx").on(t.userId, t.themeId),
    index("user_theme_access_user_idx").on(t.userId),
  ],
);

export type ThemeRow = typeof themes.$inferSelect;
export type RecordRowDb = typeof records.$inferSelect;
export type UploadRow = typeof uploads.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type UserThemeAccessRow = typeof userThemeAccess.$inferSelect;
