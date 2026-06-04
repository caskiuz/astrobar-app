import { Router } from "express";
import { db } from "../db";
import { 
  users, businesses, businessCommissions, systemSettings, 
  adminNotifications, orders, transactions, products 
} from "@shared/schema-mysql";
import { eq, sql, desc, and, gte, lte } from "drizzle-orm";
import { authenticateToken, requireAdmin } from "../authMiddleware";

const router = Router();

// Middleware: Solo admin
router.use(authenticateToken, requireAdmin);

// ==================== CONFIGURACIÓN DEL SISTEMA ====================

// Obtener todas las configuraciones
router.get("/settings", async (req, res) => {
  const settings = await db.select().from(systemSettings);
  res.json(settings);
});

// Actualizar configuración
router.put("/settings/:key", async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  
  await db.update(systemSettings)
    .set({ value, updatedBy: req.user!.id, updatedAt: new Date() })
    .where(eq(systemSettings.key, key));
  
  res.json({ success: true });
});

// Crear nueva configuración
router.post("/settings", async (req, res) => {
  const { key, value, type, category, description, isPublic } = req.body;
  
  const [setting] = await db.insert(systemSettings).values({
    key, value, type, category, description, isPublic,
    updatedBy: req.user!.id
  });
  
  res.json(setting);
});

// ==================== GESTIÓN DE USUARIOS ====================

// Listar todos los usuarios
router.get("/users", async (req, res) => {
  const { role, isActive, search } = req.query;
  
  let query = db.select().from(users);
  
  if (role) query = query.where(eq(users.role, role as string));
  if (isActive !== undefined) query = query.where(eq(users.isActive, isActive === 'true'));
  
  const allUsers = await query;
  res.json(allUsers);
});

// Obtener usuario específico
router.get("/users/:id", async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
  res.json(user);
});

// Activar/Desactivar usuario
router.patch("/users/:id/status", async (req, res) => {
  const { isActive } = req.body;
  
  await db.update(users)
    .set({ isActive })
    .where(eq(users.id, req.params.id));
  
  res.json({ success: true });
});

// Eliminar usuario
router.delete("/users/:id", async (req, res) => {
  await db.delete(users).where(eq(users.id, req.params.id));
  res.json({ success: true });
});

// ==================== GESTIÓN DE BARES ====================

// Listar todos los bares
router.get("/businesses", async (req, res) => {
  const { isActive, verificationStatus } = req.query;
  
  let query = db.select().from(businesses);
  
  if (isActive !== undefined) query = query.where(eq(businesses.isActive, isActive === 'true'));
  if (verificationStatus) query = query.where(eq(businesses.verificationStatus, verificationStatus as string));
  
  const allBusinesses = await query;
  res.json(allBusinesses);
});

// Obtener bar específico
router.get("/businesses/:id", async (req, res) => {
  const [business] = await db.select().from(businesses).where(eq(businesses.id, req.params.id));
  if (!business) return res.status(404).json({ error: "Bar no encontrado" });
  res.json(business);
});

// Activar/Desactivar bar
router.patch("/businesses/:id/status", async (req, res) => {
  const { isActive } = req.body;
  
  await db.update(businesses)
    .set({ isActive })
    .where(eq(businesses.id, req.params.id));
  
  res.json({ success: true });
});

// Aprobar/Rechazar bar
router.patch("/businesses/:id/verification", async (req, res) => {
  const { verificationStatus } = req.body;
  
  await db.update(businesses)
    .set({ verificationStatus })
    .where(eq(businesses.id, req.params.id));
  
  res.json({ success: true });
});

// Suspender bar temporalmente
router.patch("/businesses/:id/pause", async (req, res) => {
  const { isPaused, pauseReason, pausedUntil } = req.body;
  
  await db.update(businesses)
    .set({ isPaused, pauseReason, pausedAt: new Date(), pausedUntil })
    .where(eq(businesses.id, req.params.id));
  
  res.json({ success: true });
});

// ==================== COMISIONES POR BAR ====================

// Obtener comisión de un bar
router.get("/commissions/:businessId", async (req, res) => {
  const [commission] = await db.select()
    .from(businessCommissions)
    .where(eq(businessCommissions.businessId, req.params.businessId));
  
  res.json(commission || { platformCommission: 0.30 });
});

// Configurar comisión de un bar
router.post("/commissions", async (req, res) => {
  const { businessId, platformCommission, notes } = req.body;
  
  const [existing] = await db.select()
    .from(businessCommissions)
    .where(eq(businessCommissions.businessId, businessId));
  
  if (existing) {
    await db.update(businessCommissions)
      .set({ platformCommission, notes, createdBy: req.user!.id })
      .where(eq(businessCommissions.businessId, businessId));
  } else {
    await db.insert(businessCommissions).values({
      businessId, platformCommission, notes, createdBy: req.user!.id
    });
  }
  
  res.json({ success: true });
});

// Listar todas las comisiones
router.get("/commissions", async (req, res) => {
  const commissions = await db.select().from(businessCommissions);
  res.json(commissions);
});

// ==================== NOTIFICACIONES Y EMAILS ====================

