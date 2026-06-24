import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AstroBarColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type ConfirmPromotionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "ConfirmPromotion">;
  route: RouteProp<RootStackParamList, "ConfirmPromotion">;
};

export default function ConfirmPromotionScreen({
  navigation,
  route,
}: ConfirmPromotionScreenProps) {
  const { theme } = useTheme();
  const { promotion, business } = route.params;

  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isConfirmed, setIsConfirmed] = useState(false);

  useEffect(() => {
    if (isConfirmed || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isConfirmed, timeLeft]);

  const handleConfirm = async () => {
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // 1. Aceptar la promoción para registrar la transacción en el backend
      const response = await apiRequest("POST", `/api/promotions/${promotion.id}/accept`);
      const data = await response.json();

      if (data.success) {
        const transactionId = data.transaction.id;
        
        // 2. Crear la preferencia de pago regulada en Mercado Pago
        const paymentResponse = await apiRequest("POST", "/api/mp/create-payment", { 
          transactionId 
        });
        const paymentData = await paymentResponse.json();
        
        if (!paymentData.success) {
          throw new Error(paymentData.error || "Error al crear pago");
        }
        
        // 3. 🪐 FLUJO SANO: Enviamos al usuario a nuestra pantalla de checkout controlada
        if (paymentData.initPoint) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          // Redirigimos de forma interna a OrderPaymentScreen pasándole el link de la pasarela
          navigation.replace("OrderPaymentScreen" as any, {
            totalAmount: totalAmount,
            businessId: business.id,
            initPoint: paymentData.initPoint,
            transaction: data.transaction,
            promotion,
            business
          });
        }
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      alert(error.message || "Error al procesar la promoción");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    Haptics.selectionAsync();
    navigation.goBack();
  };

  const promoPrice = promotion.promoPrice / 100;
  const platformCommission = Math.round(promotion.promoPrice * 0.30) / 100;
  const totalAmount = promoPrice + platformCommission;

  return (
    <LinearGradient
      colors={[theme.gradientStart || "#1A1A2E", theme.gradientEnd || "#16213E"]}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleCancel} style={styles.backButton}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </Pressable>
          <ThemedText type="h2" style={styles.title}>
            Confirmar Promoción
          </ThemedText>
        </View>

        {/* Timer */}
        <View style={[styles.timerCard, { backgroundColor: theme.card }]}>
          <View style={styles.timerCircle}>
            <ThemedText type="h1" style={styles.timerText}>
              {timeLeft}
            </ThemedText>
            <ThemedText type="caption" style={styles.timerLabel}>
              segundos
            </ThemedText>
          </View>
          <ThemedText type="body" style={styles.timerMessage}>
            Tenés {timeLeft} segundos para confirmar esta promoción
          </ThemedText>
        </View>

        {/* Promotion Details */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <ThemedText type="h3" style={styles.cardTitle}>
            {promotion.title}
          </ThemedText>
          <ThemedText type="body" style={styles.cardSubtitle}>
            {business.name}
          </ThemedText>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <ThemedText type="body">Precio de la promoción:</ThemedText>
            <ThemedText type="h3" style={{ color: AstroBarColors.primary }}>
              ${promoPrice.toFixed(2)}
            </ThemedText>
          </View>

          <View style={styles.priceRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Comisión de plataforma (30%):
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              ${platformCommission.toFixed(2)}
            </ThemedText>
          </View>

          <View style={styles.divider} />

          <View style={styles.priceRow}>
            <ThemedText type="h3">Total a pagar:</ThemedText>
            <ThemedText type="h2" style={{ color: "#FFD700" }}>
              ${totalAmount.toFixed(2)}
            </ThemedText>
          </View>
        </View>

        {/* Info */}
        <View style={[styles.infoCard, { backgroundColor: "rgba(255, 215, 0, 0.1)" }]}>
          <Feather name="info" size={20} color="#FFD700" />
          <ThemedText type="small" style={styles.infoText}>
            Al confirmar, pasarás de forma segura a abonar el total mediante la pasarela integrada. Recibirás un código QR para canjear en el local.
          </ThemedText>
        </View>

        {/* Buttons */}
        <View style={styles.buttonsContainer}>
          <Button
            onPress={handleConfirm}
            disabled={isLoading || timeLeft === 0}
            style={[styles.confirmButton, { backgroundColor: AstroBarColors.primary }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              "CONFIRMAR Y PAGAR"
            )}
          </Button>

          <Pressable
            onPress={handleCancel}
            style={[styles.cancelButton, { borderColor: theme.border }]}
          >
            <ThemedText type="body" style={{ color: theme.text }}>
              Cancelar
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: Spacing.xl },
  header: { marginBottom: Spacing.xl },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: { color: "#FFFFFF" },
  timerCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: "center", marginBottom: Spacing.xl },
  timerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AstroBarColors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  timerText: { color: "#FFFFFF", fontSize: 48, fontWeight: "800" },
  timerLabel: { color: "rgba(255,255,255,0.8)" },
  timerMessage: { textAlign: "center" },
  card: { borderRadius: BorderRadius.xl, padding: Spacing.xl, marginBottom: Spacing.lg },
  cardTitle: { marginBottom: Spacing.xs },
  cardSubtitle: { color: AstroBarColors.primary, marginBottom: Spacing.lg },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: Spacing.md },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  infoCard: { flexDirection: "row", padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl, gap: Spacing.sm },
  infoText: { flex: 1, color: "#FFD700" },
  buttonsContainer: { gap: Spacing.md },
  confirmButton: { height: 56 },
  cancelButton: { height: 56, borderRadius: BorderRadius.lg, borderWidth: 2, justifyContent: "center", alignItems: "center" },
});