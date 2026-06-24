import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, AstroBarColors, Shadows } from '@/constants/theme';
import { apiRequest } from '@/lib/query-client';

export default function OrderPaymentScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Recibimos los datos del pedido (si no vienen, hardcodeamos para la prueba los $63.250 de tu captura)
  const totalAmount = route.params?.totalAmount || 63250;
  const businessId = route.params?.businessId || "bar_test_id";

  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessPayment = async () => {
    setIsProcessing(true);
    try {
      // 🪐 LLAMADA CORRECTA DE CLIENTE: Generamos la preferencia de cobro común
      const response = await apiRequest('POST', '/api/payments/checkout', {
        amount: totalAmount,
        businessId: businessId,
        description: "Consumo AstroBar"
      });

      const data = await response.json();

      if (data.success && data.initPoint) {
        // Redirigimos al WebView nativo con la pasarela de Mercado Pago común (Tarjetas, Dinero en cuenta, etc.)
        navigation.navigate('MercadoPagoWebView', { url: data.initPoint });
      } else {
        Alert.alert("Error", data.error || "No se pudo generar la pasarela de pago.");
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      Alert.alert("Error de Conexión", "Hubo un problema al conectar con Mercado Pago.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: '#05080f' }]}>
      {/* HEADER BAR */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#FFF" />
        </Pressable>
        <ThemedText type="h2" style={{ marginLeft: Spacing.md, color: '#FFF', fontWeight: '900' }}>
          Pagar Pedido
        </ThemedText>
      </View>

      {/* TICKET DE RESUMEN NEÓN */}
      <View style={styles.content}>
        <View style={styles.ticketCard}>
          <Feather name="credit-card" size={40} color="#00f2fe" style={{ marginBottom: Spacing.md }} />
          <ThemedText type="body" style={{ color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 }}>
            Total a Transferir
          </ThemedText>
          <ThemedText type="h1" style={styles.amountText}>
            ${totalAmount.toLocaleString('es-AR')}
          </ThemedText>
          <ThemedText type="body" style={{ color: '#64748b', marginTop: Spacing.xs, textAlign: 'center' }}>
            La transacción se procesará de forma segura mediante la pasarela oficial de Mercado Pago.
          </ThemedText>
        </View>
      </View>

      {/* BOTÓN DE ACCIÓN CYBERPUNK DE INICIO DE COBRO */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <TouchableOpacity
          disabled={isProcessing}
          onPress={handleProcessPayment}
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
                <Feather name="shield" size={18} color="#05080f" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>PAGAR CON MERCADO PAGO</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// 🪐 ESTILOS PREMIUM TOTALMENTE EDITADOS EN LÍNEA CON EL TEMA DE ASTROBAR
const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  ticketCard: {
    width: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)',
    ...Shadows.md,
  },
  amountText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#39ff14',
    marginVertical: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
  },
  payButtonContainer: {
    width: '100%',
    height: 52,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    ...Shadows.md,
    shadowColor: '#00f2fe',
    shadowOpacity: 0.3,
  },
  gradientButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#05080f',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});