import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useBusiness } from "@/contexts/BusinessContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type Period = "today" | "week" | "month";

interface StatsData {
  revenue: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    avgValue: number;
  };
  topProducts: {
    name: string;
    quantity: number;
    revenue: number;
  }[];
}

interface DashboardData {
  pendingOrders: number;
  todayOrders: number;
  todayRevenue: number;
  recentOrders: any[];
  activePromotions?: {
    total: number;
    flash: number;
    common: number;
    flashList: any[];
    commonList: any[];
  };
  platformCommission?: number;
  limits?: {
    products: { current: number; max: number; percentage: number; canAdd: boolean };
    flashPromotions: { current: number; max: number; percentage: number; canAdd: boolean };
    commonPromotions: { current: number; max: number; percentage: number; canAdd: boolean };
  };
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  color = AstroBarColors.primary,
  delay = 0,
}: {
  icon: string;
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
  delay?: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeInRight.delay(delay).springify()}
      style={[styles.statCard, { backgroundColor: theme.card }, Shadows.sm]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={18} color={color} />
      </View>
      <ThemedText type="h3" style={{ fontSize: 20 }}>{value}</ThemedText>
      <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: 'center' }}>
        {label}
      </ThemedText>
      {subtext ? (
        <ThemedText type="small" style={{ color, marginTop: 2 }}>
          {subtext}
        </ThemedText>
      ) : null}
    </Animated.View>
  );
}

