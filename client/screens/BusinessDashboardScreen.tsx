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
  const isDark = theme.background === "#000000" || theme.background === "black" || theme.background === "#121212";

  return (
    <Animated.View
      entering={FadeInRight.delay(delay).springify()}
      style={[
        styles.statCard, 
        { 
          backgroundColor: isDark ? '#111927' : theme.card,
          borderColor: isDark ? color + "40" : 'transparent',
          borderWidth: isDark ? 1 : 0
        }, 
        Shadows.sm
      ]}
    >
      <View style={[styles.statIcon, { backgroundColor: color + "15" }]}>
        <Feather name={icon as any} size={16} color={color} />
      </View>
      <ThemedText type="h3" style={{ fontSize: 22, fontWeight: '800' }}>{value}</ThemedText>
      <ThemedText type="caption" style={{ color: isDark ? '#94a3b8' : theme.textSecondary, textAlign: 'center', fontWeight: '600', marginTop: 2 }}>
        {label}
      </ThemedText>
      {subtext ? (
        <ThemedText type="small" style={{ color, marginTop: 4, fontWeight: '700', fontSize: 11 }}>
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
  const isDark = theme.background === "#000000" || theme.background === "black" || theme.background === "#121212";

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      style={[
        styles.productRow, 
        { 
          backgroundColor: isDark ? '#111927' : theme.card,
          borderColor: isDark ? '#1e293b' : 'transparent',
          borderWidth: isDark ? 1 : 0
        }, 
        Shadows.sm
      ]}
    >
      <View style={[styles.rankBadge, { backgroundColor: (isDark ? '#00f2fe' : AstroBarColors.primary) + "15" }]}>
        <ThemedText type="h4" style={{ color: isDark ? '#00f2fe' : AstroBarColors.primary, fontWeight: '800' }}>
          #{index + 1}
        </ThemedText>
      </View>
      <View style={styles.productInfo}>
        <ThemedText type="body" style={{ fontWeight: "700" }} numberOfLines={1}>
          {product.name}
        </ThemedText>
        <ThemedText type="caption" style={{ color: isDark ? '#94a3b8' : theme.textSecondary, fontWeight: '500' }}>
          {product.quantity} unidades vendidas
        </ThemedText>
      </View>
      <View style={styles.revenueCol}>
        <ThemedText type="body" style={{ fontWeight: "800", color: "#39ff14" }}>
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

  const isDark = theme.background === "#000000" || theme.background === "black" || theme.background === "#121212";

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
    if (selectedBusiness) {
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
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

  // Paleta AstroBar Comercial unificada
  const bgContainer = isDark ? '#0b111e' : '#f5f5f5'; 
  const bgSurface = isDark ? '#111927' : '#ffffff';   
  const bgElement = isDark ? '#1f293d' : '#f5f5f5';   
  const textTitle = isDark ? '#ffffff' : '#333333';
  const textSub = isDark ? '#94a3b8' : '#666666';
  const borderStyle = isDark ? '#1e293b' : '#f0f0f0';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: bgContainer }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AstroBarColors.primary} />
          <ThemedText style={{ marginTop: Spacing.md, color: textTitle }}>Cargando panel comercial...</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bgContainer }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={isDark ? '#00f2fe' : AstroBarColors.primary} />
        }
      >
        {/* 🏪 HEADER Y CONTROL DE APERTURA */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <ThemedText type="h2" style={{ color: textTitle, fontWeight: '800' }}>Dashboard</ThemedText>
            {businesses.length > 1 ? (
              <Pressable
                style={styles.businessSelector}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("MyBusinesses");
                }}
              >
                <ThemedText type="caption" style={{ color: isDark ? '#00f2fe' : AstroBarColors.primary, fontWeight: '700' }}>
                  {selectedBusiness?.name || "Seleccionar negocio"}
                </ThemedText>
                <Feather name="chevron-down" size={13} color={isDark ? '#00f2fe' : AstroBarColors.primary} />
              </Pressable>
            ) : (
              <ThemedText type="caption" style={{ color: textSub, fontWeight: '600' }}>
                {selectedBusiness?.name || "Panel de control"}
              </ThemedText>
            )}
          </View>
          <View style={[styles.statusToggle, { backgroundColor: bgSurface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }]}>
            <ThemedText type="small" style={{ marginRight: Spacing.xs, color: isOpen ? "#39ff14" : textSub, fontWeight: '700' }}>
              {isOpen ? "Abierto" : "Cerrado"}
            </ThemedText>
            <Switch
              value={isOpen}
              onValueChange={toggleBusinessStatus}
              trackColor={{ false: "#4b5563", true: isDark ? '#143a1e' : "#4CAF50" }}
              thumbColor={isOpen ? "#39ff14" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* 💰 TARJETA DE INGRESOS CORREGIDA (DEGRADADO PREMIUM EN MODO OSCURO) */}
        <Animated.View entering={FadeInDown.springify()}>
          <LinearGradient
            colors={isDark ? ['#13223f', '#0a0f1d'] : ['#4CAF50', '#388E3C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.revenueCard, { borderColor: isDark ? '#00f2fe50' : 'transparent', borderWidth: isDark ? 1 : 0 }, Shadows.lg]}
          >
            <ThemedText type="body" style={{ color: isDark ? '#94a3b8' : "rgba(255,255,255,0.85)", fontWeight: '600' }}>
              Caja - {periodLabels[selectedPeriod]}
            </ThemedText>
            <ThemedText type="h1" style={{ color: isDark ? '#39ff14' : "#FFFFFF", fontSize: 36, marginVertical: Spacing.xs, fontWeight: '900', letterSpacing: 0.5 }}>
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
                    { backgroundColor: selectedPeriod === period ? (isDark ? '#00f2fe' : "#FFFFFF") : "rgba(255,255,255,0.12)" },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={{ color: selectedPeriod === period ? (isDark ? '#0b111e' : "#4CAF50") : "#FFFFFF", fontWeight: "700" }}
                  >
                    {periodLabels[period]}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <View style={styles.totalRevenue}>
              <ThemedText type="small" style={{ color: isDark ? '#64748b' : "rgba(255,255,255,0.7)", fontWeight: '600' }}>
                Histórico acumulado: ${stats.revenue.total.toFixed(2)}
              </ThemedText>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* 📊 RESUMEN DE PEDIDOS */}
        <ThemedText type="h3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm, color: textTitle, fontWeight: '700' }}>
          Monitoreo de Pedidos
        </ThemedText>
        <View style={styles.statsGrid}>
          <StatCard icon="shopping-bag" label="Totales" value={stats.orders.total} color={isDark ? '#00f2fe' : AstroBarColors.primary} delay={0} />
          <StatCard
            icon="check-circle"
            label="Completados"
            value={stats.orders.completed}
            subtext={`${completionRate}% éxito`}
            color="#39ff14"
            delay={50}
          />
          <StatCard
            icon="clock"
            label="Pendientes"
            value={dashboard.pendingOrders}
            color={dashboard.pendingOrders > 0 ? "#ff9f43" : textSub}
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

        {/* TICKET PROMEDIO Y COMISIÓN */}
        <View style={[styles.avgCard, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.sm]}>
          <Feather name="trending-up" size={18} color={isDark ? '#39ff14' : AstroBarColors.primary} />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <ThemedText type="caption" style={{ color: textSub, fontWeight: '600' }}>Ticket promedio</ThemedText>
            <ThemedText type="h3" style={{ color: textTitle, fontWeight: '800', fontSize: 18 }}>${(stats.orders.avgValue || 0).toFixed(2)}</ThemedText>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <ThemedText type="caption" style={{ color: textSub, fontWeight: '600' }}>Pedidos hoy</ThemedText>
            <ThemedText type="h3" style={{ color: textTitle, fontWeight: '800', fontSize: 18 }}>{dashboard.todayOrders}</ThemedText>
          </View>
        </View>

        <View style={[styles.commissionCard, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.sm]}>
          <Feather name="percent" size={18} color="#ff9f43" />
          <View style={{ marginLeft: Spacing.md, flex: 1 }}>
            <ThemedText type="caption" style={{ color: textSub, fontWeight: '600' }}>Comisión de plataforma</ThemedText>
            <ThemedText type="h3" style={{ color: "#ff9f43", fontWeight: '800', fontSize: 18 }}>{dashboard.platformCommission?.toFixed(1)}%</ThemedText>
          </View>
          <ThemedText type="small" style={{ color: textSub, fontWeight: '500' }}>adicional al precio</ThemedText>
        </View>

        {/* 🔥 PROMOCIONES ACTIVAS */}
        {dashboard.activePromotions && dashboard.activePromotions.total > 0 && (
          <View style={[styles.promotionsCard, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.sm]}>
            <View style={styles.promotionsHeader}>
              <ThemedText type="h3" style={{ color: textTitle, fontWeight: '700' }}>Promociones Activas</ThemedText>
              <Badge label={`${dashboard.activePromotions.total}`} color={isDark ? '#00f2fe' : AstroBarColors.primary} />
            </View>
            <View style={styles.promotionsRow}>
              <View style={styles.promoType}>
                <Feather name="zap" size={15} color="#fed330" />
                <ThemedText type="small" style={{ marginLeft: 4, color: textTitle, fontWeight: '600' }}>Flash: {dashboard.activePromotions.flash}/3</ThemedText>
              </View>
              <View style={styles.promoType}>
                <Feather name="tag" size={15} color={isDark ? '#00f2fe' : AstroBarColors.primary} />
                <ThemedText type="small" style={{ marginLeft: 4, color: textTitle, fontWeight: '600' }}>Comunes: {dashboard.activePromotions.common}/10</ThemedText>
              </View>
            </View>
            {dashboard.activePromotions.flashList.length > 0 && (
              <View style={{ marginTop: Spacing.sm, borderTopColor: borderStyle, borderTopWidth: 0.5, paddingTop: 6 }}>
                {dashboard.activePromotions.flashList.map((promo: any) => (
                  <View key={promo.id} style={styles.promoItem}>
                    <Feather name="zap" size={12} color="#fed330" />
                    <ThemedText type="small" style={{ marginLeft: 6, flex: 1, color: textTitle }} numberOfLines={1}>{promo.title}</ThemedText>
                    <ThemedText type="small" style={{ fontWeight: '700', color: promo.stock < 5 ? AstroBarColors.error : textSub }}>Stock: {promo.stock}</ThemedText>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ⚠️ LÍMITES DEL SISTEMA */}
        {dashboard.limits && (
          <View style={[styles.limitsCard, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.sm]}>
            <View style={styles.limitsHeader}>
              <Feather name="alert-circle" size={18} color="#ff9f43" />
              <ThemedText type="h4" style={{ marginLeft: 8, color: textTitle, fontWeight: '700' }}>Límites de Cupos</ThemedText>
            </View>
            
            <View style={styles.limitItem}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Productos en Menú</ThemedText>
                <ThemedText type="body" style={{ color: textTitle, fontWeight: '700', fontSize: 13 }}>{dashboard.limits.products.current}/{dashboard.limits.products.max}</ThemedText>
              </View>
              <View style={[styles.progressBar, { backgroundColor: bgElement }]}>
                <View style={[styles.progressFill, { 
                  width: `${dashboard.limits.products.percentage}%`,
                  backgroundColor: dashboard.limits.products.percentage >= 90 ? AstroBarColors.error : dashboard.limits.products.percentage >= 70 ? "#ff9f43" : (isDark ? '#00f2fe' : AstroBarColors.primary)
                }]} />
              </View>
            </View>

            <View style={styles.limitItem}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Promociones Flash</ThemedText>
                <ThemedText type="body" style={{ color: textTitle, fontWeight: '700', fontSize: 13 }}>{dashboard.limits.flashPromotions.current}/{dashboard.limits.flashPromotions.max}</ThemedText>
              </View>
              <View style={[styles.progressBar, { backgroundColor: bgElement }]}>
                <View style={[styles.progressFill, { 
                  width: `${dashboard.limits.flashPromotions.percentage}%`,
                  backgroundColor: dashboard.limits.flashPromotions.percentage >= 90 ? AstroBarColors.error : (isDark ? '#fed330' : AstroBarColors.primary)
                }]} />
              </View>
            </View>

            <View style={styles.limitItem}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Promociones Comunes</ThemedText>
                <ThemedText type="body" style={{ color: textTitle, fontWeight: '700', fontSize: 13 }}>{dashboard.limits.commonPromotions.current}/{dashboard.limits.commonPromotions.max}</ThemedText>
              </View>
              <View style={[styles.progressBar, { backgroundColor: bgElement }]}>
                <View style={[styles.progressFill, { 
                  width: `${dashboard.limits.commonPromotions.percentage}%`,
                  backgroundColor: dashboard.limits.commonPromotions.percentage >= 90 ? AstroBarColors.error : (isDark ? '#00f2fe' : AstroBarColors.primary)
                }]} />
              </View>
            </View>
          </View>
        )}

        {/* 🏆 PRODUCTOS MÁS VENDIDOS */}
        {stats.topProducts.length > 0 ? (
          <>
            <ThemedText type="h3" style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm, color: textTitle, fontWeight: '700' }}>
              Productos Estrella
            </ThemedText>
            {stats.topProducts.map((product, index) => (
              <TopProductRow key={index} product={product} index={index} />
            ))}
          </>
        ) : null}

        {/* 📋 PEDIDOS RECIENTES */}
        {dashboard.recentOrders.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <ThemedText type="h3" style={{ color: textTitle, fontWeight: '700' }}>Pedidos Recientes</ThemedText>
              <Pressable onPress={() => {}}>
                <ThemedText type="small" style={{ color: isDark ? '#00f2fe' : AstroBarColors.primary, fontWeight: '700' }}>Ver todos</ThemedText>
              </Pressable>
            </View>
            {dashboard.recentOrders.slice(0, 5).map((order: any, index: number) => (
              <Animated.View
                key={order.id}
                entering={FadeInDown.delay(index * 50).springify()}
                style={[
                  styles.orderCard, 
                  { 
                    backgroundColor: bgSurface,
                    borderColor: borderStyle,
                    borderWidth: isDark ? 1 : 0
                  }, 
                  Shadows.sm
                ]}
              >
                <View style={styles.orderHeader}>
                  <ThemedText type="body" style={{ fontWeight: "700", color: textTitle }}>
                    Pedido #{order.id?.slice(-6) || index}
                  </ThemedText>
                  <Badge
                    label={getStatusTranslation(order.status)}
                    color={order.status === "delivered" ? "#39ff14" : order.status === "cancelled" ? AstroBarColors.error : (isDark ? '#00f2fe' : AstroBarColors.primary)}
                  />
                </View>
                <View style={styles.orderDetails}>
                  <ThemedText type="caption" style={{ color: textSub, fontWeight: '500' }}>
                    {order.customerName || "Cliente"}
                  </ThemedText>
                  <ThemedText type="body" style={{ fontWeight: "800", color: isDark ? '#39ff14' : AstroBarColors.primary }}>
                    ${(order.subtotal || 0).toFixed(2)}
                  </ThemedText>
                </View>
              </Animated.View>
            ))}
          </>
        ) : null}

        {/* ⚡ ACCIONES RÁPIDAS */}
        <View style={styles.quickActions}>
          <ThemedText type="h3" style={{ marginBottom: Spacing.sm, color: textTitle, fontWeight: '700' }}>Centro Operativo</ThemedText>
          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }]}
              onPress={() => navigation.navigate("BusinessManagement", { screen: "BusinessPromotions" })}
            >
              <Feather name="zap" size={22} color={isDark ? '#00f2fe' : AstroBarColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, color: textTitle, fontWeight: '700' }}>Promociones</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }]}
              onPress={() => navigation.navigate("BusinessProfile" as any)}
            >
              <Feather name="settings" size={22} color={isDark ? '#00f2fe' : AstroBarColors.primary} />
              <ThemedText type="small" style={{ marginTop: Spacing.xs, color: textTitle, fontWeight: '700' }}>Ajustes</ThemedText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: Spacing.lg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  statusToggle: { flexDirection: "row", alignItems: "center" },
  businessSelector: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  revenueCard: { padding: Spacing.lg, borderRadius: BorderRadius.xl, alignItems: "center" },
  periodSelector: { flexDirection: "row", marginTop: Spacing.md, gap: Spacing.sm },
  periodButton: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  totalRevenue: { marginTop: Spacing.md },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  statCard: { width: "48%", flexGrow: 1, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: "center" },
  statIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xs },
  avgCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
  productRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  rankBadge: { width: 32, height: 32, borderRadius: 8, justifyContent: "center", alignItems: "center", marginRight: Spacing.md },
  productInfo: { flex: 1 },
  revenueCol: { alignItems: "flex-end" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.lg, marginBottom: Spacing.sm },
  orderCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderDetails: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.sm },
  quickActions: { marginTop: Spacing.xl },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.md },
  actionButton: { flex: 1, padding: Spacing.lg, borderRadius: BorderRadius.lg, alignItems: "center", ...Shadows.sm },
  commissionCard: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
  promotionsCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
  promotionsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  promotionsRow: { flexDirection: "row", gap: Spacing.md },
  promoType: { flexDirection: "row", alignItems: "center" },
  promoItem: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  limitsCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.md },
  limitsHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  limitItem: { marginBottom: Spacing.md },
  progressBar: { height: 6, borderRadius: 3, marginTop: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
});