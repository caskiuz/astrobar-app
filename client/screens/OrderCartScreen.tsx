import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, AstroBarColors, Shadows } from '@/constants/theme';
import { useUnifiedCart } from '@/contexts/UnifiedCartContext';

export default function OrderCartScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const navigation = useNavigation<any>();
  const { items, removeItem, updateQuantity, updateNotes, getTotal, clearCart } = useUnifiedCart();

  const [platformCommission] = useState(0.15); // 15% por defecto

  const subtotal = getTotal();
  const commissionAmount = Math.round(subtotal * platformCommission);
  const total = subtotal + commissionAmount;

  // 🪐 ENRUTAMIENTO PREMIUM NATIVO ACTUALIZADO
  const handleCheckout = () => {
    if (items.length === 0) {
      Alert.alert('Carrito vacío', 'Agrega productos para continuar');
      return;
    }

    // Volvemos al flujo original automatizado usando el nombre real de tu pasarela en el Stack
    // Le pasamos el 'total' y los 'items' tal cual los espera tu backend para generar el initPoint
    navigation.navigate('OrderPayment', { 
      total, 
      items 
    });
  };

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="h2" style={{ marginLeft: Spacing.md }}>
            Carrito de Pedidos
          </ThemedText>
        </View>
        <View style={styles.emptyContainer}>
          <Feather name="shopping-cart" size={64} color={theme.textSecondary} />
          <ThemedText style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
            Tu carrito está vacío
          </ThemedText>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.button, { backgroundColor: AstroBarColors.primary, marginTop: Spacing.xl }]}
          >
            <ThemedText style={{ color: '#FFFFFF', fontWeight: '600' }}>
              Ver menú
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h2" style={{ flex: 1, marginLeft: Spacing.md }}>
          Carrito ({items.length})
        </ThemedText>
        <Pressable onPress={() => {
          Alert.alert('Vaciar carrito', '¿Estás seguro?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Vaciar', style: 'destructive', onPress: clearCart },
          ]);
        }}>
          <Feather name="trash-2" size={20} color={AstroBarColors.error} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 200 }]}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => (
          <View key={item.id} style={[styles.itemCard, { backgroundColor: theme.card }, Shadows.sm]}>
            {item.image && (
              <Image source={{ uri: item.image }} style={styles.itemImage} />
            )}
            <View style={styles.itemInfo}>
              <ThemedText type="body" style={{ fontWeight: '600' }}>
                {item.name}
              </ThemedText>
              <ThemedText type="small" style={{ color: AstroBarColors.primary, marginTop: 4 }}>
                ${(item.price / 100).toFixed(2)} c/u
              </ThemedText>
              
              <View style={styles.quantityContainer}>
                <Pressable
                  onPress={() => updateQuantity(item.id, item.quantity - 1)}
                  style={[styles.quantityButton, { backgroundColor: theme.border }]}
                >
                  <Feather name="minus" size={16} color={theme.text} />
                </Pressable>
                <ThemedText type="body" style={{ marginHorizontal: Spacing.md, minWidth: 30, textAlign: 'center' }}>
                  {item.quantity}
                </ThemedText>
                <Pressable
                  onPress={() => updateQuantity(item.id, item.quantity + 1)}
                  style={[styles.quantityButton, { backgroundColor: AstroBarColors.primary }]}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                </Pressable>
              </View>

              <TextInput
                placeholder="Notas especiales (opcional)"
                placeholderTextColor={theme.textSecondary}
                value={item.notes || ''}
                onChangeText={(text) => updateNotes(item.id, text)}
                style={[styles.notesInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                multiline
              />
            </View>

            <View style={styles.itemActions}>
              <ThemedText type="h3" style={{ color: AstroBarColors.primary }}>
                ${((item.price * item.quantity) / 100).toFixed(2)}
              </ThemedText>
              <Pressable onPress={() => removeItem(item.id)} style={{ marginTop: Spacing.sm }}>
                <Feather name="x" size={20} color={AstroBarColors.error} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.md }, Shadows.lg]}>
        <View style={styles.summaryRow}>
          <ThemedText type="body">Subtotal</ThemedText>
          <ThemedText type="body">${(subtotal / 100).toFixed(2)}</ThemedText>
        </View>
        <View style={styles.summaryRow}>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            Comisión plataforma ({(platformCommission * 100).toFixed(0)}%)
          </ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            ${(commissionAmount / 100).toFixed(2)}
          </ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.summaryRow}>
          <ThemedText type="h3">Total</ThemedText>
          <ThemedText type="h3" style={{ color: AstroBarColors.primary }}>
            ${(total / 100).toFixed(2)}
          </ThemedText>
        </View>
        <Pressable
          onPress={handleCheckout}
          style={[styles.checkoutButton, { backgroundColor: AstroBarColors.primary }]}
        >
          <ThemedText style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
            Pagar ${(total / 100).toFixed(2)}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  scrollContent: { paddingHorizontal: Spacing.lg },
  itemCard: { flexDirection: 'row', borderRadius: BorderRadius.lg, marginBottom: Spacing.md, overflow: 'hidden', padding: Spacing.md },
  itemImage: { width: 80, height: 80, borderRadius: BorderRadius.md, marginRight: Spacing.md },
  itemInfo: { flex: 1 },
  itemActions: { alignItems: 'flex-end', justifyContent: 'space-between', marginLeft: Spacing.sm },
  quantityContainer: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.sm },
  quantityButton: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  notesInput: { marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, fontSize: 12, minHeight: 40 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  divider: { height: 1, marginVertical: Spacing.sm },
  checkoutButton: { paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, alignItems: 'center', marginTop: Spacing.md },
  button: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg },
});