function TopProductRow({
  product,
  index,
}: {
  product: { name: string; quantity: number; revenue: number };
  index: number;
}) {
  const { theme } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={[styles.productRow, { backgroundColor: theme.card }, Shadows.sm]}
    >
      <View style={[styles.rankBadge, { backgroundColor: AstroBarColors.primary + "20" }]}>
        <ThemedText type="h4" style={{ color: AstroBarColors.primary }}>
          {index + 1}
        </ThemedText>
      </View>
      <View style={styles.productInfo}>
        <ThemedText type="body" style={{ fontWeight: "600" }} numberOfLines={1}>
          {product.name}
        </ThemedText>
        <ThemedText type="caption" style={{ color: theme.textSecondary }}>
          {product.quantity} vendidos
        </ThemedText>
      </View>
      <View style={styles.revenueCol}>
        <ThemedText type="body" style={{ fontWeight: "600", color: "#4CAF50" }}>
          ${product.revenue.toFixed(2)}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

export default function BusinessDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { businesses, selectedBusiness } = useBusiness();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const [isOpen, setIsOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("week");
  
  const [dashboard, setDashboard] = useState<DashboardData>({
    pendingOrders: 0,
    todayOrders: 0,
    todayRevenue: 0,
    recentOrders: [],
    activePromotions: { total: 0, flash: 0, common: 0, flashList: [], commonList: [] },
    platformCommission: 30
  });
  
  const [stats, setStats] = useState<StatsData>({
    revenue: { today: 0, week: 0, month: 0, total: 0 },
    orders: { total: 0, completed: 0, cancelled: 0, avgValue: 0 },
    topProducts: [],
  });

  const loadData = async () => {
    try {
      const businessId = selectedBusiness?.id;
      const dashboardUrl = businessId ? `/api/business/dashboard?businessId=${businessId}` : "/api/business/dashboard";
      const statsUrl = businessId ? `/api/business/stats?businessId=${businessId}` : "/api/business/stats";
      
      const [dashboardRes, statsRes, limitsRes] = await Promise.all([
        apiRequest("GET", dashboardUrl),
        apiRequest("GET", statsUrl),
        apiRequest("GET", "/api/business/limits"),
      ]);
      
      const dashboardData = await dashboardRes.json();
      const statsData = await statsRes.json();
      const limitsData = await limitsRes.json();
      
      if (dashboardData.success) {
        setDashboard({
          pendingOrders: dashboardData.dashboard.pendingOrders || 0,
          todayOrders: dashboardData.dashboard.todayOrders || 0,
          todayRevenue: dashboardData.dashboard.todayRevenue || 0,
          recentOrders: dashboardData.dashboard.recentOrders || [],
          activePromotions: dashboardData.dashboard.activePromotions || { total: 0, flash: 0, common: 0, flashList: [], commonList: [] },
          platformCommission: dashboardData.dashboard.platformCommission || 30,
          limits: limitsData.limits || null
        });
        setIsOpen(dashboardData.dashboard.isOpen ?? true);
      }
      
      if (statsData.success) {
        setStats({
          revenue: statsData.revenue || { today: 0, week: 0, month: 0, total: 0 },
          orders: statsData.orders || { total: 0, completed: 0, cancelled: 0, avgValue: 0 },
          topProducts: statsData.topProducts || [],
        });
      }
    } catch (error) {
      console.error("Error loading dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (selectedBusiness) {
        loadData();
      }
    }, [selectedBusiness])
  );

  useEffect(() => {
    if (!selectedBusiness) return;
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [selectedBusiness]);

  useEffect(() => {
    if (dashboard.pendingOrders > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [dashboard.pendingOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleBusinessStatus = async () => {
    try {
      await apiRequest("PUT", "/api/business/settings", { isOpen: !isOpen });
      setIsOpen(!isOpen);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Error toggling status:", error);
    }
  };

  const periodLabels: Record<Period, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
  };

  const getRevenueForPeriod = () => {
    const revenue = {
      today: stats.revenue.today || 0,
      week: stats.revenue.week || 0,
      month: stats.revenue.month || 0
    };
    return revenue[selectedPeriod] || 0;
  };

  const completionRate = stats.orders.total > 0
    ? Math.round((stats.orders.completed / stats.orders.total) * 100)
    : 100;

  const getStatusTranslation = (status: string) => {
    const translations: Record<string, string> = {
      pending: "Pendiente",
      confirmed: "Confirmado",
      preparing: "Preparando",
      ready: "Listo",
      picked_up: "Recogido",
      on_the_way: "En camino",
      delivered: "Entregado",
      cancelled: "Cancelado",
    };
    return translations[status] || status;
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={AstroBarColors.primary} />
          <ThemedText style={{ marginTop: Spacing.md }}>Cargando dashboard...</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={AstroBarColors.primary} />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h2">Dashboard</ThemedText>
            {businesses.length > 1 ? (
              <Pressable
                style={styles.businessSelector}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("MyBusinesses");
                }}
              >
                <ThemedText type="caption" style={{ color: AstroBarColors.primary }}>
                  {selectedBusiness?.name || "Seleccionar negocio"}
                </ThemedText>
                <Feather name="chevron-down" size={14} color={AstroBarColors.primary} />
              </Pressable>
            ) : (
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                {selectedBusiness?.name || "Panel de control"}
              </ThemedText>
            )}
          </View>
          <View style={styles.statusToggle}>
            <ThemedText type="small" style={{ marginRight: Spacing.sm, color: isOpen ? "#4CAF50" : theme.textSecondary }}>
              {isOpen ? "Abierto" : "Cerrado"}
            </ThemedText>
            <Switch
              value={isOpen}
              onValueChange={toggleBusinessStatus}
              trackColor={{ false: "#767577", true: "#4CAF50" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Animated.View
          entering={FadeInDown.springify()}
          style={[styles.revenueCard, { backgroundColor: "#4CAF50" }, Shadows.lg]}
        >
          <ThemedText type="body" style={{ color: "rgba(255,255,255,0.8)" }}>
            Ingresos - {periodLabels[selectedPeriod]}
          </ThemedText>
          <ThemedText type="h1" style={{ color: "#FFFFFF", fontSize: 38, marginVertical: Spacing.sm }}>
            ${getRevenueForPeriod().toFixed(2)}
          </ThemedText>

          <View style={styles.periodSelector}>
            {(["today", "week", "month"] as Period[]).map((period) => (
              <Pressable
                key={period}
                onPress={() => {
                  setSelectedPeriod(period);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.periodButton,
                  { backgroundColor: selectedPeriod === period ? "#FFFFFF" : "rgba(255,255,255,0.2)" },
                ]}
              >
                <ThemedText
                  type="small"
                  style={{ color: selectedPeriod === period ? "#4CAF50" : "#FFFFFF", fontWeight: "600" }}
                >
                  {periodLabels[period]}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          <View style={styles.totalRevenue}>
            <ThemedText type="small" style={{ color: "rgba(255,255,255,0.7)" }}>
              Ingresos totales: ${stats.revenue.total.toFixed(2)}
            </ThemedText>
          </View>
        </Animated.View>

        <ThemedText type="h3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
          Resumen de Pedidos
        </ThemedText>
        <View style={styles.statsGrid}>
          <StatCard icon="shopping-bag" label="Totales" value={stats.orders.total} delay={0} />
          <StatCard
            icon="check-circle"
            label="Completados"
            value={stats.orders.completed}
            subtext={`${completionRate}% exito`}
            color="#4CAF50"
            delay={50}
          />
          <StatCard
            icon="clock"
            label="Pendientes"
            value={dashboard.pendingOrders}
            color={dashboard.pendingOrders > 0 ? AstroBarColors.warning : theme.textSecondary}
            delay={100}
          />
          <StatCard
            icon="x-circle"
            label="Cancelados"
            value={stats.orders.cancelled}
            color={AstroBarColors.error}
            delay={150}
          />
        </View>

        <View style={styles.avgCard}>
          <Feather name="trending-up" size={20} color={AstroBarColors.primary} />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Ticket promedio</ThemedText>
            <ThemedText type="h3">${(stats.orders.avgValue || 0).toFixed(2)}</ThemedText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Pedidos hoy</ThemedText>
            <ThemedText type="h3">{dashboard.todayOrders}</ThemedText>
          </View>
        </View>

        <View style={[styles.commissionCard, { backgroundColor: theme.card }, Shadows.sm]}>
          <Feather name="percent" size={20} color="#FF9800" />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Comision de plataforma</ThemedText>
            <ThemedText type="h3" style={{ color: "#FF9800" }}>{dashboard.platformCommission?.toFixed(1)}%</ThemedText>
          </View>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>adicional al precio</ThemedText>
        </View>

        {dashboard.activePromotions && dashboard.activePromotions.total > 0 && (
          <View style={[styles.promotionsCard, { backgroundColor: theme.card }, Shadows.sm]}>
            <View style={styles.promotionsHeader}>
              <ThemedText type="h3">Promociones Activas</ThemedText>
              <Badge label={`${dashboard.activePromotions.total}`} color={AstroBarColors.primary} />
            </View>
            <View style={styles.promotionsRow}>
              <View style={styles.promoType}>
                <Feather name="zap" size={16} color="#FFD700" />
                <ThemedText type="small" style={{ marginLeft: 4 }}>Flash: {dashboard.activePromotions.flash}/3</ThemedText>
              </View>
              <View style={styles.promoType}>
                <Feather name="tag" size={16} color={AstroBarColors.primary} />
                <ThemedText type="small" style={{ marginLeft: 4 }}>Comunes: {dashboard.activePromotions.common}/10</ThemedText>
              </View>
            </View>
            {dashboard.activePromotions.flashList.length > 0 && (
              <View style={{ marginTop: Spacing.sm }}>
                {dashboard.activePromotions.flashList.map((promo: any) => (
                  <View key={promo.id} style={styles.promoItem}>
                    <Feather name="zap" size={14} color="#FFD700" />
                    <ThemedText type="small" style={{ marginLeft: 6, flex: 1 }} numberOfLines={1}>{promo.title}</ThemedText>
                    <ThemedText type="small" style={{ color: promo.stock < 5 ? AstroBarColors.error : theme.textSecondary }}>Stock: {promo.stock}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {dashboard.limits && (
          <View style={[styles.limitsCard, { backgroundColor: theme.card }, Shadows.sm]}>
            <View style={styles.limitsHeader}>
              <Feather name="alert-circle" size={20} color={AstroBarColors.warning} />
              <ThemedText type="h4" style={{ marginLeft: 8 }}>Limites del Sistema</ThemedText>
            </View>
            
            <View style={styles.limitItem}>
              <View style={{ flex: 1 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Productos</ThemedText>
                <ThemedText type="body">{dashboard.limits.products.current}/{dashboard.limits.products.max}</ThemedText>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={[styles.progressFill, { 
                  width: `${dashboard.limits.products.percentage}%`,
                  backgroundColor: dashboard.limits.products.percentage >= 90 ? AstroBarColors.error : dashboard.limits.products.percentage >= 70 ? AstroBarColors.warning : AstroBarColors.primary
                }]} />
              </View>
              {dashboard.limits.products.percentage >= 90 && (
                <ThemedText type="small" style={{ color: AstroBarColors.error, marginTop: 4 }}>¡Casi al limite!</ThemedText>
              )}
            </View>

            <View style={styles.limitItem}>
              <View style={{ flex: 1 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Promociones Flash</ThemedText>
                <ThemedText type="body">{dashboard.limits.flashPromotions.current}/{dashboard.limits.flashPromotions.max}</ThemedText>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={[styles.progressFill, { 
                  width: `${dashboard.limits.flashPromotions.percentage}%`,
                  backgroundColor: dashboard.limits.flashPromotions.percentage >= 90 ? AstroBarColors.error : AstroBarColors.primary
                }]} />
              </View>
            </View>

            <View style={styles.limitItem}>
              <View style={{ flex: 1 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Promociones Comunes</ThemedText>
                <ThemedText type="body">{dashboard.limits.commonPromotions.current}/{dashboard.limits.commonPromotions.max}</ThemedText>
              </View>
              <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={[styles.progressFill, { 
                  width: `${dashboard.limits.commonPromotions.percentage}%`,
                  backgroundColor: dashboard.limits.commonPromotions.percentage >= 90 ? AstroBarColors.error : AstroBarColors.primary
                }]} />
              </View>
            </View>
          </View>
        )}

        {stats.topProducts.length > 0 ? (
          <>
            <ThemedText type="h3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }}>
              Productos Mas Vendidos
            </ThemedText>
            {stats.topProducts.map((product, index) => (
              <TopProductRow key={index} product={product} index={index} />
            ))}
          </>
        ) : null}

        {dashboard.recentOrders.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3">Pedidos Recientes</ThemedText>
              <Pressable onPress={() => {}}>
                <ThemedText type="small" style={{ color: AstroBarColors.primary }}>Ver todos</ThemedText>
              </Pressable>
            </View>
            {dashboard.recentOrders.slice(0, 5).map((order: any, index: number) => (
              <Animated.View
                key={order.id}
                entering={FadeInDown.delay(index * 50).springify()}
                style={[styles.orderCard, { backgroundColor: theme.card }, Shadows.sm]}
              >
                <View style={styles.orderHeader}>
                  <ThemedText type="body" style={{ fontWeight: "600" }}>
                    Pedido #{order.id?.slice(-6) || index}
                  </ThemedText>
                  <Badge
                    label={getStatusTranslation(order.status)}
                    color={order.status === "delivered" ? "#4CAF50" : order.status === "cancelled" ? AstroBarColors.error : AstroBarColors.primary}
                  />
                </View>
                <View style={styles.orderDetails}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                    {order.customerName || "Cliente"}
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "600", color: AstroBarColors.primary }}>
                    ${(order.subtotal || 0).toFixed(2)}
                  </ThemedText>
                </View>
              </Animated.View>
            ))}
          </>
        ) : null}

        <View style={styles.quickActions}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.sm }}>Acciones Rapidas</ThemedText>
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate("BusinessManagement", { screen: "BusinessPromotions" })}
            >
              <Feather name="zap" size={24} color={AstroBarColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs }}>Promociones</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.card }]}
              onPress={() => navigation.navigate("BusinessProfile" as any)}
            >
              <Feather name="settings" size={24} color={AstroBarColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs }}>Ajustes</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  statusToggle: {
    flexDirection: "row",
    alignItems: "center",
  },
  businessSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  revenueCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: "center",
  },
  periodSelector: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  periodButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  totalRevenue: {
    marginTop: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  statCard: {
    width: "48%",
    flexGrow: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  avgCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  revenueCol: {
    alignItems: "flex-end",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  orderCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  quickActions: {
    marginTop: Spacing.xl,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    ...Shadows.sm,
  },
  commissionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  promotionsCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  promotionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  promotionsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  promoType: {
    flexDirection: "row",
    alignItems: "center",
  },
  promoItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  limitsCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  limitsHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  limitItem: {
    marginBottom: Spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
});