// Enviar notificación push masiva
router.post("/notifications/push", async (req, res) => {
  const { title, message, targetType, targetId } = req.body;
  
  const [notification] = await db.insert(adminNotifications).values({
    title, message, type: 'push', targetType, targetId,
    sentBy: req.user!.id, status: 'pending'
  });
  
  // TODO: Implementar envío real con Expo Push Notifications
  
  res.json({ success: true, notificationId: notification.insertId });
});

// Enviar email masivo
router.post("/notifications/email", async (req, res) => {
  const { title, message, targetType, targetId } = req.body;
  
  const [notification] = await db.insert(adminNotifications).values({
    title, message, type: 'email', targetType, targetId,
    sentBy: req.user!.id, status: 'pending'
  });
  
  // TODO: Implementar envío real con servicio de email
  
  res.json({ success: true, notificationId: notification.insertId });
});

// Historial de notificaciones
router.get("/notifications", async (req, res) => {
  const notifications = await db.select()
    .from(adminNotifications)
    .orderBy(desc(adminNotifications.createdAt));
  
  res.json(notifications);
});

// ==================== ESTADÍSTICAS ====================

// Dashboard principal
router.get("/stats/dashboard", async (req, res) => {
  const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [activeUsers] = await db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.isActive, true));
  const [totalBars] = await db.select({ count: sql<number>`count(*)` }).from(businesses);
  const [activeBars] = await db.select({ count: sql<number>`count(*)` }).from(businesses).where(eq(businesses.isActive, true));
  const [totalOrders] = await db.select({ count: sql<number>`count(*)` }).from(orders);
  const [totalRevenue] = await db.select({ total: sql<number>`sum(total)` }).from(orders).where(eq(orders.status, 'delivered'));
  
  res.json({
    totalUsers: totalUsers.count,
    activeUsers: activeUsers.count,
    totalBars: totalBars.count,
    activeBars: activeBars.count,
    totalOrders: totalOrders.count,
    totalRevenue: totalRevenue.total || 0,
    limits: {
      maxBars: 100,
      currentBars: activeBars.count,
      percentageUsed: (activeBars.count / 100) * 100
    }
  });
});

// Estadísticas por bar
router.get("/stats/business/:id", async (req, res) => {
  const businessId = req.params.id;
  
  const [totalOrders] = await db.select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.businessId, businessId));
  
  const [totalRevenue] = await db.select({ total: sql<number>`sum(total)` })
    .from(orders)
    .where(and(eq(orders.businessId, businessId), eq(orders.status, 'delivered')));
  
  const [totalProducts] = await db.select({ count: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.businessId, businessId));
  
  res.json({
    totalOrders: totalOrders.count,
    totalRevenue: totalRevenue.total || 0,
    totalProducts: totalProducts.count
  });
});

// Alertas de límites
router.get("/alerts", async (req, res) => {
  const [activeBars] = await db.select({ count: sql<number>`count(*)` })
    .from(businesses)
    .where(eq(businesses.isActive, true));
  
  const alerts = [];
  
  if (activeBars.count >= 90) {
    alerts.push({
      type: 'warning',
      message: `Límite de bares casi alcanzado: ${activeBars.count}/100`,
      severity: 'high'
    });
  }
  
  res.json(alerts);
});

export default router;
// ==================== ENDPOINTS PARA COMPATIBILIDAD CON FRONTEND ====================

// 1. Métrica de los cuadraditos del Dashboard principal
router.get("/dashboard/metrics", async (req, res) => {
  try {
    // Contamos usuarios totales de la tabla users
    const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
    
    // Contamos negocios totales (Bares) de la tabla businesses
    const [totalBars] = await db.select({ count: sql<number>`count(*)` }).from(businesses);
    
    // Dejamos en 0 o contamos promociones/cupones si tenés la tabla (la seteamos en cero base por ahora)
    const promotionsCount = 0; 
    const acceptanceRate = 100; // Valor de prueba para el porcentaje de aceptación

    // Le respondemos al frontend con los nombres exactos de variables que espera recibir
    res.json({
      usersCount: totalUsers.count,
      businessesCount: totalBars.count,
      promotionsCount: promotionsCount,
      acceptanceRate: acceptanceRate
    });
  } catch (error) {
    console.error("Error en /dashboard/metrics:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// 2. Pedidos activos del Dashboard (Pestaña principal)
router.get("/dashboard/active-orders", async (req, res) => {
  try {
    // Traemos los pedidos que no estén completados ni cancelados
    const activeOrdersList = await db.select()
      .from(orders)
      .where(sql`status NOT IN ('delivered', 'cancelled')`)
      .orderBy(desc(orders.createdAt));

    res.json({ orders: activeOrdersList });
  } catch (error) {
    console.error("Error en /dashboard/active-orders:", error);
    res.json({ orders: [] });
  }
});

// 3. Repartidores en línea
router.get("/dashboard/online-drivers", async (req, res) => {
  try {
    // Por ahora devolvemos un array vacío para que no rompa el promise.all del front
    res.json({ drivers: [] });
  } catch (error) {
    console.error("Error en /dashboard/online-drivers:", error);
    res.json({ drivers: [] });
  }
});