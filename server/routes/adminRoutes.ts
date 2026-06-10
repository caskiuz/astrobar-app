import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { sql } from "drizzle-orm";

const router = express.Router();

// Dashboard metrics
router.get("/dashboard/metrics", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users, businesses, promotions, promotionTransactions } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, sql } = await import("drizzle-orm");

    const allUsers = await db.select().from(users);
    const allBusinesses = await db.select().from(businesses);
    const allPromotions = await db.select().from(promotions);
    const allTransactions = await db.select().from(promotionTransactions);

    const totalPromotions = allPromotions.length; // Total histórico (incluye expiradas)
    const pausedBusinesses = allBusinesses.filter(b => !b.isActive).length;
    const totalBars = allBusinesses.length;
    
    // 🪐 CORRECCIÓN 1: El contador total de usuarios va a reflejar la suma de todos los registrados en la DB (o filtralo por users.role === 'user' si preferís solo clientes nativos)
    const totalUsers = allUsers.length; 

    // Calcular ingresos
    const totalRevenue = allTransactions.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
    const platformCommission = allTransactions.reduce((sum, t) => sum + (Number(t.platformCommission) || 0), 0);
    const totalTransactionsCount = allTransactions.length;
    const avgTicket = totalTransactionsCount > 0 ? totalRevenue / totalTransactionsCount : 0;

    // Tasa de aceptación
    const redeemedCount = allTransactions.filter(t => t.status === 'redeemed').length;
    const acceptanceRate = totalTransactionsCount > 0 ? Math.round((redeemedCount / totalTransactionsCount) * 100) : 0;

    res.json({
      success: true,
      totalBars,
      activePromotions: totalPromotions,
      totalUsers, // Muestra la métrica real
      pausedBusinesses,
      totalBusinesses: totalBars,
      totalRevenue,
      platformCommission,
      totalTransactions: totalTransactionsCount,
      avgTicket,
      acceptanceRate,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Dashboard metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Get all transactions (promotions)
router.get("/transactions", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { promotionTransactions, promotions, businesses, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");

    const allTransactions = await db
      .select()
      .from(promotionTransactions)
      .orderBy(desc(promotionTransactions.createdAt));

    const enriched = await Promise.all(
      allTransactions.map(async (transaction) => {
        const [user] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, transaction.userId))
          .limit(1);

        const [business] = await db
          .select({ name: businesses.name })
          .from(businesses)
          .where(eq(businesses.id, transaction.businessId))
          .limit(1);

        const [promotion] = await db
          .select({ title: promotions.title, type: promotions.type })
          .from(promotions)
          .where(eq(promotions.id, transaction.promotionId))
          .limit(1);

        return {
          ...transaction,
          user: user || { name: 'Usuario', email: '' },
          business: business || { name: 'Bar' },
          promotion: promotion || { title: 'Promoción', type: 'common' },
        };
      })
    );

    res.json({ success: true, transactions: enriched });
  } catch (error: any) {
    console.error('Transactions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get promotions dashboard
router.get("/promotions/dashboard", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { promotions, promotionTransactions, businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, and, gte, lte, sql } = await import("drizzle-orm");

    const now = new Date();

    // Get active promotions
    const activePromotions = await db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.isActive, true),
          lte(promotions.startTime, now),
          gte(promotions.endTime, now),
          sql`${promotions.stock} > ${promotions.stockConsumed}`
        )
      );

    const totalFlash = activePromotions.filter(p => p.type === 'flash').length;
    const totalCommon = activePromotions.filter(p => p.type === 'common').length;

    // Get all transactions
    const allTransactions = await db.select().from(promotionTransactions);
    const acceptedCount = allTransactions.length;
    const redeemedCount = allTransactions.filter(t => t.status === 'redeemed').length;
    const acceptanceRate = acceptedCount > 0 ? Math.round((redeemedCount / acceptedCount) * 100) : 0;

    // Calculate avg redemption time
    const redeemedTransactions = allTransactions.filter(t => t.status === 'redeemed' && t.redeemedAt);
    const avgRedemptionTime = redeemedTransactions.length > 0
      ? Math.round(
          redeemedTransactions.reduce((sum, t) => {
            const created = new Date(t.createdAt).getTime();
            const redeemed = new Date(t.redeemedAt!).getTime();
            return sum + (redeemed - created) / 60000; // minutes
          }, 0) / redeemedTransactions.length
        )
      : 0;

    // Get top bars by redemptions
    const barStats = new Map<string, { name: string; count: number }>();
    for (const transaction of redeemedTransactions) {
      const existing = barStats.get(transaction.businessId) || { name: '', count: 0 };
      existing.count++;
      
      if (!existing.name) {
        const [business] = await db
          .select({ name: businesses.name })
          .from(businesses)
          .where(eq(businesses.id, transaction.businessId))
          .limit(1);
        existing.name = business?.name || 'Bar';
      }
      
      barStats.set(transaction.businessId, existing);
    }

    const topBars = Array.from(barStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      success: true,
      dashboard: {
        totalActive: activePromotions.length,
        totalFlash,
        totalCommon,
        acceptanceRate,
        avgRedemptionTime,
        topBars,
      },
    });
  } catch (error: any) {
    console.error('Promotions dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get("/users", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        role: users.role,
        emailVerified: users.emailVerified,
        phoneVerified: users.phoneVerified,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);
      
    res.json({ success: true, users: allUsers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all businesses with commissions
router.get("/commissions", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businesses: businessesTable } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");

    const result = await db.execute(sql`
      SELECT 
        b.id as businessId,
        b.name as businessName,
        COALESCE(bc.platform_commission, 0.30) as commission,
        bc.updated_at as lastUpdated
      FROM businesses b
      LEFT JOIN business_commissions bc ON b.id = bc.business_id
      WHERE b.is_active = 1
      ORDER BY b.name
    `);

    const businesses = Array.isArray(result[0]) ? result[0] : result;
    res.json({ success: true, businesses });
  } catch (error: any) {
    console.error('Commissions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update business commission
router.post("/commissions", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    const { sql } = await import("drizzle-orm");
    const { v4: uuidv4 } = await import("uuid");

    const { businessId, commission, notes } = req.body;

    if (commission < 0.05 || commission > 0.30) {
      return res.status(400).json({ error: 'La comisión debe estar entre 5% y 30%' });
    }

    await db.execute(sql`
      INSERT INTO business_commissions (id, business_id, platform_commission, notes, created_by)
      VALUES (${uuidv4()}, ${businessId}, ${commission}, ${notes || ''}, ${req.user!.id})
      ON DUPLICATE KEY UPDATE 
        platform_commission = ${commission},
        notes = ${notes || ''},
        updated_at = CURRENT_TIMESTAMP
    `);

    res.json({ success: true, message: 'Comisión actualizada' });
  } catch (error: any) {
    console.error('Update commission error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put("/users/:id", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const { name, email, phone, role } = req.body;
    const userId = req.params.id;

    await db
      .update(users)
      .set({
        name,
        email,
        phone,
        role,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
      
    res.json({ success: true, message: "Usuario actualizado correctamente" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update user status
router.patch("/users/:id/status", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const { isActive } = req.body;

    await db
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, req.params.id));

    res.json({ success: true, message: isActive ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
router.delete("/users/:id", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    await db.delete(users).where(eq(users.id, req.params.id));
    res.json({ success: true, message: "Usuario eliminado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update business
router.put("/businesses/:id", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const { name, address, phone, email } = req.body;

    await db
      .update(businesses)
      .set({ name, address, phone, email, updatedAt: new Date() })
      .where(eq(businesses.id, req.params.id));
      
    res.json({ success: true, message: "Bar actualizado" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get user points stats
router.get("/points/stats", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as totalUsers,
        SUM(CASE WHEN current_level = 'copper' THEN 1 ELSE 0 END) as copper,
        SUM(CASE WHEN current_level = 'bronze' THEN 1 ELSE 0 END) as bronze,
        SUM(CASE WHEN current_level = 'silver' THEN 1 ELSE 0 END) as silver,
        SUM(CASE WHEN current_level = 'gold' THEN 1 ELSE 0 END) as gold,
        SUM(CASE WHEN current_level = 'platinum' THEN 1 ELSE 0 END) as platinum,
        SUM(total_points) as totalPoints,
        AVG(total_points) as avgPoints
      FROM user_points
    `);
    const stats = Array.isArray(result[0]) ? result[0][0] : result[0];
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Adjust user points
router.post("/points/adjust", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    const { userId, points, reason } = req.body;

    await db.execute(sql`
      UPDATE user_points 
      SET total_points = total_points + ${points}
      WHERE user_id = ${userId}
    `);

    res.json({ success: true, message: "Puntos adjusted" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get revenue stats
router.get("/revenue/stats", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as totalTransactions,
        SUM(amount_paid) as totalRevenue,
        SUM(platform_commission) as platformRevenue,
        SUM(business_revenue) as businessRevenue,
        AVG(amount_paid) as avgTransaction
      FROM promotion_transactions
      WHERE status IN ('redeemed', 'pending')
    `);
    const stats = Array.isArray(result[0]) ? result[0][0] : result[0];
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Revenue stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get wallet stats for admin
router.get("/wallet-stats", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    
    const totalResult = await db.execute(sql`
      SELECT 
        SUM(platform_commission) as totalEarnings,
        COUNT(*) as totalTransactions
      FROM promotion_transactions
      WHERE status IN ('redeemed', 'pending')
    `);
    const total = Array.isArray(totalResult[0]) ? totalResult[0][0] : totalResult[0];
    
    const monthResult = await db.execute(sql`
      SELECT SUM(platform_commission) as thisMonthEarnings
      FROM promotion_transactions
      WHERE status IN ('redeemed', 'pending')
        AND MONTH(created_at) = MONTH(CURRENT_DATE())
        AND YEAR(created_at) = YEAR(CURRENT_DATE())
    `);
    const month = Array.isArray(monthResult[0]) ? monthResult[0][0] : monthResult[0];
    
    const pendingResult = await db.execute(sql`
      SELECT SUM(platform_commission) as pendingPayouts
      FROM promotion_transactions
      WHERE status = 'pending'
    `);
    const pending = Array.isArray(pendingResult[0]) ? pendingResult[0][0] : pendingResult[0];
    
    const commissionResult = await db.execute(sql`
      SELECT AVG(platform_commission / amount_paid * 100) as avgCommission
      FROM promotion_transactions
      WHERE status IN ('redeemed', 'pending') AND amount_paid > 0
    `);
    const commission = Array.isArray(commissionResult[0]) ? commissionResult[0][0] : commissionResult[0];
    
    res.json({
      success: true,
      stats: {
        totalEarnings: Number(total?.totalEarnings || 0),
        thisMonthEarnings: Number(month?.thisMonthEarnings || 0),
        totalTransactions: Number(total?.totalTransactions || 0),
        pendingPayouts: Number(pending?.pendingPayouts || 0),
        platformCommission: Number(commission?.avgCommission || 0).toFixed(1),
        averageOrderValue: 0,
      },
    });
  } catch (error: any) {
    console.error('Admin wallet stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payment stats for admin panel
router.get("/payment-stats", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    const { promotionTransactions, businesses, users } = await import("@shared/schema-mysql");
    const { eq, desc } = await import("drizzle-orm");

    const allTransactions = await db.select().from(promotionTransactions);
    
    const totalRevenue = allTransactions.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
    const totalCommissions = allTransactions.reduce((sum, t) => sum + (Number(t.platformCommission) || 0), 0);
    const totalTransactions = allTransactions.length;
    const pendingPayments = allTransactions.filter(t => t.status === 'pending').length;
    const completedPayments = allTransactions.filter(t => t.status === 'redeemed').length;

    const allBusinesses = await db.select().from(businesses);
    const mpAccountsResult: any = await db.execute(sql`
      SELECT DISTINCT business_id FROM mercadopago_accounts WHERE is_active = true
    `);
    const barsWithMP = new Set((Array.isArray(mpAccountsResult[0]) ? mpAccountsResult[0] : mpAccountsResult).map((r: any) => r.business_id));
    const barsWithoutMP = allBusinesses.filter(b => !barsWithMP.has(b.id)).length;

    const customersWithMPResult: any = await db.execute(sql`
      SELECT COUNT(DISTINCT user_id) as count FROM customer_mercadopago_accounts WHERE is_active = true
    `);
    const customersWithMP = (Array.isArray(customersWithMPResult[0]) ? customersWithMPResult[0][0] : customersWithMPResult[0])?.count || 0;

    const avgCommission = totalTransactions > 0 ? totalCommissions / totalRevenue : 0;

    const recentTransactions = await db
      .select()
      .from(promotionTransactions)
      .orderBy(desc(promotionTransactions.createdAt))
      .limit(10);

    const enrichedTransactions = await Promise.all(
      recentTransactions.map(async (t) => {
        const [business] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, t.businessId)).limit(1);
        const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, t.userId)).limit(1);
        
        return {
          id: t.id,
          businessName: business?.name || 'Bar',
          customerName: user?.name || 'Cliente',
          amount: t.amountPaid,
          commission: t.platformCommission,
          status: t.status,
          createdAt: t.createdAt,
        };
      })
    );

    res.json({
      success: true,
      stats: {
        totalRevenue,
        totalCommissions,
        totalTransactions,
        pendingPayments,
        completedPayments,
        barsWithoutMP,
        customersWithMP,
        averageCommission: avgCommission,
      },
      recentTransactions: enrichedTransactions,
    });
  } catch (error: any) {
    console.error('Payment stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get top users by redemptions
router.get("/users/top", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    const result = await db.execute(sql`
      SELECT u.id, u.name, u.phone, COUNT(pt.id) as redemptions, SUM(pt.amount_paid) as totalSpent
      FROM users u
      JOIN promotion_transactions pt ON u.id = pt.user_id
      WHERE pt.status = 'redeemed'
      GROUP BY u.id
      ORDER BY redemptions DESC
      LIMIT 10
    `);
    const users = Array.isArray(result[0]) ? result[0] : result;
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders
router.get("/orders", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { orders, businesses, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");

    const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
    
    const enrichedOrders = [];
    for (const order of allOrders) {
      const business = await db
        .select({ name: businesses.name })
        .from(businesses)
        .where(eq(businesses.id, order.businessId))
        .limit(1);
        
      const customer = await db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, order.userId))
        .limit(1);

      enrichedOrders.push({
        id: order.id,
        userId: order.userId,
        businessId: order.businessId,
        businessName: business[0]?.name || order.businessName || "Negocio",
        businessImage: order.businessImage,
        customerName: customer[0]?.name || "Cliente",
        customerPhone: customer[0]?.phone || "",
        status: order.status,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        paymentMethod: order.paymentMethod,
        deliveryAddress: order.deliveryAddress,
        items: order.items,
        notes: order.notes,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        deliveryPersonId: order.deliveryPersonId,
      });
    }
    
    res.json({ success: true, orders: enrichedOrders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get business products
router.get("/businesses/:id/products", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { products } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const businessProducts = await db
      .select()
      .from(products)
      .where(eq(products.businessId, req.params.id));
      
    res.json({ success: true, products: businessProducts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all businesses
router.get("/businesses", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businesses, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");

    const allBusinesses = await db
      .select()
      .from(businesses)
      .orderBy(desc(businesses.createdAt));

    const enriched = await Promise.all(
      allBusinesses.map(async (business) => {
        if (!business.ownerId) {
          return {
            ...business,
            ownerName: 'Sin propietario',
          };
        }

        const [owner] = await db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, business.ownerId))
          .limit(1);

        return {
          ...business,
          ownerName: owner?.name || 'Propietario',
        };
      })
    );
      
    res.json({ success: true, businesses: enriched });
  } catch (error: any) {
    console.error('Get businesses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update business verification status
router.patch("/businesses/:id/verification", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { businesses } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const { isActive } = req.body;

    await db
      .update(businesses)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(businesses.id, req.params.id));

    res.json({ success: true, message: isActive ? 'Bar aprobado' : 'Bar rechazado' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Zones
router.get("/zones", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    res.json({ success: true, zones: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delivery zones
router.get("/delivery-zones", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { deliveryZones } = await import("@shared/schema-mysql");
    const { db } = await import("../db");

    const zones = await db.select().from(deliveryZones);
    
    res.json({ 
      success: true, 
      zones: zones
    });
  } catch (error: any) {
    console.error('Delivery zones error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Drivers
router.get("/drivers", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    res.json({ success: true, drivers: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: Check database wallets (no auth for testing)
router.get("/debug/wallets-noauth", async (req, res) => {
  try {
    const { db } = await import("../db");
    
    const result = await db.execute(sql`
      SELECT 
        w.id, w.user_id, w.balance, w.pending_balance, w.total_earned, w.total_withdrawn,
        u.name, u.email, u.role, u.phone
      FROM wallets w 
      LEFT JOIN users u ON w.user_id = u.id 
      ORDER BY w.total_earned DESC
    `);
    
    res.json({ success: true, wallets: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug: Check database wallets
router.get("/debug/wallets", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    
    const result = await db.execute(sql`
      SELECT 
        w.id, w.userId, w.balance, w.pendingBalance, w.totalEarned, w.totalWithdrawn,
        u.name, u.email, u.role, u.phone
      FROM wallets w 
      LEFT JOIN users u ON w.userId = u.id 
      ORDER BY w.totalEarned DESC
    `);
    
    res.json({ success: true, wallets: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all wallets (admin)
router.get("/wallets", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    
    const result = await db.execute(sql`
      SELECT 
        w.id, w.user_id as userId, w.balance, w.pending_balance as pendingBalance, 
        w.total_earned as totalEarned, w.total_withdrawn as totalWithdrawn,
        u.id as user_id, u.name as user_name, u.phone as user_phone, u.role as user_role
      FROM wallets w 
      LEFT JOIN users u ON w.user_id = u.id
    `);
    
    const rows = Array.isArray(result[0]) ? result[0] : result;
    const walletsWithUsers = rows.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      balance: row.balance || 0,
      pendingBalance: row.pendingBalance || 0,
      totalEarned: row.totalEarned || 0,
      totalWithdrawn: row.totalWithdrawn || 0,
      user: row.user_name ? {
        id: row.user_id,
        name: row.user_name,
        phone: row.user_phone,
        role: row.user_role
      } : null
    }));

    res.json({ success: true, wallets: walletsWithUsers });
  } catch (error: any) {
    console.error('Wallets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Release pending balance (admin action)
router.post("/wallets/:walletId/release", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { wallets } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq } = await import("drizzle-orm");

    const [wallet] = await db
      .select()
      .from(wallets)
      .where(eq(wallets.id, req.params.walletId))
      .limit(1);

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    if (wallet.pendingBalance <= 0) {
      return res.status(400).json({ error: "No pending balance to release" });
    }

    await db
      .update(wallets)
      .set({
        balance: wallet.balance + wallet.pendingBalance,
        pendingBalance: 0,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, req.params.walletId));

    res.json({ success: true, message: "Balance released successfully" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Finance data
router.get("/finance", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { transactions, users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, desc } = await import("drizzle-orm");

    const allTransactions = await db.select().from(transactions).orderBy(desc(transactions.createdAt));
    
    const enrichedTransactions = [];
    for (const transaction of allTransactions) {
      const user = await db
        .select({ id: users.id, name: users.name, email: users.email, role: users.role })
        .from(users)
        .where(eq(users.id, transaction.userId))
        .limit(1);
        
      enrichedTransactions.push({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        createdAt: transaction.createdAt,
        userId: transaction.userId,
        userName: user[0]?.name || 'Usuario desconocido',
        userEmail: user[0]?.email || '',
        userRole: user[0]?.role || ''
      });
    }

    res.json({ 
      success: true, 
      transactions: enrichedTransactions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Coupons
router.get("/coupons", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    res.json({ success: true, coupons: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Support tickets
router.get("/support/tickets", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    res.json({ success: true, tickets: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Support tickets
router.get("/support", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    res.json({ success: true, tickets: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin logs
router.get("/logs", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    res.json({ success: true, logs: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// System settings
router.get("/settings", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");

    const result = await db.execute(sql`SELECT * FROM system_settings`);
    const settings = Array.isArray(result[0]) ? result[0] : result;
    res.json({ success: true, settings });
  } catch (error: any) {
    console.error('Settings error:', error);
    res.json({ success: true, settings: [] });
  }
});

// Update system setting
router.post("/settings/update", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { db } = await import("../db");
    const { clearSettingsCache } = await import("../utils/systemSettings");
    const { v4: uuidv4 } = await import("uuid");
    const { key, value } = req.body;

    await db.execute(sql`
      INSERT INTO system_settings (id, setting_key, value)
      VALUES (${uuidv4()}, ${key}, ${value})
      ON DUPLICATE KEY UPDATE value = ${value}
    `);

    clearSettingsCache();

    res.json({ success: true, message: 'Configuración actualizada' });
  } catch (error: any) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send push notification
router.post("/notifications/push", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    const { users } = await import("@shared/schema-mysql");
    const { db } = await import("../db");
    const { eq, isNotNull } = await import("drizzle-orm");
    const { sendBulkPushNotifications } = await import("../services/pushNotifications");

    const { title, body, target } = req.body;

    let targetUsers;
    
    // 🪐 CORRECCIÓN 2: Mapeamos de forma correcta el string del rol real guardado ('user')
    if (target === 'customers') {
      targetUsers = await db.select().from(users).where(eq(users.role, 'user')); 
    } else if (target === 'businesses') {
      targetUsers = await db.select().from(users).where(eq(users.role, 'business_owner'));
    } else {
      targetUsers = await db.select().from(users).where(isNotNull(users.pushToken));
    }

    const tokens = targetUsers
      .filter(u => u.pushToken)
      .map(u => u.pushToken!);

    if (tokens.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No hay usuarios con tokens' });
    }

    await sendBulkPushNotifications(tokens, title, body);

    res.json({ success: true, sent: tokens.length });
  } catch (error: any) {
    console.error('Error sending notifications:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

// Bank account (placeholder)
router.get("/bank-account", authenticateToken, requireRole("admin", "super_admin"), async (req, res) => {
  try {
    res.json({ 
      success: true, 
      bankAccount: null,
      message: "No bank account configured" 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});