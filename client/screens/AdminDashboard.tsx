import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { api } from '../lib/api';
import { AstroBarColors } from '@/constants/theme';
import { useTheme } from "@/hooks/useTheme";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>({ totalUsers: 0, totalBars: 0, promotions: { totalActive: 0, acceptanceRate: 0, topBars: [] } });
  const [revenue, setRevenue] = useState<any>(null);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [pointsStats, setPointsStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Consumimos el tema dinámico del proyecto
  const { theme } = useTheme();
  const isDark = theme.background === "#000000" || theme.background === "black" || theme.background === "#121212";

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [metricsRes, promoRes, revenueRes, topUsersRes, pointsRes] = await Promise.all([
        api.get('/admin/dashboard/metrics'),
        api.get('/admin/promotions/dashboard'),
        api.get('/admin/revenue/stats'),
        api.get('/admin/users/top'),
        api.get('/admin/points/stats')
      ]);
      setStats({ ...metricsRes.data, promotions: promoRes.data.dashboard });
      setRevenue(revenueRes.data.stats);
      setTopUsers(topUsersRes.data.users || []);
      setPointsStats(pointsRes.data.stats);
    } catch (error: any) {
      console.error('Error loading stats:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  // Colores dinámicos adaptados a la jerarquía visual del dueño de bar
  const bgContainer = isDark ? '#0b111e' : '#f5f5f5'; // Azul galáctico vs Gris claro
  const bgSurface = isDark ? '#111927' : '#ffffff';   // Tarjeta interna oscura vs blanca
  const bgElement = isDark ? '#1f293d' : '#f5f5f5';   // Sub-bloques gris azulado vs gris claro
  const textTitle = isDark ? '#ffffff' : '#333333';
  const textSub = isDark ? '#94a3b8' : '#666666';
  const borderStyle = isDark ? '#1e293b' : '#f0f0f0';

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: bgContainer }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStats} tintColor={textTitle} />}
    >
      <View style={[styles.header, { backgroundColor: bgSurface }]}>
        <Text style={[styles.title, { color: textTitle }]}>Panel de Control</Text>
        <Text style={[styles.subtitle, { color: textSub }]}>Métricas comerciales en tiempo real</Text>
      </View>

      {/* Grid de Métricas Principales con estética Neón/Astro en Modo Oscuro */}
      <View style={styles.grid}>
        <View style={[styles.card, { backgroundColor: isDark ? '#152238' : '#4CAF50', borderColor: isDark ? '#00f2fe' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
          <Feather name="users" size={26} color={isDark ? '#00f2fe' : '#fff'} />
          <Text style={styles.cardValue}>{stats.totalUsers}</Text>
          <Text style={[styles.cardLabel, { color: isDark ? '#94a3b8' : '#fff' }]}>Usuarios Totales</Text>
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? '#152238' : '#2196F3', borderColor: isDark ? '#3b82f6' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
          <Feather name="briefcase" size={26} color={isDark ? '#3b82f6' : '#fff'} />
          <Text style={styles.cardValue}>{stats.totalBars}</Text>
          <Text style={[styles.cardLabel, { color: isDark ? '#94a3b8' : '#fff' }]}>Bares Aliados</Text>
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? '#152238' : '#FF9800', borderColor: isDark ? '#ff9f43' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
          <Feather name="zap" size={26} color={isDark ? '#ff9f43' : '#fff'} />
          <Text style={styles.cardValue}>{stats.activePromotions || 0}</Text>
          <Text style={[styles.cardLabel, { color: isDark ? '#94a3b8' : '#fff' }]}>Promos Activas</Text>
        </View>

        <View style={[styles.card, { backgroundColor: isDark ? '#152238' : '#9C27B0', borderColor: isDark ? '#a55eea' : 'transparent', borderWidth: isDark ? 1 : 0 }]}>
          <Feather name="trending-up" size={26} color={isDark ? '#a55eea' : '#fff'} />
          <Text style={styles.cardValue}>{stats.promotions?.acceptanceRate || 0}%</Text>
          <Text style={[styles.cardLabel, { color: isDark ? '#94a3b8' : '#fff' }]}>% Aceptación</Text>
        </View>
      </View>

      {/* Top Bares */}
      <View style={[styles.section, { backgroundColor: bgSurface }]}>
        <Text style={[styles.sectionTitle, { color: textTitle }]}>Top Rankings de Bares</Text>
        {stats.promotions?.topBars?.map((bar: any, index: number) => (
          <View key={index} style={[styles.listItem, { borderBottomColor: borderStyle }]}>
            <View style={[styles.rank, { backgroundColor: AstroBarColors.primary }]}>
              <Text style={styles.rankText}>#{index + 1}</Text>
            </View>
            <View style={styles.listItemContent}>
              <Text style={[styles.listItemTitle, { color: textTitle }]}>{bar.name}</Text>
              <Text style={[styles.listItemSubtitle, { color: textSub }]}>{bar.count} canjes completados</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Ingresos de la Plataforma */}
      {revenue && (
        <View style={[styles.section, { backgroundColor: bgSurface }]}>
          <Text style={[styles.sectionTitle, { color: textTitle }]}>Caja e Ingresos de Plataforma</Text>
          <View style={styles.revenueGrid}>
            <View style={[styles.revenueItem, { backgroundColor: bgElement }]}>
              <Text style={[styles.revenueLabel, { color: textSub }]}>Facturación Total</Text>
              <Text style={[styles.revenueValue, { color: textTitle }]}>${Number(revenue.totalRevenue || 0).toFixed(2)}</Text>
            </View>
            <View style={[styles.revenueItem, { backgroundColor: bgElement, borderColor: isDark ? '#39ff14' : 'transparent', borderWidth: isDark ? 0.5 : 0 }]}>
              <Text style={[styles.revenueLabel, { color: textSub }]}>Comisión Neta</Text>
              <Text style={[styles.revenueValue, { color: isDark ? '#39ff14' : AstroBarColors.primary }]}>${Number(revenue.platformRevenue || 0).toFixed(2)}</Text>
            </View>
            <View style={[styles.revenueItem, { backgroundColor: bgElement }]}>
              <Text style={[styles.revenueLabel, { color: textSub }]}>Volumen Transacciones</Text>
              <Text style={[styles.revenueValue, { color: textTitle }]}>{revenue.totalTransactions || 0}</Text>
            </View>
            <View style={[styles.revenueItem, { backgroundColor: bgElement }]}>
              <Text style={[styles.revenueLabel, { color: textSub }]}>Ticket Promedio</Text>
              <Text style={[styles.revenueValue, { color: textTitle }]}>${Number(revenue.avgTransaction || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Top Usuarios */}
      {topUsers.length > 0 && (
        <View style={[styles.section, { backgroundColor: bgSurface }]}>
          <Text style={[styles.sectionTitle, { color: textTitle }]}>Clientes Premium (Mayor Canje)</Text>
          {topUsers.slice(0, 5).map((user: any, index: number) => (
            <View key={index} style={[styles.listItem, { borderBottomColor: borderStyle }]}>
              <View style={[styles.rank, { backgroundColor: '#3b82f6' }]}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>
              <View style={styles.listItemContent}>
                <Text style={[styles.listItemTitle, { color: textTitle }]}>{user.name}</Text>
                <Text style={[styles.listItemSubtitle, { color: textSub }]}>{user.redemptions} visitas • Consumo: ${Number(user.totalSpent || 0).toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Sistema de Fidelización */}
      {pointsStats && (
        <View style={[styles.section, { backgroundColor: bgSurface, marginBottom: 25 }]}>
          <Text style={[styles.sectionTitle, { color: textTitle }]}>Distribución de Rangos de Clientes</Text>
          <View style={styles.pointsGrid}>
            <View style={styles.pointsItem}>
              <Feather name="award" size={22} color="#CD7F32" />
              <Text style={[styles.pointsLabel, { color: textSub }]}>Copper</Text>
              <Text style={[styles.pointsValue, { color: textTitle }]}>{pointsStats.copper || 0}</Text>
            </View>
            <View style={styles.pointsItem}>
              <Feather name="award" size={22} color="#b87333" />
              <Text style={[styles.pointsLabel, { color: textSub }]}>Bronze</Text>
              <Text style={[styles.pointsValue, { color: textTitle }]}>{pointsStats.bronze || 0}</Text>
            </View>
            <View style={styles.pointsItem}>
              <Feather name="award" size={22} color="#C0C0C0" />
              <Text style={[styles.pointsLabel, { color: textSub }]}>Silver</Text>
              <Text style={[styles.pointsValue, { color: textTitle }]}>{pointsStats.silver || 0}</Text>
            </View>
            <View style={styles.pointsItem}>
              <Feather name="award" size={22} color="#FFD700" />
              <Text style={[styles.pointsLabel, { color: textSub }]}>Gold</Text>
              <Text style={[styles.pointsValue, { color: textTitle }]}>{pointsStats.gold || 0}</Text>
            </View>
            <View style={styles.pointsItem}>
              <Feather name="award" size={22} color="#E5E4E2" />
              <Text style={[styles.pointsLabel, { color: textSub }]}>Platinum</Text>
              <Text style={[styles.pointsValue, { color: textTitle }]}>{pointsStats.platinum || 0}</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 22, paddingBottom: 18, borderBottomWidth: 0.5, borderBottomColor: '#1e293b20' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: 0.3 },
  subtitle: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12 },
  card: { flex: 1, minWidth: '45%', padding: 18, borderRadius: 14, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardValue: { fontSize: 28, fontWeight: 'bold', color: '#fff', marginTop: 8, letterSpacing: 0.5 },
  cardLabel: { fontSize: 12, marginTop: 4, fontWeight: '600', opacity: 0.9 },
  section: { margin: 12, padding: 18, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16, letterSpacing: 0.2 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  listItemContent: { flex: 1 },
  listItemTitle: { fontSize: 15, fontWeight: '600' },
  listItemSubtitle: { fontSize: 12, marginTop: 3 },
  revenueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  revenueItem: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 10 },
  revenueLabel: { fontSize: 11, marginBottom: 6, fontWeight: '600' },
  revenueValue: { fontSize: 19, fontWeight: 'bold' },
  pointsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-around' },
  pointsItem: { alignItems: 'center', padding: 10, minWidth: '18%' },
  pointsLabel: { fontSize: 11, marginTop: 6, fontWeight: '500' },
  pointsValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
});