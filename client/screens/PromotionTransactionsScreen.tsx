import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons'; // Usamos únicamente Ionicons para evitar imports rotos
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../lib/query-client';
import { useBusiness } from '../contexts/BusinessContext';

import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";

interface Transaction {
  id: string;
  promotionTitle: string;
  userName: string;
  userPhone: string;
  status: 'pending' | 'redeemed' | 'cancelled';
  amountPaid: number;
  businessRevenue: number;
  createdAt: string;
  redeemedAt?: string;
}

export default function PromotionTransactionsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(insets);
  const navigation = useNavigation<any>();
  const { selectedBusiness, businesses, setSelectedBusiness } = useBusiness();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'redeemed' | 'cancelled'>('all');
  const [showBusinessSelector, setShowBusinessSelector] = useState(false);

  const loadTransactions = async () => {
    try {
      const url = selectedBusiness?.id 
        ? `/api/promotions/business/transactions?businessId=${selectedBusiness.id}`
        : '/api/promotions/business/transactions';
      const response = await apiRequest('GET', url);
      const data = await response.json();
      if (data.success) {
        setTransactions(data.transactions || []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [selectedBusiness]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'pending': return { bg: 'rgba(0, 242, 254, 0.12)', border: '#00f2fe', text: '#00f2fe' };
      case 'redeemed': return { bg: 'rgba(57, 255, 20, 0.12)', border: '#39ff14', text: '#39ff14' };
      case 'cancelled': return { bg: 'rgba(255, 76, 76, 0.12)', border: '#ff4c4c', text: '#ff4c4c' };
      default: return { bg: 'rgba(255,255,255,0.05)', border: '#64748b', text: '#64748b' };
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'redeemed': return 'Canjeado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.status === filter);

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const statusStyle = getStatusStyle(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.promoTitle} numberOfLines={1}>{item.promotionTitle}</Text>
            <Text style={styles.userName}>{item.userName}</Text>
            <Text style={styles.userPhone}>{item.userPhone}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
            <Text style={[styles.statusText, { color: statusStyle.text }]}>{getStatusText(item.status)}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.amountRow}>
            <Text style={styles.label}>Caja neta:</Text>
            <Text style={styles.amount}>${item.businessRevenue.toFixed(2)}</Text>
          </View>
          <Text style={styles.date}>
            {new Date(item.createdAt).toLocaleString('es-AR', { 
              day: '2-digit', 
              month: '2-digit', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </Text>
        </View>

        {item.redeemedAt && (
          <View style={styles.redeemedRow}>
            {/* ✅ Corregido: Cambiado a Ionicons para evitar crash por falta de import */}
            <Ionicons name="checkmark" size={12} color="#39ff14" />
            <Text style={styles.redeemedText}>
              Canjeado: {new Date(item.redeemedAt).toLocaleString('es-AR', { 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00f2fe" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🪐 CONTROL SUPERIOR INTEGRADO CIAN */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('BusinessPromotions')}
        >
          <Ionicons name="megaphone" size={18} color="#94a3b8" />
          <Text style={[styles.navButtonText, { color: '#94a3b8' }]}>Promociones</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('BusinessMenu')}
        >
          <Ionicons name="restaurant" size={18} color="#94a3b8" />
          <Text style={[styles.navButtonText, { color: '#94a3b8' }]}>Menú</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navButton, styles.navButtonActive]} onPress={() => {}}>
          <Ionicons name="list" size={18} color="#00f2fe" />
          <Text style={[styles.navButtonText, { color: '#00f2fe' }]}>Historial</Text>
        </TouchableOpacity>
      </View>

      {/* MULTI-BAR SELECTOR CYBERPUNK */}
      {businesses.length > 1 && (
        <View style={styles.businessSelector}>
          <TouchableOpacity
            style={styles.businessButton}
            onPress={() => setShowBusinessSelector(!showBusinessSelector)}
          >
            <Ionicons name="business" size={15} color="#00f2fe" />
            <Text style={styles.businessButtonText}>{selectedBusiness?.name || 'Seleccionar bar'}</Text>
            <Ionicons name={showBusinessSelector ? "chevron-up" : "chevron-down"} size={15} color="#00f2fe" />
          </TouchableOpacity>
          {showBusinessSelector && (
            <ScrollView style={styles.businessList} horizontal showsHorizontalScrollIndicator={false}>
              {businesses.map((business) => {
                const isBusSelected = selectedBusiness?.id === business.id;
                return (
                  <TouchableOpacity
                    key={business.id}
                    style={[styles.businessItem, isBusSelected && styles.businessItemActive]}
                    onPress={() => {
                      setSelectedBusiness(business);
                      setShowBusinessSelector(false);
                      setLoading(true);
                      loadTransactions();
                    }}
                  >
                    <Text style={[styles.businessItemText, isBusSelected && styles.businessItemTextActive]}>
                      {business.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* 🌌 FILTROS DE ESTADO EN SCROLL FLUIDO ANTI-CORTES */}
      <View style={styles.filterOuterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['all', 'pending', 'redeemed', 'cancelled'] as const).map((f) => {
            const isSelected = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterBtn, isSelected && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, isSelected && styles.filterTextActive]}>
                  {f === 'all' ? 'Todos' : getStatusText(f)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 📊 PANEL INDICADOR DE VENTAS */}
      <View style={styles.summary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{transactions.length}</Text>
          <Text style={styles.summaryLabel}>Total emitido</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#00f2fe' }]}>
            {transactions.filter(t => t.status === 'pending').length}
          </Text>
          <Text style={styles.summaryLabel}>Pendientes</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, { color: '#39ff14' }]}>
            {transactions.filter(t => t.status === 'redeemed').length}
          </Text>
          <Text style={styles.summaryLabel}>Canjeados</Text>
        </View>
      </View>

      <FlatList
        data={filteredTransactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00f2fe" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="receipt-outline" size={32} color="#64748b" />
            </View>
            <Text style={styles.emptyText}>No hay movimientos registrados</Text>
          </View>
        }
      />
    </View>
  );
}

const getStyles = (insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05080f' },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
  filterOuterContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  filterScroll: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  filterBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: '#00f2fe',
    borderColor: '#00f2fe',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  filterTextActive: {
    color: '#05080f',
  },
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
  
  list: { padding: Spacing.md, paddingBottom: 40 },
  card: {
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  promoTitle: { fontSize: 16, fontWeight: '900', color: '#FFF', marginBottom: 4 },
  userName: { fontSize: 14, color: '#cbd5e1', fontWeight: '600' },
  userPhone: { fontSize: 12, color: '#64748b', marginTop: 1, fontWeight: '500' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  amount: { fontSize: 17, fontWeight: '900', color: '#39ff14' },
  date: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  redeemedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm, paddingTop: Spacing.xs, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  redeemedText: { fontSize: 11, color: '#39ff14', fontWeight: '600' },
  
  empty: { alignItems: 'center', marginTop: 80 },
  emptyIconBox: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.02)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyText: { color: '#64748b', fontSize: 15, fontWeight: '700' },
  
  businessSelector: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  businessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  businessButtonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: '#00f2fe',
  },
  businessList: {
    marginTop: 10,
    maxHeight: 40,
  },
  businessItem: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(5, 8, 15, 0.5)',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  businessItemActive: {
    backgroundColor: '#00f2fe',
    borderColor: '#00f2fe',
  },
  businessItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  businessItemTextActive: {
    color: '#05080f',
  },
});