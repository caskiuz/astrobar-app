import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert, TouchableOpacity, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';

export default function OrderPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Levantamos el monto dinámico (si no viene, usa los $63.250 de tu pantalla)
  const totalAmount = route.params?.totalAmount || 63250;
  const businessId = route.params?.businessId || "bar_test_id";

  const [isProcessing, setIsProcessing] = useState(false);

  const handleInitCheckout = async () => {
    setIsProcessing(true);
    try {
      // 🪐 Flujo de Cliente Común: Generamos la preferencia nativa en el servidor
      const response = await apiRequest('POST', '/api/payments/checkout', {
        amount: totalAmount,
        businessId: businessId,
        description: "Compra en AstroBar"
      });

      const data = await response.json();

      if (data.success && data.initPoint) {
        // Se abre la pasarela tradicional de tarjetas mediante WebView sin pedir vinculación previa
        navigation.navigate('MercadoPagoWebView', { url: data.initPoint });
      } else {
        Alert.alert("Error", data.error || "No se pudo iniciar el pago.");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      Alert.alert("Error", "Problema al conectar con la pasarela de pagos.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#05080f' }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </Pressable>
        <ThemedText type="h2" style={{ marginLeft: Spacing.md, color: '#FFF', fontWeight: '900' }}>
          Confirmar Pago
        </ThemedText>
      </View>

      {/* DETALLE DEL PAGO */}
      <View style={styles.content}>
        <View style={styles.ticketCard}>
          <ThemedText type="body" style={styles.ticketLabel}>Resumen del pedido</ThemedText>
          <ThemedText type="body" style={{ color: '#cbd5e1', marginTop: 4 }}>1 producto</ThemedText>
          
          <View style={styles.divider} />

          <Text style={styles.totalLabel}>Total a pagar</Text>
          <Text style={styles.totalAmount}>${totalAmount.toLocaleString('es-AR')}.00</Text>
        </View>

        <View style={styles.infoBox}>
          <Feather name="shield" size={20} color="#00f2fe" style={{ marginRight: 10 }} />
          <Text style={styles.infoText}>
            Tu pago está protegido. No necesitas vincular tu cuenta personal.
          </Text>
        </View>
      </View>

      {/* BOTÓN DEFINITIVO CYBERPUNK SIN VINCULACIONES EXTRAÑAS */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <TouchableOpacity
          disabled={isProcessing}
          onPress={handleInitCheckout}
          style={styles.payButtonContainer}
        >
          <LinearGradient
            colors={['#00f2fe', '#4facfe']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradientButton}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#05080f" />
            ) : (
              <View style={styles.buttonInner}>
                <Feather name="credit-card" size={18} color="#05080f" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>PAGAR CON MERCADO PAGO</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    justifyContent: 'center',
  },
  ticketCard: {
    backgroundColor: '#111726',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Shadows.md,
  },
  ticketLabel: { color: '#64748b', fontWeight: '600', textTransform: 'uppercase', fontSize: 12 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: Spacing.lg },
  totalLabel: { color: '#94a3b8', fontSize: 15, fontWeight: '500' },
  totalAmount: { color: '#00f2fe', fontSize: 32, fontWeight: '900', marginTop: 6 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 242, 254, 0.06)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.15)',
  },
  infoText: { color: '#cbd5e1', fontSize: 13, flex: 1, lineHeight: 18, fontWeight: '500' },
  footer: { paddingHorizontal: Spacing.xl },
  payButtonContainer: {
    width: '100%',
    height: 50,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  gradientButton: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { color: '#05080f', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },
});