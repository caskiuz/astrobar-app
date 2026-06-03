import express from "express";
import { authenticateToken, requireRole } from "../authMiddleware";
import { isFeatureEnabled } from "@shared/featureFlags";
import { 
  generateReferralCode, 
  registerReferral, 
  completeReferral 
} from "../services/referralService";
import { 
  trackDemandEvent, 
  getHeatmapData, 
  generateBarRecommendations 
} from "../services/demandService";
import { 
  createScheduledPromotion, 
  activateScheduledPromotion 
} from "../services/scheduledPromotionService";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = express.Router();

// ============================================
// MÓDULO 8: SISTEMA DE REFERIDOS
// ============================================

// Generar código de referido
router.post("/referrals/generate", authenticateToken, async (req, res) => {
  if (!isFeatureEnabled('REFERRAL_SYSTEM')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const code = await generateReferralCode(req.user!.id);
    res.json({ success: true, code, link: `${process.env.FRONTEND_URL}/register?ref=${code}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener mis referidos (BLINDADO CONTRA UNDEFINED)
router.get("/referrals/my", authenticateToken, async (req, res) => {
  if (!isFeatureEnabled('REFERRAL_SYSTEM')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    console.log('📊 Fetching referrals for user:', req.user!.id);
    
    // Primero verificar si el usuario tiene código de referido de forma segura
    const resultCodes: any = await db.execute(sql`
      SELECT * FROM referral_codes WHERE user_id = ${req.user!.id}
    `);
    
    // Validamos la respuesta nativa de mysql2
    const codes = resultCodes && Array.isArray(resultCodes[0]) ? resultCodes[0] : (Array.isArray(resultCodes) ? resultCodes : []);
    console.log('Codes found:', codes);

    // Buscamos los referidos de forma segura
    const resultReferrals: any = await db.execute(sql`
      SELECT r.*, u.name as referred_name, u.email as referred_email
      FROM referrals r
      LEFT JOIN users u ON r.referred_id = u.id
      WHERE r.referrer_id = ${req.user!.id}
      ORDER BY r.created_at DESC
    `);
    
    const referrals = resultReferrals && Array.isArray(resultReferrals[0]) ? resultReferrals[0] : (Array.isArray(resultReferrals) ? resultReferrals : []);
    console.log('Referrals found:', referrals);

    // Blindamos las estadísticas para evitar el crash del map/length en frontend
    const stats = codes && codes.length > 0 ? codes[0] : {
      total_referrals: 0,
      successful_referrals: 0,
      total_earned: 0
    };

    console.log('✅ Returning:', { referrals: referrals?.length, stats });
    res.json({ success: true, referrals, stats });
  } catch (error: any) {
    console.error('❌ Error fetching referrals:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MÓDULO 9: MAPA DE DEMANDA
// ============================================

// Obtener mapa de calor
router.get("/demand/heatmap", authenticateToken, requireRole("business_owner", "admin"), async (req, res) => {
  if (!isFeatureEnabled('DEMAND_HEATMAP')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const heatmap = await getHeatmapData();
    res.json({ success: true, heatmap });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener recomendaciones para mi bar
router.get("/demand/recommendations", authenticateToken, requireRole("business_owner"), async (req, res) => {
  if (!isFeatureEnabled('DEMAND_HEATMAP')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const [business] = await db.execute(sql`
      SELECT id FROM businesses WHERE owner_id = ${req.user!.id} LIMIT 1
    `);

    if (!business || !Array.isArray(business) || business.length === 0) {
      return res.status(404).json({ error: "Bar no encontrado" });
    }

    const businessId = (business[0] as any).id;

    const [recommendations] = await db.execute(sql`
      SELECT * FROM bar_recommendations
      WHERE business_id = ${businessId}
      ORDER BY priority DESC, created_at DESC
    `);

    res.json({ success: true, recommendations: recommendations || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MÓDULO 11: CONTENIDO MULTIMEDIA
// ============================================

// Obtener videos
router.get("/videos", async (req, res) => {
  if (!isFeatureEnabled('MULTIMEDIA_CONTENT')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const { type } = req.query;
    
    let query = sql`SELECT * FROM videos WHERE is_active = 1`;
    if (type) {
      query = sql`SELECT * FROM videos WHERE is_active = 1 AND video_type = ${type as string}`;
    }

    const [videos] = await db.execute(query);
    res.json({ success: true, videos: videos || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MÓDULO 12: LINKS DE INVITACIÓN
// ============================================

// Crear link de invitation
router.post("/invitation-links", authenticateToken, async (req, res) => {
  if (!isFeatureEnabled('INVITATION_LINKS')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const { linkType, videoUrl } = req.body;
    const shortCode = Math.random().toString(36).substring(2, 10);
    const fullUrl = `${process.env.FRONTEND_URL}/invite/${shortCode}`;

    await db.execute(sql`
      INSERT INTO invitation_links (id, user_id, link_type, short_code, full_url, video_url)
      VALUES (UUID(), ${req.user!.id}, ${linkType}, ${shortCode}, ${fullUrl}, ${videoUrl || null})
    `);

    res.json({ success: true, link: fullUrl, shortCode });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MÓDULO 13: MENSAJES DINÁMICOS
// ============================================

// Obtener mensajes del sistema
router.get("/messages", async (req, res) => {
  if (!isFeatureEnabled('DYNAMIC_MESSAGES')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const { context } = req.query;

    const [messages] = await db.execute(sql`
      SELECT * FROM system_messages
      WHERE is_active = 1
      AND display_context = ${context as string}
      ORDER BY priority DESC
      LIMIT 1
    `);

    res.json({ success: true, message: messages?.[0] || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MÓDULO 14: RANKING DE BARES
// ============================================

// Obtener ranking de bares
router.get("/bar-rankings", async (req, res) => {
  if (!isFeatureEnabled('BAR_RANKING')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    console.log('📊 Fetching bar rankings...');
    const [rankings] = await db.execute(sql`
      SELECT 
        b.id as business_id,
        b.name as business_name,
        'bronze' as current_level,
        999 as rank_position,
        0 as score,
        COUNT(DISTINCT pt.id) as total_transactions,
        COALESCE(SUM(pt.amount_paid), 0) as total_revenue
      FROM businesses b
      LEFT JOIN promotion_transactions pt ON b.id = pt.business_id
        AND pt.status IN ('paid', 'redeemed')
        AND DATE_FORMAT(pt.created_at, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')
      WHERE b.is_active = 1
      GROUP BY b.id, b.name
      ORDER BY total_revenue DESC, total_transactions DESC
      LIMIT 10
    `);

    console.log('✅ Rankings fetched:', rankings);
    res.json({ success: true, rankings: rankings || [] });
  } catch (error: any) {
    console.error('❌ Error fetching rankings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obtener mi progreso (bar)
router.get("/bar-progress/my", authenticateToken, requireRole("business_owner"), async (req, res) => {
  if (!isFeatureEnabled('BAR_RANKING')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const [business] = await db.execute(sql`
      SELECT id FROM businesses WHERE owner_id = ${req.user!.id} LIMIT 1
    `);

    if (!business || !Array.isArray(business) || business.length === 0) {
      return res.status(404).json({ error: "Bar no encontrado" });
    }

    const businessId = (business[0] as any).id;

    const [progress] = await db.execute(sql`
      SELECT bp.*, bl.level_name, bl.benefits, bl.commission_discount
      FROM bar_progress bp
      LEFT JOIN bar_levels bl ON bp.current_level = bl.level_name
      WHERE bp.business_id = ${businessId}
    `);

    res.json({ success: true, progress: progress?.[0] || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MÓDULO 15: PROMOCIONES PROGRAMADAS
// ============================================

// Crear promoción programada
router.post("/scheduled-promotions", authenticateToken, requireRole("business_owner"), async (req, res) => {
  if (!isFeatureEnabled('SCHEDULED_PROMOS')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const [business] = await db.execute(sql`
      SELECT id FROM businesses WHERE owner_id = ${req.user!.id} LIMIT 1
    `);

    if (!business || !Array.isArray(business) || business.length === 0) {
      return res.status(404).json({ error: "Bar no encontrado" });
    }

    const businessId = (business[0] as any).id;

    const id = await createScheduledPromotion({
      businessId,
      ...req.body
    });

    res.json({ success: true, id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Listar mis promociones programadas
router.get("/scheduled-promotions/my", authenticateToken, requireRole("business_owner"), async (req, res) => {
  if (!isFeatureEnabled('SCHEDULED_PROMOS')) {
    return res.status(403).json({ error: "Módulo no disponible" });
  }

  try {
    const [business] = await db.execute(sql`
      SELECT id FROM businesses WHERE owner_id = ${req.user!.id} LIMIT 1
    `);

    if (!business || !Array.isArray(business) || business.length === 0) {
      return res.status(404).json({ error: "Bar no encontrado" });
    }

    const businessId = (business[0] as any).id;

    const [scheduled] = await db.execute(sql`
      SELECT * FROM scheduled_promotions
      WHERE business_id = ${businessId}
      ORDER BY next_activation ASC
    `);

    res.json({ success: true, promotions: scheduled || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;