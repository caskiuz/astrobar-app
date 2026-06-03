import { sql } from "drizzle-orm";
import {
  mysqlTable,
  text,
  varchar,
  boolean,
  timestamp,
  int,
  decimal,
  longtext, //
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  email: text("email"), // Optional - can be null for phone-only auth
  password: text("password"), // Optional - can be null for phone-only auth
  name: text("name").notNull(),
  phone: text("phone").notNull(), // Required and unique for phone-only auth
  pushToken: text("push_token"), // Expo push notification token
  role: text("role").notNull().default("customer"),
  emailVerified: boolean("email_verified").notNull().default(false),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  biometricEnabled: boolean("biometric_enabled").notNull().default(false), // For biometric authentication
  verificationCode: text("verification_code"),
  verificationExpires: timestamp("verification_expires"),
  stripeCustomerId: text("stripe_customer_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"),
  stripeAccountId: text("stripe_account_id"), // Para repartidores con Stripe Connect
  bankAccount: text("bank_account"), // JSON con datos bancarios (SPEI/CLABE)
  isActive: boolean("is_active").notNull().default(true), // Para desactivar cuentas
  isOnline: boolean("is_online").notNull().default(false), // Para repartidores online/offline
  lastActiveAt: timestamp("last_active_at"), // Última actividad
  profileImage: text("profile_image"), // URL de imagen de perfil
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const addresses = mysqlTable("addresses", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  label: text("label").notNull(),
  street: text("street").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code"),
  isDefault: boolean("is_default").notNull().default(false),
  latitude: text("latitude"),
  longitude: text("longitude"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: text("business_id").notNull(),
  businessName: text("business_name").notNull(),
  businessImage: text("business_image"),
  items: text("items").notNull(),
  status: text("status").notNull().default("pending"),
  subtotal: int("subtotal").notNull(),
  productosBase: int("productos_base").default(0), // Precio base sin markup AstroBar
  astroBarCommission: int("astrobar_commission").default(0), // 15% markup AstroBar
  deliveryFee: int("delivery_fee").notNull(),
  total: int("total").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentIntentId: text("payment_intent_id"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryPersonId: text("delivery_person_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  estimatedDelivery: timestamp("estimated_delivery"),
  // Campos para cancelación y comisiones
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by", { length: 255 }),
  cancellationReason: text("cancellation_reason"),
  refundAmount: int("refund_amount"),
  penaltyAmount: int("penalty_amount"), // penalización por cancelación
  refundStatus: text("refund_status"), // pending, processed, failed
  businessResponseAt: timestamp("business_response_at"), // cuando el negocio respondió
  platformFee: int("platform_fee"), // comisión AstroBar
  businessEarnings: int("business_earnings"), // ganancia negocio
  deliveryEarnings: int("delivery_earnings"), // ganancia repartidor
  distanceKm: int("distance_km"), // distancia en metros x100
  deliveredAt: timestamp("delivered_at"), // cuando se entregó
  deliveryLatitude: text("delivery_latitude"),
  deliveryLongitude: text("delivery_longitude"),
  // Preferencias de sustitución (Stock Out)
  substitutionPreference: text("substitution_preference").default("refund"), // refund, call, substitute
  itemSubstitutionPreferences: text("item_substitution_preferences"), // JSON: {productId: "refund"|"call"|"substitute"}
  // Pago en efectivo
  cashPaymentAmount: int("cash_payment_amount"), // Con cuánto paga el cliente (centavos)
  cashChangeAmount: int("cash_change_amount"), // Cambio a entregar (centavos)
  // Cronómetro de arrepentimiento
  regretPeriodEndsAt: timestamp("regret_period_ends_at"), // Cuando termina el periodo de 60s
  confirmedToBusinessAt: timestamp("confirmed_to_business_at"), // Cuando se notificó al negocio
  // Llamada automática al negocio
  callAttempted: boolean("call_attempted").default(false), // Si ya se intentó llamar al negocio
  callAttemptedAt: timestamp("call_attempted_at"), // Cuando se intentó la llamada
  // Campos adicionales de pago
  stripePaymentIntentId: text("stripe_payment_intent_id"), // ID de PaymentIntent para webhooks
  paidAt: timestamp("paid_at"), // Cuando se pagó
  refundedAt: timestamp("refunded_at"), // Cuando se reembolsó
  driverPaidAt: timestamp("driver_paid_at"), // Cuando se pagó al repartidor
  driverPaymentStatus: text("driver_payment_status").default("pending"), // pending, completed, failed
  // Asignación de repartidor
  assignedAt: timestamp("assigned_at"), // Cuando se asignó el repartidor
  // Liquidación de efectivo (para pedidos cash)
  cashCollected: boolean("cash_collected").default(false), // Si el repartidor ya cobró el efectivo
  cashSettled: boolean("cash_settled").default(false), // Si ya liquidó con negocio/plataforma
  cashSettledAt: timestamp("cash_settled_at"), // Cuando liquidó
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

export const businesses = mysqlTable("businesses", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  ownerId: varchar("owner_id", { length: 255 }),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("restaurant"), // restaurant, market
  image: longtext("image"),
  coverImage: longtext("cover_image"),
  address: text("address"),
  phone: text("phone"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  email: text("email"),
  rating: int("rating").default(0), // stored as 0-50 (for 0.0-5.0)
  totalRatings: int("total_ratings").default(0),
  deliveryTime: text("delivery_time").default("30-45 min"),
  deliveryFee: int("delivery_fee").default(2500), // in cents
  minOrder: int("min_order").default(5000), // in cents
  isActive: boolean("is_active").notNull().default(true),
  isOpen: boolean("is_open").notNull().default(true),
  openingHours: text("opening_hours"), // JSON: {"monday":{"open":"18:00","close":"03:00","closed":false},"tuesday":{...}}
  categories: text("categories"), // comma-separated
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  // Campos para ubicación y zonas de entrega
  latitude: text("latitude"),
  longitude: text("longitude"),
  maxDeliveryRadiusKm: int("max_delivery_radius_km").default(10), // Radio máximo de entrega
  baseFeePerKm: int("base_fee_per_km").default(500), // Costo por km en centavos
  verificationStatus: text("verification_status").default("pending"), // pending, verified, rejected
  verificationDocuments: text("verification_documents"), // JSON con URLs de documentos
  // Control operativo de negocios
  maxSimultaneousOrders: int("max_simultaneous_orders").default(10), // Límite de pedidos activos
  isPaused: boolean("is_paused").notNull().default(false), // Pausado por sistema o manual
  pauseReason: text("pause_reason"), // Razón de pausa: manual, too_many_orders, delayed_orders
  pausedAt: timestamp("paused_at"),
  pausedUntil: timestamp("paused_until"), // Pausa temporal
  autoResumeEnabled: boolean("auto_resume_enabled").notNull().default(true),
  isFeatured: boolean("is_featured").notNull().default(false), // Destacado en pantalla de login
  featuredOrder: int("featured_order").default(0), // Orden de aparición en carrusel
  // Modo Slammed (Saturado)
  isSlammed: boolean("is_slammed").notNull().default(false), // Negocio saturado
  slammedExtraMinutes: int("slammed_extra_minutes").default(20), // Minutos extra cuando está saturado
  slammedAt: timestamp("slammed_at"), // Cuando se activó el modo saturado
  // Stripe Connect
  stripeAccountId: text("stripe_account_id"), // ID de cuenta Stripe Connect
  stripeAccountStatus: text("stripe_account_status").default("pending"), // pending, active, restricted
  verificationCode: text("verification_code"),
  verificationExpires: timestamp("verification_expires"),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// Wallets - billetera para cada usuario
export const wallets = mysqlTable("wallets", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  balance: int("balance").notNull().default(0), // en centavos - saldo disponible
  pendingBalance: int("pending_balance").notNull().default(0), // dinero en tránsito
  cashOwed: int("cash_owed").notNull().default(0), // efectivo que debe liquidar (para repartidores)
  totalEarned: int("total_earned").notNull().default(0),
  totalWithdrawn: int("total_withdrawn").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Transactions - registro contable de todas las transacciones
export const transactions = mysqlTable("transactions", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  walletId: varchar("wallet_id", { length: 255 }),
  orderId: varchar("order_id", { length: 255 }),
  businessId: varchar("business_id", { length: 255 }),
  userId: varchar("user_id", { length: 255 }),
  type: text("type").notNull(), // income, commission, withdrawal, refund, penalty, tip, payment, transfer, delivery_payment
  amount: int("amount").notNull(), // en centavos (positivo = ingreso, negativo = egreso)
  balanceBefore: int("balance_before"),
  balanceAfter: int("balance_after"),
  description: text("description"),
  status: text("status").notNull().default("completed"), // pending, completed, failed, cancelled
  metadata: text("metadata"), // JSON con info adicional
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeTransferId: text("stripe_transfer_id"),
  stripeRefundId: text("stripe_refund_id"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// Payments - registro de pagos de Stripe
export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  customerId: varchar("customer_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  driverId: varchar("driver_id", { length: 255 }),
  amount: int("amount").notNull(), // en centavos
  currency: text("currency").notNull().default("MXN"),
  status: text("status").notNull().default("pending"), // pending, succeeded, failed, refunded
  paymentMethod: text("payment_method").notNull().default("card"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
});

// Alias para compatibilidad con paymentService.ts
export const walletTransactions = transactions;

// Base insert schema - phone and name are required, email/password are optional
export const insertUserSchema = createInsertSchema(users)
  .pick({
    email: true,
    password: true,
    name: true,
    phone: true,
    role: true,
  })
  .extend({
    phone: z.string().min(10, "Phone number is required"),
    name: z.string().min(1, "Name is required"),
    email: z.string().email().optional().nullable(),
    password: z.string().optional().nullable(),
  });

export const insertOrderSchema = createInsertSchema(orders).pick({
  userId: true,
  businessId: true,
  businessName: true,
  businessImage: true,
  items: true,
  status: true,
  subtotal: true,
  deliveryFee: true,
  total: true,
  paymentMethod: true,
  paymentIntentId: true,
  deliveryAddress: true,
  notes: true,
  substitutionPreference: true,
  itemSubstitutionPreferences: true,
  cashPaymentAmount: true,
  cashChangeAmount: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

// System Settings - Configuración global del sistema
export const systemSettings = mysqlTable("system_settings", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  key: varchar("key", { length: 255 }).notNull().unique(),
  value: text("value").notNull(),
  type: text("type").notNull().default("string"), // string, number, boolean, json
  category: text("category").notNull(), // payments, commissions, operations, security
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false), // Si es visible para clientes
  updatedBy: varchar("updated_by", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Products - Productos de negocios
export const products = mysqlTable("products", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: int("price").notNull(), // en centavos
  image: text("image"),
  category: text("category"),
  isAvailable: boolean("is_available").notNull().default(true),
  is86: boolean("is_86").notNull().default(false), // Menú 86 (agotado temporalmente)
  soldByWeight: boolean("sold_by_weight").notNull().default(false),
  weightUnit: text("weight_unit").default("kg"), // kg, lb, g
  stock: int("stock"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Stripe Connect Accounts - Cuentas conectadas de Stripe
export const stripeConnectAccounts = mysqlTable("stripe_connect_accounts", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }),
  stripeAccountId: varchar("stripe_account_id", { length: 255 })
    .notNull()
    .unique(),
  accountType: text("account_type").notNull(), // business, driver
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  chargesEnabled: boolean("charges_enabled").notNull().default(false),
  payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
  detailsSubmitted: boolean("details_submitted").notNull().default(false),
  requirements: text("requirements"), // JSON con requerimientos pendientes
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Withdrawals - Retiros de fondos
export const withdrawals = mysqlTable("withdrawals", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  walletId: varchar("wallet_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  amount: int("amount").notNull(), // en centavos
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, processing, completed, failed, cancelled
  stripeTransferId: text("stripe_transfer_id"),
  stripePayoutId: text("stripe_payout_id"),
  method: varchar("method", { length: 50 }).notNull().default("stripe"), // stripe, bank_transfer, cash
  bankAccount: text("bank_account"), // JSON con datos bancarios
  failureReason: text("failure_reason"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Withdrawal Requests - Solicitudes de retiro con detalles bancarios
export const withdrawalRequests = mysqlTable("withdrawal_requests", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  walletId: varchar("wallet_id", { length: 255 }).notNull(),
  amount: int("amount").notNull(), // en centavos
  method: varchar("method", { length: 50 }).notNull(), // stripe, bank_transfer
  status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, completed, failed, cancelled
  // Datos bancarios para transferencia SPEI
  bankClabe: varchar("bank_clabe", { length: 18 }), // CLABE interbancaria (18 dígitos)
  bankName: text("bank_name"),
  accountHolder: text("account_holder"),
  // Stripe
  stripePayoutId: text("stripe_payout_id"),
  // Admin
  approvedBy: varchar("approved_by", { length: 255 }),
  errorMessage: text("error_message"),
  requestedAt: timestamp("requested_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
});

// Delivery Drivers - Repartidores
export const deliveryDrivers = mysqlTable("delivery_drivers", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  vehicleType: text("vehicle_type").notNull(), // bike, motorcycle, car
  vehiclePlate: text("vehicle_plate"),
  isAvailable: boolean("is_available").notNull().default(false),
  currentLatitude: text("current_latitude"),
  currentLongitude: text("current_longitude"),
  lastLocationUpdate: timestamp("last_location_update"),
  totalDeliveries: int("total_deliveries").notNull().default(0),
  rating: int("rating").default(0), // stored as 0-50 (for 0.0-5.0)
  totalRatings: int("total_ratings").default(0),
  strikes: int("strikes").notNull().default(0), // Sistema de strikes
  isBlocked: boolean("is_blocked").notNull().default(false),
  blockedReason: text("blocked_reason"),
  blockedUntil: timestamp("blocked_until"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Audit Logs - Logs de auditoría para acciones críticas
export const auditLogs = mysqlTable("audit_logs", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  action: text("action").notNull(), // create_order, cancel_order, update_settings, etc
  entityType: text("entity_type").notNull(), // order, user, business, settings
  entityId: varchar("entity_id", { length: 255 }),
  changes: text("changes"), // JSON con cambios realizados
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type Product = typeof products.$inferSelect;
export type StripeConnectAccount = typeof stripeConnectAccounts.$inferSelect;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type DeliveryDriver = typeof deliveryDrivers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Payment = typeof payments.$inferSelect;

// Alias para compatibilidad
export const drivers = deliveryDrivers;

// Refresh Tokens - Tokens de refresco para autenticación
export const refreshTokens = mysqlTable("refresh_tokens", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Scheduled Orders - Pedidos programados
export const scheduledOrders = mysqlTable("scheduled_orders", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  items: text("items").notNull(), // JSON
  scheduledFor: timestamp("scheduled_for").notNull(),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLatitude: text("delivery_latitude"),
  deliveryLongitude: text("delivery_longitude"),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"), // pending, processed, failed, cancelled
  orderId: varchar("order_id", { length: 255 }), // ID del pedido creado
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Support Chats - Chats de soporte con IA
export const supportChats = mysqlTable("support_chats", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  status: text("status").notNull().default("active"), // active, closed, escalated
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Support Messages - Mensajes de chat de soporte
export const supportMessages = mysqlTable("support_messages", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  chatId: varchar("chat_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }), // null si es del bot
  message: text("message").notNull(),
  isBot: boolean("is_bot").notNull().default(false),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Reviews - Reseñas de pedidos
export const reviews = mysqlTable("reviews", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  rating: int("rating").notNull(), // 1-5
  comment: text("comment"),
  approved: boolean("approved").notNull().default(true),
  flagged: boolean("flagged").notNull().default(false),
  moderationReason: text("moderation_reason"),
  businessResponse: text("business_response"),
  businessResponseAt: timestamp("business_response_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

// Call logs for automatic business calls
export const callLogs = mysqlTable("call_logs", {
  id: varchar("id", { length: 255 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: varchar("order_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  callSid: varchar("call_sid", { length: 255 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  purpose: varchar("purpose", { length: 50 }).default("order_notification"), // order_notification, reminder
  status: varchar("status", { length: 50 }).default("initiated"), // initiated, ringing, answered, completed, failed, no-answer
  duration: int("duration"), // in seconds
  outcome: varchar("outcome", { length: 50 }), // accepted, rejected, no-answer
  response: varchar("response", { length: 10 }), // digits pressed by business
  responseAction: varchar("response_action", { length: 50 }), // accept, reject
  retryCount: int("retry_count").default(0),
  error: text("error"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at"),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type ScheduledOrder = typeof scheduledOrders.$inferSelect;
export type SupportChat = typeof supportChats.$inferSelect;
export type SupportMessage = typeof supportMessages.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type CallLog = typeof callLogs.$inferSelect;

// Delivery Zones - Zonas de entrega
export const deliveryZones = mysqlTable("delivery_zones", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  name: text("name").notNull(),
  description: text("description"),
  deliveryFee: int("deliveryFee").notNull(), // en centavos
  maxDeliveryTime: int("maxDeliveryTime").default(45), // minutos
  isActive: boolean("isActive").notNull().default(true),
  coordinates: text("coordinates"), // JSON con polígono de coordenadas
  centerLatitude: text("centerLatitude"),
  centerLongitude: text("centerLongitude"),
  radiusKm: int("radiusKm").default(5),
  createdAt: timestamp("createdAt").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updatedAt").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type DeliveryZone = typeof deliveryZones.$inferSelect;

// Coupons - Cupones de descuento
export const coupons = mysqlTable("coupons", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  code: varchar("code", { length: 50 }).notNull().unique(),
  discountType: varchar("discount_type", { length: 20 }).notNull(), // percentage, fixed
  discountValue: int("discount_value").notNull(), // en centavos o porcentaje
  minOrderAmount: int("min_order_amount").default(0), // mínimo de pedido en centavos
  maxUses: int("max_uses"), // null = ilimitado
  maxUsesPerUser: int("max_uses_per_user").default(1),
  usedCount: int("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type Coupon = typeof coupons.$inferSelect;

// Favorites - Favoritos de usuarios (negocios y productos)
export const favorites = mysqlTable("favorites", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }),
  productId: varchar("product_id", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type Favorite = typeof favorites.$inferSelect;

// Business Commissions - Comisiones configurables por bar
export const businessCommissions = mysqlTable("business_commissions", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  businessId: varchar("business_id", { length: 255 }).notNull().unique(),
  platformCommission: decimal("platform_commission", { precision: 5, scale: 4 }).notNull().default("0.3000"), // 30% por defecto
  effectiveFrom: timestamp("effective_from").default(sql`CURRENT_TIMESTAMP`),
  notes: text("notes"),
  createdBy: varchar("created_by", { length: 255 }),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Admin Notifications - Notificaciones enviadas por admin
export const adminNotifications = mysqlTable("admin_notifications", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // push, email, both
  targetType: varchar("target_type", { length: 50 }).notNull(), // all_users, all_bars, specific_user, specific_bar
  targetId: varchar("target_id", { length: 255 }), // ID específico si aplica
  sentCount: int("sent_count").default(0),
  failedCount: int("failed_count").default(0),
  status: varchar("status", { length: 50 }).default("pending"), // pending, sending, completed, failed
  sentBy: varchar("sent_by", { length: 255 }).notNull(),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export type BusinessCommission = typeof businessCommissions.$inferSelect;
export type AdminNotification = typeof adminNotifications.$inferSelect;

// Promotions - Promociones de bares (flash y comunes)
export const promotions = mysqlTable("promotions", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: varchar("type", { length: 20 }).notNull().default("common"), // flash, common
  originalPrice: int("original_price").notNull(), // en centavos
  promoPrice: int("promo_price").notNull(), // en centavos
  discountPercentage: int("discount_percentage"), // calculado
  stock: int("stock").notNull().default(0),
  stockConsumed: int("stock_consumed").notNull().default(0),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  image: text("image"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// Promotion Transactions - Transacciones de promociones aceptadas
export const promotionTransactions = mysqlTable("promotion_transactions", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  promotionId: varchar("promotion_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  businessId: varchar("business_id", { length: 255 }).notNull(),
  qrCode: varchar("qr_code", { length: 255 }).notNull().unique(),
  mpPaymentId: varchar("mp_payment_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  amountPaid: int("amount_paid").notNull(),
  platformCommission: int("platform_commission").notNull(),
  businessRevenue: int("business_revenue").notNull(),
  canCancelUntil: timestamp("can_cancel_until"),
  redeemedAt: timestamp("redeemed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

// User Points - Sistema de puntos y niveles
export const userPoints = mysqlTable("user_points", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  totalPoints: int("total_points").notNull().default(0),
  currentLevel: varchar("current_level", { length: 20 }).notNull().default("copper"), // copper, bronze, silver, gold, platinum
  promotionsRedeemed: int("promotions_redeemed").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type Promotion = typeof promotions.$inferSelect;
export type PromotionTransaction = typeof promotionTransactions.$inferSelect;
export type UserPoints = typeof userPoints.$inferSelect;

// Mercado Pago Accounts - Cuentas conectadas de Mercado Pago (OAuth)
export const mercadopagoAccounts = mysqlTable("mercadopago_accounts", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  businessId: varchar("business_id", { length: 255 }).notNull().unique(),
  mpUserId: varchar("mp_user_id", { length: 255 }).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  publicKey: varchar("public_key", { length: 255 }),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type MercadoPagoAccount = typeof mercadopagoAccounts.$inferSelect;

// Customer Mercado Pago Accounts - Cuentas MP de clientes para pagar
export const customerMercadopagoAccounts = mysqlTable("customer_mercadopago_accounts", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull().unique(),
  mpUserId: varchar("mp_user_id", { length: 255 }).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  publicKey: varchar("public_key", { length: 255 }),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type CustomerMercadoPagoAccount = typeof customerMercadopagoAccounts.$inferSelect;

// Payment Cards - Tarjetas de crédito/débito guardadas de clientes
export const paymentCards = mysqlTable("payment_cards", {
  id: varchar("id", { length: 255 })
    .primaryKey()
    .default(sql`(UUID())`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  lastFourDigits: varchar("last_four_digits", { length: 4 }).notNull(),
  brand: varchar("brand", { length: 50 }).notNull(), // Visa, Mastercard, Amex
  expiryMonth: int("expiry_month").notNull(),
  expiryYear: int("expiry_year").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  mpTokenId: varchar("mp_token_id", { length: 255 }), // Token de Mercado Pago
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").default(
    sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`,
  ),
});

export type PaymentCard = typeof paymentCards.$inferSelect;
