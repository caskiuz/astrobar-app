import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Alert, ActivityIndicator, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { WebView } from 'react-native-webview';

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

export default function PaymentScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  // Parámetros de la promoción seleccionada por el cliente
  const { userPromotionId, amount, promoName } = route.params;

  const [loading, setLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState('');

  const handlePayment = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      // 🪐 Generamos la preferencia de cobro directo para el cliente
      const response = await apiRequest("POST", "/api/customer-payment/create-payment", { 
        transactionId: userPromotionId 
      });
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Error al crear la pasarela de pago");
      }
      
      if (data.initPoint) {
        setWebViewUrl(data.initPoint);
        setShowWebView(true);
      }
    } catch (error: any) {
      console.error("Payment error:", error);
      Alert.alert("Error", error.message || "No se pudo procesar el pago");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentWebViewNavigationStateChange = (navState: any) => {
    const { url } = navState;
    
    // Control de redirecciones de éxito/falla nativas de AstroBar
    if (url.includes('astrobar://payment-success') || url.includes('success')) {
      setShowWebView(false);
      setWebViewUrl('');
      setLoading(false);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("¡Pago exitoso!", "Tu promoción está lista", [
        { text: "Ver QR", onPress: () => navigation.replace("PromotionQR", { transactionId: userPromotionId }) }
      ]);
    } else if (url.includes('astrobar://payment-failure') || url.includes('failure')) {
      setShowWebView(false);
      setWebViewUrl('');
      setLoading(false);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Pago fallido", "No se pudo completar el pago. Intenta nuevamente.");
    } else if (url.includes('astrobar://payment-pending')) {
      setShowWebView(false);
      setWebViewUrl('');
      setLoading(false);
      
      Alert.alert("Pago pendiente", "Tu pago está siendo procesado. Te notificaremos cuando esté listo.");
    }
  };

  return (
    <LinearGradient
      colors={[theme.gradientStart || '#05080f', theme.gradientEnd || '#0b111e']}
      style={styles.container}
    >
      <View style={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
        {/* BOTÓN VOLVER */}
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>

        <ThemedText type="h2" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md, color: '#FFF', fontWeight: '900' }}>
          Confirmar Pago
        </ThemedText>

        {/* RESUMEN DE COMPRA */}
        <View style={[styles.card, { backgroundColor: '#111726', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }]}>
          <ThemedText type="small" style={{ color: theme.textSecondary, textTransform: 'uppercase', fontWeight: '700' }}>Insumo / Promoción</ThemedText>
          <ThemedText type="h3" style={{ marginTop: Spacing.xs, color: '#FFF' }}>{promoName}</ThemedText>

          <View style={styles.divider} />

          <View style={styles.row}>
            <ThemedText type="body" style={{ color: '#cbd5e1', fontWeight: '500' }}>Total a Transferir</ThemedText>
            <ThemedText type="h2" style={{ color: "#39ff14", fontWeight: '900' }}>
              ${amount}
            </ThemedText>
          </View>
        </View>

        {/* INFO BOX SEGURA */}
        <View style={[styles.infoCard, { backgroundColor: "rgba(0, 242, 254, 0.06)", borderWidth: 1, borderColor: "rgba(0, 242, 254, 0.15)" }]}>
          <Feather name="shield" size={20} color="#00f2fe" />
          <ThemedText type="small" style={{ marginLeft: Spacing.sm, flex: 1, color: '#cbd5e1', lineHeight: 18 }}>
            Tu transacción está protegida por Mercado Pago. Puedes abonar con tarjeta de crédito, débito o dinero en cuenta sin vincular tu perfil.
          </ThemedText>
        </View>

        {/* BOTÓN DIRECTO DE COMPRA */}
        <Pressable
          onPress={handlePayment}
          disabled={loading}
          style={[styles.payButton, { backgroundColor: '#00f2fe', opacity: loading ? 0.6 : 1, marginTop: 'auto', marginBottom: Math.max(insets.bottom, Spacing.xl) }]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#05080f" />
          ) : (
            <>
              <Feather name="credit-card" size={20} color="#05080f" style={{ marginRight: Spacing.sm }} />
              <ThemedText style={{ color: "#05080f", fontWeight: "900" }}>
                PAGAR ${amount}
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {/* WEBVIEW PASARELA INTEGRADA DE MERCADO PAGO */}
      <Modal
        visible={showWebView}
        animationType="slide"
        onRequestClose={() => {
          setShowWebView(false);
          setWebViewUrl('');
          setLoading(false);
        }}
      >
        <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#05080f' }}>
          <View style={[styles.webViewHeader, { backgroundColor: '#111726', borderBottomColor: 'rgba(255,255,255,0.08)' }]}>
            <ThemedText type="h4" style={{ color: '#FFF', fontWeight: '800' }}>Checkout Seguro</ThemedText>
            <Pressable
              style={[styles.closeWebViewButton, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
              onPress={() => {
                setShowWebView(false);
                setWebViewUrl('');
                setLoading(false);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Feather name="x" size={24} color="#FFF" />
            </Pressable>
          </View>
          {webViewUrl ? (
            <WebView
              source={{ uri: webViewUrl }}
              onNavigationStateChange={handlePaymentWebViewNavigationStateChange}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="large" color="#00f2fe" />
                  <ThemedText type="body" style={{ marginTop: Spacing.md, color: '#94a3b8' }}>
                    Abriendo pasarela de cobro...
                  </ThemedText>
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
    </LinearGradient>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  backButton: { marginBottom: Spacing.md },
  card: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginVertical: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    alignItems: 'flex-start',
  },
  payButton: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
    shadowColor: "#00f2fe",
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  closeWebViewButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#05080f',
  },
});