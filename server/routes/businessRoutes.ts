import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { businesses, promotionTransactions, products, promotions } from "@shared/schema-mysql";
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

console.log('🔧 Business routes loaded');

// Test route
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Business routes working" });
});

// My businesses route (PROTECTED - debe ir antes de /:id)
router.get("/my-businesses", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const ownerBusinesses = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id));
    res.json({ success: true, businesses: ownerBusinesses });
  } catch (error: any) {
    console.error('My businesses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Products route (PROTECTED - debe ir antes de /:id)
router.get("/products", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    let [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    
    // Si no tiene negocio, crear uno automáticamente
    if (!business) {
      const businessId = uuidv4();
      const newBusiness = {
        id: businessId,
        name: "Mi Bar",
        address: "Buenos Aires, Argentina",
        latitude: -34.6037,
        longitude: -58.3816,
        phone: "+54 11 1234-5678",
        description: "Un bar increíble en Buenos Aires",
        ownerId: req.user!.id,
        isActive: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(businesses).values(newBusiness);
      business = newBusiness;
    }
    
    const businessProducts = await db.select().from(products).where(eq(products.businessId, business.id));
    res.json({ success: true, products: businessProducts, businessId: business.id });
  } catch (error: any) {
    console.error('Products route error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get business hours
router.get("/hours", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    let schedules = [];
    if (business.openingHours) {
      try {
        schedules = JSON.parse(business.openingHours);
      } catch (e) {
        schedules = [];
      }
    }

    res.json({ success: true, schedules });
  } catch (error: any) {
    console.error('Get hours error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update business hours
router.put("/hours", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { schedules } = req.body;
    const [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    await db
      .update(businesses)
      .set({ 
        openingHours: JSON.stringify(schedules),
        updatedAt: new Date()
      })
      .where(eq(businesses.id, business.id));

    console.log(`🕐 Horarios actualizados para ${business.name}`);
    res.json({ success: true, message: "Horarios guardados correctamente" });
  } catch (error: any) {
    console.error('Update hours error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dashboard route (PROTECTED - debe ir antes de /:id)
router.get("/dashboard", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businessId } = req.query;
    
    let [business] = businessId 
      ? await db.select().from(businesses).where(eq(businesses.id, businessId as string)).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    
    if (!business) {
      const businessId = uuidv4();
      const newBusiness = {
        id: businessId,
        name: "Mi Bar",
        address: "Buenos Aires, Argentina",
        latitude: -34.6037,
        longitude: -58.3816,
        phone: "+54 11 1234-5678",
        description: "Un bar increíble en Buenos Aires",
        ownerId: req.user!.id,
        isActive: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(businesses).values(newBusiness);
      business = newBusiness;
    }
    const transactions = await db.select().from(promotionTransactions).where(eq(promotionTransactions.businessId, business.id)).orderBy(desc(promotionTransactions.createdAt));
    const pendingTransactions = transactions.filter(t => t.status === "pending");
    const today = new Date();
    const todayTransactions = transactions.filter(t => new Date(t.createdAt).toDateString() === today.toDateString());
    
    // INGRESOS = Todas las transacciones pagadas (pending + redeemed), NO canceladas
    const paidTransactions = todayTransactions.filter(t => t.status === "pending" || t.status === "redeemed");
    const todayRevenue = paidTransactions.reduce((sum, t) => sum + (Number(t.businessRevenue) || 0), 0);
    
    // Promociones activas
    const now = new Date();
    const { and, gte, lte, sql } = await import("drizzle-orm");
    const activePromotions = await db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.businessId, business.id),
          eq(promotions.isActive, true),
          lte(promotions.startTime, now),
          gte(promotions.endTime, now)
        )
      );
    const activeFlash = activePromotions.filter(p => p.type === 'flash');
    const activeCommon = activePromotions.filter(p => p.type === 'common');

    // Obtener comisión actual desde DB
    const commissionResult: any = await db.execute(sql`
      SELECT platform_commission
      FROM business_commissions
      WHERE business_id = ${business.id}
      LIMIT 1
    `);
    
    let platformCommission = 30;
    if (commissionResult && commissionResult[0] && commissionResult[0][0] && commissionResult[0][0].platform_commission) {
      platformCommission = parseFloat(commissionResult[0][0].platform_commission);
    }

    // Solo mostrar transacciones reales (redeemed o pending)
    const recentTransactions = transactions
      .filter(t => t.status === "redeemed" || t.status === "pending")
      .slice(0, 10)
      .map(t => ({ 
        id: t.id, 
        status: t.status === "redeemed" ? "delivered" : "pending", 
        subtotal: t.amountPaid || 0, 
        customerName: 'Cliente', 
        createdAt: t.createdAt 
      }));
    res.json({ 
      success: true, 
      dashboard: { 
        business, 
        isOpen: business.isActive, 
        pendingOrders: pendingTransactions.length, 
        todayOrders: todayTransactions.length, 
        todayRevenue, 
        totalOrders: transactions.length, 
        recentOrders: recentTransactions,
        activePromotions: {
          total: activePromotions.length,
          flash: activeFlash.length,
          common: activeCommon.length,
          flashList: activeFlash.map(p => ({ id: p.id, title: p.title, stock: p.stock - p.stockConsumed })),
          commonList: activeCommon.map(p => ({ id: p.id, title: p.title, stock: p.stock - p.stockConsumed }))
        },
        platformCommission
      } 
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stats route (PROTECTED - debe ir antes de /:id)
router.get("/stats", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { businessId } = req.query;
    
    let [business] = businessId 
      ? await db.select().from(businesses).where(eq(businesses.id, businessId as string)).limit(1)
      : await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    
    if (!business) {
      const businessId = uuidv4();
      const newBusiness = {
        id: businessId,
        name: "Mi Bar",
        address: "Buenos Aires, Argentina",
        latitude: -34.6037,
        longitude: -58.3816,
        phone: "+54 11 1234-5678",
        description: "Un bar increíble en Buenos Aires",
        ownerId: req.user!.id,
        isActive: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(businesses).values(newBusiness);
      business = newBusiness;
    }
    const transactions = await db.select().from(promotionTransactions).where(eq(promotionTransactions.businessId, business.id)).orderBy(desc(promotionTransactions.createdAt));
    const redeemedTransactions = transactions.filter(t => t.status === 'redeemed');
    
    // INGRESOS TOTALES = Todas las transacciones pagadas (pending + redeemed), NO canceladas
    const paidTransactions = transactions.filter(t => t.status === 'pending' || t.status === 'redeemed');
    const totalRevenue = paidTransactions.reduce((sum, t) => sum + (Number(t.businessRevenue) || 0), 0);
    
    // Calcular ingresos por período
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const weekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const todayRevenue = paidTransactions
      .filter(t => new Date(t.createdAt) >= todayStart)
      .reduce((sum, t) => sum + (Number(t.businessRevenue) || 0), 0);
    
    const weekRevenue = paidTransactions
      .filter(t => new Date(t.createdAt) >= weekStart)
      .reduce((sum, t) => sum + (Number(t.businessRevenue) || 0), 0);
    
    const monthRevenue = paidTransactions
      .filter(t => new Date(t.createdAt) >= monthStart)
      .reduce((sum, t) => sum + (Number(t.businessRevenue) || 0), 0);
    
    const avgValue = redeemedTransactions.length > 0 
      ? Math.round(totalRevenue / redeemedTransactions.length)
      : 0;
    
    // Top productos
    const { sql } = await import("drizzle-orm");
    const topProductsResult = await db.execute(sql`
      SELECT p.title as name, COUNT(*) as quantity, SUM(pt.business_revenue) as revenue
      FROM promotion_transactions pt
      JOIN promotions p ON pt.promotion_id = p.id
      WHERE pt.business_id = ${business.id} AND pt.status = 'redeemed'
      GROUP BY p.id
      ORDER BY quantity DESC
      LIMIT 5
    `);
    const topProducts = (Array.isArray(topProductsResult[0]) ? topProductsResult[0] : topProductsResult).map((p: any) => ({
      name: p.name,
      quantity: Number(p.quantity),
      revenue: Number(p.revenue)
    }));

    // Tasa de cancelación
    const cancelledCount = transactions.filter(t => t.status === 'cancelled').length;
    const cancellationRate = transactions.length > 0 ? Math.round((cancelledCount / transactions.length) * 100) : 0;

    // Horarios pico (horas con más canjes)
    const hourlyStats = new Map<number, number>();
    redeemedTransactions.forEach(t => {
      const hour = new Date(t.redeemedAt || t.createdAt).getHours();
      hourlyStats.set(hour, (hourlyStats.get(hour) || 0) + 1);
    });
    const peakHours = Array.from(hourlyStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ hour, count }));

    // Top usuarios
    const topUsersResult = await db.execute(sql`
      SELECT u.name, u.phone, COUNT(*) as redemptions, SUM(pt.amount_paid) as totalSpent
      FROM promotion_transactions pt
      JOIN users u ON pt.user_id = u.id
      WHERE pt.business_id = ${business.id} AND pt.status = 'redeemed'
      GROUP BY u.id
      ORDER BY redemptions DESC
      LIMIT 5
    `);
    const topUsers = (Array.isArray(topUsersResult[0]) ? topUsersResult[0] : topUsersResult).map((u: any) => ({
      name: u.name,
      phone: u.phone,
      redemptions: Number(u.redemptions),
      totalSpent: Number(u.totalSpent)
    }));
    
    res.json({ 
      success: true, 
      businessId: business.id, 
      businessName: business.name, 
      revenue: { 
        today: todayRevenue,
        week: weekRevenue, 
        month: monthRevenue,
        total: totalRevenue 
      }, 
      orders: { 
        total: transactions.length, 
        completed: redeemedTransactions.length,
        cancelled: cancelledCount,
        avgValue: avgValue
      },
      topProducts,
      cancellationRate,
      peakHours,
      topUsers
    });
  } catch (error: any) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Promotions route (PROTECTED - debe ir antes de /:id)
router.get("/promotions", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    let [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    
    // Si no tiene negocio, crear uno automáticamente
    if (!business) {
      const businessId = uuidv4();
      const newBusiness = {
        id: businessId,
        name: "Mi Bar",
        address: "Buenos Aires, Argentina",
        latitude: -34.6037,
        longitude: -58.3816,
        phone: "+54 11 1234-5678",
        description: "Un bar increíble en Buenos Aires",
        ownerId: req.user!.id,
        isActive: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(businesses).values(newBusiness);
      business = newBusiness;
    }
    const businessPromotions = await db.select().from(promotions).where(eq(promotions.businessId, business.id));
    const now = new Date();
    const activePromotions = businessPromotions.filter(p => p.isActive && new Date(p.endTime) > now);
    const flashPromotions = activePromotions.filter(p => p.type === 'flash');
    const commonPromotions = activePromotions.filter(p => p.type === 'common');
    const totalStock = activePromotions.reduce((sum, p) => sum + (p.stock || 0), 0);
    res.json({ 
      success: true, 
      promotions: businessPromotions,
      activePromotions: activePromotions.length,
      flashPromotions: flashPromotions.length,
      commonPromotions: commonPromotions.length,
      totalStock
    });
  } catch (error: any) {
    console.error('Promotions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get business limits status
router.get("/limits", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    let [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    // Contar productos
    const productCount = await db.select().from(products).where(eq(products.businessId, business.id));
    
    // Contar promociones activas
    const now = new Date();
    const { and, gte, lte } = await import("drizzle-orm");
    const activePromotions = await db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.businessId, business.id),
          eq(promotions.isActive, true),
          lte(promotions.startTime, now),
          gte(promotions.endTime, now)
        )
      );

    const activeFlash = activePromotions.filter(p => p.type === 'flash').length;
    const activeCommon = activePromotions.filter(p => p.type === 'common').length;

    const limits = {
      products: {
        current: productCount.length,
        max: 80,
        percentage: Math.round((productCount.length / 80) * 100),
        canAdd: productCount.length < 80
      },
      flashPromotions: {
        current: activeFlash,
        max: 3,
        percentage: Math.round((activeFlash / 3) * 100),
        canAdd: activeFlash < 3
      },
      commonPromotions: {
        current: activeCommon,
        max: 10,
        percentage: Math.round((activeCommon / 10) * 100),
        canAdd: activeCommon < 10
      }
    };

    res.json({ success: true, limits });
  } catch (error: any) {
    console.error('Limits error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug commission (NO AUTH for testing)
router.get("/debug-commission-test", async (req, res) => {
  try {
    const { sql } = await import("drizzle-orm");
    
    // Query commission for test bar
    const commissionResult: any = await db.execute(sql`
      SELECT platform_commission
      FROM business_commissions
      WHERE business_id = 'bar_test_001'
      LIMIT 1
    `);

    const rawResult = commissionResult;
    const firstElement = commissionResult[0];
    const platformCommissionValue = commissionResult[0]?.platform_commission;
    const calculated = platformCommissionValue ? parseFloat(platformCommissionValue) : 30;

    res.json({ 
      success: true,
      businessId: 'bar_test_001',
      rawResult,
      firstElement,
      platformCommissionValue,
      calculated,
      type: typeof platformCommissionValue
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug commission
router.get("/debug-commission", authenticateToken, async (req, res) => {
  try {
    const { sql } = await import("drizzle-orm");
    
    // Get user's business
    const [userBusiness] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);

    if (!userBusiness) {
      return res.json({ error: 'No business found' });
    }

    // Query commission
    const commissionResult: any = await db.execute(sql`
      SELECT platform_commission
      FROM business_commissions
      WHERE business_id = ${userBusiness.id}
      LIMIT 1
    `);

    const rawResult = commissionResult;
    const firstElement = commissionResult[0];
    const platformCommissionValue = commissionResult[0]?.platform_commission;
    const calculated = platformCommissionValue ? parseFloat(platformCommissionValue) : 30;

    res.json({ 
      success: true,
      businessId: userBusiness.id,
      businessName: userBusiness.name,
      rawResult,
      firstElement,
      platformCommissionValue,
      calculated,
      type: typeof platformCommissionValue
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get wallet stats for business owner
router.get("/wallet-stats", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    // Obtener TODOS los negocios del usuario
    const userBusinesses = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id));
    
    if (userBusinesses.length === 0) {
      return res.status(404).json({ error: "Business not found" });
    }

    // Obtener transacciones de TODOS los negocios
    const businessIds = userBusinesses.map(b => b.id);
    const { inArray } = await import("drizzle-orm");
    const allTransactions = await db.select().from(promotionTransactions).where(inArray(promotionTransactions.businessId, businessIds));
    
    console.log(`📊 Wallet Stats Debug:`);
    console.log(`  User: ${req.user!.id}`);
    console.log(`  Total businesses: ${userBusinesses.length}`);
    console.log(`  Business names: ${userBusinesses.map(b => b.name).join(', ')}`);
    console.log(`  Total transactions: ${allTransactions.length}`);
    
    // INGRESOS = pending + redeemed (NO canceladas)
    const paidTransactions = allTransactions.filter(t => t.status === 'pending' || t.status === 'redeemed');
    
    const totalEarnings = paidTransactions.reduce((sum, t) => sum + (Number(t.businessRevenue) || 0), 0);
    const pendingBalance = allTransactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + (Number(t.businessRevenue) || 0), 0);
    const availableBalance = allTransactions.filter(t => t.status === 'redeemed').reduce((sum, t) => sum + (Number(t.businessRevenue) || 0), 0);
    
    console.log(`  Total earnings (centavos): ${totalEarnings}`);
    console.log(`  Pending balance (centavos): ${pendingBalance}`);
    console.log(`  Available balance (centavos): ${availableBalance}`);
    
    // Comisión promedio
    const { sql } = await import("drizzle-orm");
    let platformCommission = 30;

    res.json({
      success: true,
      stats: {
        totalEarnings: totalEarnings,
        pendingBalance: pendingBalance,
        availableBalance: availableBalance,
        platformCommission,
        totalTransactions: paidTransactions.length,
        thisMonthEarnings: totalEarnings,
        pendingPayouts: pendingBalance,
        averageOrderValue: paidTransactions.length > 0 ? (totalEarnings / paidTransactions.length) : 0
      }
    });
  } catch (error: any) {
    console.error('Wallet stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get commission info for business
router.get("/commission-info", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    let [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const { ProgressiveCommissionService } = await import("../progressiveCommissionService");
    const commissionInfo = await ProgressiveCommissionService.getCommissionInfo(business.id);
    
    // Calculate months since registration
    const registrationDate = new Date(business.createdAt);
    const now = new Date();
    const monthsDiff = Math.floor((now.getTime() - registrationDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    res.json({ 
      success: true, 
      commission: commissionInfo,
      businessAge: {
        months: monthsDiff,
        registrationDate: business.createdAt
      }
    });
  } catch (error: any) {
    console.error('Commission info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Payment history endpoint (PROTECTED - debe ir antes de /:id)
router.get("/payment-history", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { filter } = req.query;
    const { sql } = await import("drizzle-orm");
    const userBusinesses = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id));
    if (userBusinesses.length === 0) {
      return res.json({ success: true, transactions: [] });
    }
    const businessIds = userBusinesses.map(b => b.id);
    const { inArray } = await import("drizzle-orm");
    
    let query = sql`
      SELECT 
        pt.id,
        pt.status,
        pt.business_revenue,
        pt.created_at,
        p.title as promotion_title,
        u.name as customer_name,
        b.name as business_name
      FROM promotion_transactions pt
      LEFT JOIN promotions p ON pt.promotion_id = p.id
      LEFT JOIN users u ON pt.user_id = u.id
      LEFT JOIN businesses b ON pt.business_id = b.id
      WHERE pt.business_id IN (${sql.join(businessIds.map(id => sql`${id}`), sql`, `)})
    `;
    
    if (filter === 'sales') {
      query = sql`${query} AND pt.status = 'redeemed'`;
    } else if (filter === 'pending') {
      query = sql`${query} AND pt.status = 'pending'`;
    }
    
    query = sql`${query} ORDER BY pt.created_at DESC`;
    
    const result: any = await db.execute(query);
    const allTransactions = Array.isArray(result[0]) ? result[0] : result;
    
    const mapped = allTransactions.map((t: any) => ({
      id: t.id,
      status: t.status,
      businessRevenue: t.business_revenue || 0,
      createdAt: t.created_at,
      promotionTitle: t.promotion_title || 'Promoción',
      customerName: t.customer_name || 'Cliente',
      businessName: t.business_name || 'Bar'
    }));
    
    res.json({ success: true, transactions: mapped });
  } catch (error: any) {
    console.error('Payment history error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    let [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    // Get products
    const businessProducts = await db.select().from(products).where(eq(products.businessId, business.id));
    
    res.json({ 
      success: true, 
      ...business,
      products: businessProducts
    });
  } catch (error: any) {
    console.error('Get business error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public route to list all businesses
router.get("/", async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    
    const allBusinesses = await db.select().from(businesses).where(eq(businesses.isActive, true));
    
    // Get current time
    const now = new Date();
    const { and, gte, lte, sql: drizzleSql } = await import("drizzle-orm");
    
    // Enrich businesses with real-time data
    const enrichedBusinesses = await Promise.all(
      allBusinesses.map(async (business) => {
        // Count active flash promotions
        const flashPromos = await db
          .select()
          .from(promotions)
          .where(
            and(
              eq(promotions.businessId, business.id),
              eq(promotions.type, 'flash'),
              eq(promotions.isActive, true),
              lte(promotions.startTime, now),
              gte(promotions.endTime, now)
            )
          );
        
        const hasFlashPromo = flashPromos.length > 0;
        const flashPromoCount = flashPromos.length;
        
        // Calculate distance if coordinates provided
        let distance = null;
        if (lat && lng) {
          const R = 6371; // Earth's radius in km
          const dLat = (business.latitude - Number(lat)) * Math.PI / 180;
          const dLon = (business.longitude - Number(lng)) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(Number(lat) * Math.PI / 180) * Math.cos(business.latitude * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          distance = R * c;
        }
        
        // Filter by radius if provided
        if (radius && distance && distance > Number(radius)) {
          return null;
        }
        
        // Determine if opening soon (within 2 hours)
        let openingSoon = false;
        let timeUntilOpen = null;
        
        // TODO: Implement opening hours logic
        // For now, assume isActive means open
        
        return {
          ...business,
          hasFlashPromo,
          flashPromoCount,
          distance,
          openingSoon,
          timeUntilOpen,
          isOpen: business.isActive, // Simplified for MVP
        };
      })
    );
    
    // Filter out nulls (businesses outside radius)
    const filteredBusinesses = enrichedBusinesses.filter(b => b !== null);
    
    res.json({ success: true, businesses: filteredBusinesses });
  } catch (error: any) {
    console.error('List businesses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Featured businesses route (PUBLIC)
router.get("/featured", async (req, res) => {
  try {
    const featuredBusinesses = await db
      .select()
      .from(businesses)
      .where(eq(businesses.isActive, true))
      .limit(10);
    res.json({ success: true, businesses: featuredBusinesses });
  } catch (error: any) {
    console.error('Featured businesses error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public route to get business by ID (DEBE IR AL FINAL)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [business] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    // Get products for this business ONLY
    const businessProducts = await db.select().from(products).where(eq(products.businessId, id));
    
    res.json({ 
      success: true, 
      business: {
        ...business,
        products: businessProducts
      }
    });
  } catch (error: any) {
    console.error('Get business error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create business route
router.post("/create", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { name, description, type, address, phone, image } = req.body;
    const businessId = uuidv4();
    
    const newBusiness = {
      id: businessId,
      name: name || "Mi Bar",
      description: description || "",
      type: type || "bar",
      address: address || "Buenos Aires, Argentina",
      phone: phone || "",
      image: image || "",
      latitude: -34.6037,
      longitude: -58.3816,
      ownerId: req.user!.id,
      isActive: true,
      isVerified: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.insert(businesses).values(newBusiness);
    res.json({ success: true, business: newBusiness });
  } catch (error: any) {
    console.error('Create business error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create product route
router.post("/products", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    let [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    if (!business) return res.status(404).json({ error: "Business not found" });
    
    // Check product limit (80 products per bar)
    const existingProducts = await db.select().from(products).where(eq(products.businessId, business.id));
    if (existingProducts.length >= 80) {
      return res.status(400).json({ error: "Máximo 80 productos por bar. Elimina algunos productos para agregar nuevos." });
    }
    
    const { name, category, price, description, image, isAvailable } = req.body;
    const productId = uuidv4();
    
    const newProduct = {
      id: productId,
      businessId: business.id,
      name: name || "Nuevo Producto",
      category: category || "General",
      price: price || 1000,
      description: description || "",
      image: image,
      isAvailable: isAvailable !== false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.insert(products).values(newProduct);
    res.json({ success: true, product: newProduct });
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update business settings (isOpen toggle)
router.put("/settings", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { isOpen } = req.body;
    
    let [business] = await db.select().from(businesses).where(eq(businesses.ownerId, req.user!.id)).limit(1);
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }
    
    await db.update(businesses).set({ isActive: isOpen, updatedAt: new Date() }).where(eq(businesses.id, business.id));
    
    res.json({ success: true, isOpen });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update business route
router.put("/:id", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, address, phone, image, latitude, longitude } = req.body;
    
    console.log('📝 Update business request:', { id, name, address, latitude, longitude });
    
    // Verificar que el negocio pertenece al usuario
    const [business] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    if (!business || business.ownerId !== req.user!.id) {
      console.error('❌ Permission denied or business not found');
      return res.status(403).json({ error: "No tienes permiso para editar este negocio" });
    }
    
    const updatedBusiness = {
      name,
      description,
      address,
      phone,
      image,
      latitude,
      longitude,
      updatedAt: new Date()
    };
    
    console.log('✅ Updating business with:', updatedBusiness);
    await db.update(businesses).set(updatedBusiness).where(eq(businesses.id, id));
    
    res.json({ success: true, business: updatedBusiness });
  } catch (error: any) {
    console.error('❌ Update business error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update product route
// Update or Create business route (Upsert inteligente para nuevos registros)
router.put("/:id", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { id } = req.params; // Puede venir el ID del usuario, "settings", o un ID vacío desde el celular
    const { name, description, address, phone, image, latitude, longitude } = req.body;
    
    console.log('📝 Procesando datos del bar para el usuario:', req.user!.id);
    
    // 1. Buscamos si este dueño ya tiene un bar creado en la base de datos
    const [existingBusiness] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.ownerId, req.user!.id))
      .limit(1);
    
    // 2. SI NO EXISTE EL BAR (Primer ingreso del dueño después de registrarse) -> LO CREAMOS
    if (!existingBusiness) {
      console.log('✨ No se encontró un bar previo. Creando el negocio por primera vez...');
      
      const [newBusiness] = await db
        .insert(businesses)
        .values({
          ownerId: req.user!.id,
          name: name || "Mi Nuevo Bar", // Nombre por defecto si viene vacío
          description: description || "",
          address: address || "",
          phone: phone || "",
          image: image || "",
          latitude: latitude !== undefined ? parseFloat(latitude) : null,
          longitude: longitude !== undefined ? parseFloat(longitude) : null,
          isActive: true, // Lo dejamos activo por defecto para que aparezca en el mapa
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning(); // Dependiendo de tu config de Drizzle, .returning() nos da el objeto creado

      console.log('✅ Bar creado exitosamente con ID:', newBusiness.id);
      return res.json({ success: true, business: newBusiness, message: "Bar creado correctamente" });
    }
    
    // 3. SI YA EXISTÍA EL BAR -> LO ACTUALIZAMOS (Flujo normal de edición posterior)
    console.log('🔄 El bar ya existe (ID:', existingBusiness.id, '). Actualizando datos...');
    
    const updatedBusiness = {
      name: name || existingBusiness.name,
      description: description || existingBusiness.description,
      address: address || existingBusiness.address,
      phone: phone || existingBusiness.phone,
      image: image || existingBusiness.image,
      latitude: latitude !== undefined ? parseFloat(latitude) : existingBusiness.latitude,
      longitude: longitude !== undefined ? parseFloat(longitude) : existingBusiness.longitude,
      updatedAt: new Date()
    };
    
    await db
      .update(businesses)
      .set(updatedBusiness)
      .where(eq(businesses.id, existingBusiness.id));
    
    return res.json({ success: true, business: updatedBusiness, message: "Bar actualizado correctamente" });

  } catch (error: any) {
    console.error('❌ Error en el guardado/creación del bar:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Delete product route
router.delete("/products/:id", authenticateToken, requireRole("business_owner"), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar que el producto pertenece al negocio del usuario
    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    
    const [business] = await db.select().from(businesses).where(eq(businesses.id, product.businessId)).limit(1);
    if (!business || business.ownerId !== req.user!.id) {
      return res.status(403).json({ error: "No tienes permiso para eliminar este producto" });
    }
    
    await db.delete(products).where(eq(products.id, id));
    res.json({ success: true, message: "Producto eliminado" });
  } catch (error: any) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get full menu of a business (PUBLIC)
router.get("/:id/menu", async (req, res) => {
  try {
    const { id } = req.params;
    const [business] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    // Get all products grouped by category
    const allProducts = await db.select().from(products).where(eq(products.businessId, id));
    
    // Group by category
    const menuByCategory: Record<string, any[]> = {};
    allProducts.forEach(product => {
      const category = product.category || 'Otros';
      if (!menuByCategory[category]) {
        menuByCategory[category] = [];
      }
      menuByCategory[category].push(product);
    });

    res.json({ 
      success: true, 
      business: {
        id: business.id,
        name: business.name,
        address: business.address,
        phone: business.phone
      },
      menu: menuByCategory,
      totalProducts: allProducts.length
    });
  } catch (error: any) {
    console.error('Get menu error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get future promotions for a business (PUBLIC)
router.get("/:id/future-promotions", async (req, res) => {
  try {
    const { id } = req.params;
    const [business] = await db.select().from(businesses).where(eq(businesses.id, id)).limit(1);
    
    if (!business) {
      return res.status(404).json({ error: "Business not found" });
    }

    const now = new Date();
    const { and, gte } = await import("drizzle-orm");
    
    // Get promotions that start in the future
    const futurePromotions = await db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.businessId, id),
          eq(promotions.isActive, true),
          gte(promotions.startTime, now)
        )
      )
      .orderBy(promotions.startTime);

    res.json({ 
      success: true, 
      promotions: futurePromotions,
      total: futurePromotions.length
    });
  } catch (error: any) {
    console.error('Get future promotions error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router
