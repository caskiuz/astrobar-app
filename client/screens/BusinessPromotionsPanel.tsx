import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiRequest } from '../lib/query-client';
import { useAuth } from '../contexts/AuthContext';

import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";

interface Promotion {
  id: string;
  title: string;
  type: 'flash' | 'common';
  promoPrice: number;
  stock: number;
  stockConsumed: number;
  stockRemaining: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  image?: string;
}

export default function BusinessPromotionsPanel() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(theme, insets);
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadPromotions = async () => {
    try {
      const response = await apiRequest('GET', '/api/business/promotions');
      const data = await response.json();
      if (data.success) {
        setPromotions(data.promotions || []);
      }
    } catch (error: any) {
      console.error('Error loading promotions:', error);
      Alert.alert('Error', 'Error al cargar promociones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPromotions();
    const interval = setInterval(loadPromotions, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const getTimeRemaining = (endTime: string) => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    
    if (diff <= 0) return 'Expirada';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const togglePromotion = async (id: string, currentStatus: boolean) => {
    try {
      const response = await apiRequest('PATCH', `/api/promotions/${id}`, { isActive: !currentStatus });
      const result = await response.json();
      
      if (result.success) {
        loadPromotions();
        Alert.alert('Éxito', `Promoción ${!currentStatus ? 'activada' : 'pausada'}`);
      } else {
        Alert.alert('Error', result.error || 'Error al actualizar');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Error al actualizar promoción');
    }
  };

  const deletePromotion = async (id: string, title: string) => {
    if (typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm(`¿Estás seguro de eliminar "${title}"?`);
      if (!confirmed) return;
      
      try {
        const response = await apiRequest('DELETE', `/api/promotions/${id}`);
        const result = await response.json();
        
        if (result.success) {
          loadPromotions();
          window.alert('Promoción eliminada exitosamente');
        } else {
          window.alert('Error: ' + (result.error || 'Error al eliminar'));
        }
      } catch (error: any) {
        window.alert('Error: ' + (error.message || 'Error al eliminar promoción'));
      }
      return;
    }
    
    Alert.alert(
      'Eliminar promoción',
      `¿Estás seguro de eliminar "${title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await apiRequest('DELETE', `/api/promotions/${id}`);
              const result = await response.json();
              
              if (result.success) {
                loadPromotions();
                Alert.alert('Éxito', 'Promoción deleted');
              } else {
                Alert.alert('Error', result.error || 'Error al eliminar');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Error al eliminar promoción');
            }
          }
        }
      ]
    );
  };

  const renderPromotion = ({ item }: { item: Promotion }) => {
    const stockPercentage = item.stock > 0 ? (item.stockRemaining / item.stock) * 100 : 0;
    const isLowStock = stockPercentage < 20;
    const timeRemaining = getTimeRemaining(item.endTime);
    const isExpired = timeRemaining === 'Expirada';

    return (
      <View style={[styles.card, item.type === 'flash' && styles.flashCard, !item.isActive && styles.inactiveCard]}>
        {item.image && (
          <Image
            source={{ uri: item.image }}
            style={styles.promoImage}
            contentFit="cover"
          />
        )}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            {item.type === 'flash' && (
              <View style={styles.flashBadge}>
                <Ionicons name="flash" size={10} color="#05080f" />
                <Text style={styles.flashText}>FLASH</Text>
              </View>
            )}
            {!item.isActive && (
              <View style={[styles.flashBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={[styles.flashText, { color: '#cbd5e1' }]}>PAUSADA</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            {!isExpired && (
              <TouchableOpacity
                onPress={() => navigation.navigate(item.type === 'flash' ? 'CreateFlashPromotion' : 'CreateCommonPromotion', { editPromotion: item })}
                style={[styles.statusBtn, { backgroundColor: 'rgba(0, 242, 254, 0.15)', borderWidth: 1, borderColor: '#00f2fe' }]}
              >
                <Ionicons name="pencil" size={14} color="#00f2fe" />
              </TouchableOpacity>
            )}
            {!isExpired && (
              <TouchableOpacity
                onPress={() => togglePromotion(item.id, item.isActive)}
                style={[styles.statusBtn, !item.isActive && styles.inactiveBtn]}
              >
                <Ionicons
                  name={item.isActive ? 'pause' : 'play'}
                  size={14}
                  color={item.isActive ? '#39ff14' : '#94a3b8'}
                />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => deletePromotion(item.id, item.title)}
              style={[styles.statusBtn, { backgroundColor: 'rgba(255, 76, 76, 0.15)', borderWidth: 1, borderColor: '#ff4c4c' }]}
            >
              <Ionicons name="trash" size={14} color="#ff4c4c" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Stock</Text>
            <Text style={[styles.statValue, isLowStock && styles.lowStock]}>
              {item.stockRemaining}/{item.stock}
            </Text>
            {isLowStock && item.stockRemaining > 0 && (
              <Text style={styles.alertText}>¡Bajo!</Text>
            )}
            {item.stockRemaining === 0 && (
              <Text style={styles.alertText}>Agotado</Text>
            )}
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Tiempo</Text>
            <Text style={[styles.statValue, isExpired && styles.lowStock]}>{timeRemaining}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Precio</Text>
            <Text style={[styles.statValue, { color: '#39ff14' }]}>${item.promoPrice.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${stockPercentage}%` },
              isLowStock && styles.lowStockBar,
            ]}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Vendidos: {item.stockConsumed}</Text>
          <Text style={styles.footerText}>Inicio: {new Date(item.startTime).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#05080f' }]}>
        <Text style={styles.loadingText}>Cargando promociones...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🪐 CONTROL SUPERIOR ULTRA MODERNO */}
      <View style={styles.topNav}>
        <TouchableOpacity style={[styles.navButton, styles.navButtonActive]} onPress={() => {}}>
          <Ionicons name="megaphone" size={18} color="#00f2fe" />
          <Text style={[styles.navButtonText, { color: '#00f2fe' }]}>Promociones</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('BusinessMenu')}>
          <Ionicons name="restaurant" size={18} color="#94a3b8" />
          <Text style={[styles.navButtonText, { color: '#94a3b8' }]}>Menú</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navButton} onPress={() => navigation.navigate('PromotionTransactions')}>
          <Ionicons name="list" size={18} color="#94a3b8" />
          <Text style={[styles.navButtonText, { color: '#94a3b8' }]}>Historial</Text>
        </TouchableOpacity>
      </View>

      {/* 📊 PANEL DE RESUMEN METÓDICO */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{promotions.filter(p => p.isActive).length || 0}</Text>
          <Text style={styles.summaryLabel}>Activas</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#a855f7' }]}>
            {promotions.filter(p => p.type === 'flash' && p.isActive).length || 0}
          </Text>
          <Text style={styles.summaryLabel}>Flash</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {promotions.reduce((sum, p) => sum + (p.stockRemaining || p.stock || 0), 0)}
          </Text>
          <Text style={styles.summaryLabel}>Stock Total</Text>
        </View>
      </View>

      <FlatList
        data={promotions}
        renderItem={renderPromotion}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            loadPromotions();
          }} tintColor="#00f2fe" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconCore}>
              <Ionicons name="megaphone-outline" size={32} color="#64748b" />
            </View>
            <Text style={styles.emptyText}>No hay promociones creadas</Text>
            <Text style={styles.emptySubtext}>Lanzá una oferta Flash o Común para empezar a llenar las mesas.</Text>
          </View>
        }
      />

      {/* 🪐 CÁPSULAS FLOTANTES CYBERPUNK (Rediseño de los círculos planos) */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={[styles.fab, styles.flashFab]}
          onPress={() => navigation.navigate('CreateFlashPromotion')}
        >
          <Ionicons name="flash" size={20} color="#FFF" />
          <Text style={styles.fabText}>Flash</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.fab, styles.commonFab]}
          onPress={() => navigation.navigate('CreateCommonPromotion')}
        >
          <Ionicons name="calendar" size={20} color="#05080f" />
          <Text style={[styles.fabText, { color: '#05080f' }]}>Común</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme: any, insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05080f' },
  topNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11, 17, 30, 0.4)',
    paddingTop: insets.top + Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  navButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#00f2fe',
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#00f2fe', fontSize: 15, fontWeight: '700' },
  
  summary: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryItem: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  summaryValue: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  summaryLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600', textTransform: 'uppercase' },
  
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden'
  },
  promoImage: {
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  flashCard: { borderColor: 'rgba(168, 85, 247, 0.4)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginRight: Spacing.sm },
  title: { fontSize: 17, fontWeight: '900', color: '#FFF', flex: 1 },
  flashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#a855f7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 3,
  },
  flashText: { fontSize: 9, fontWeight: '900', color: '#FFF' },
  statusBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inactiveBtn: { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' },
  
  stats: { flexDirection: 'row', marginBottom: Spacing.md, backgroundColor: 'rgba(5, 8, 15, 0.3)', padding: Spacing.sm, borderRadius: BorderRadius.md },
  stat: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginBottom: 2, fontWeight: '500' },
  statValue: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  lowStock: { color: '#ff4c4c' },
  
  progressBar: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#39ff14', borderRadius: BorderRadius.full },
  lowStockBar: { backgroundColor: '#ff4c4c' },
  alertText: { fontSize: 9, color: '#ff4c4c', fontWeight: '900', marginTop: 2, textTransform: 'uppercase' },
  inactiveCard: { opacity: 0.5 },
  
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  footerText: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: Spacing.xl },
  emptyIconCore: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.03)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  emptySubtext: { color: '#94a3b8', fontSize: 13, marginTop: Spacing.xs, textAlign: 'center', fontWeight: '500', lineHeight: 18 },
  
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: Spacing.lg,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  fab: {
    paddingHorizontal: Spacing.lg,
    height: 46,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    ...Shadows.md,
  },
  flashFab: {
    backgroundColor: '#a855f7',
    shadowColor: '#a855f7',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  commonFab: {
    backgroundColor: '#00f2fe',
    shadowColor: '#00f2fe',
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  fabText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 0.3,
  },
});