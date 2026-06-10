import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, Pressable, TextInput, Alert, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  image?: string;
  isAvailable: boolean;
}

// 🪐 TIPADO ESTRICTO DE RUTAS PARA EVITAR CRASHES NATIVOS
type RootStackParamList = {
  CreateFlashPromotion: { editPromotion?: any };
};

type CreateFlashPromotionRouteProp = RouteProp<RootStackParamList, "CreateFlashPromotion">;

export default function CreateFlashPromotionScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const styles = getStyles();
  const navigation = useNavigation<any>();
  const route = useRoute<CreateFlashPromotionRouteProp>();
  
  // Seguro anti-crasheos si el ToastContext no está inicializado en este árbol de navegación
  const toastContext = useToast();
  const showToast = toastContext?.showToast || console.log;

  const editPromotion = route?.params?.editPromotion;
  const isEditing = !!editPromotion;
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [discountedPrice, setDiscountedPrice] = useState("");
  const [stock, setStock] = useState("");
  const [duration, setDuration] = useState<5 | 10 | 15>(5);
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [customImage, setCustomImage] = useState("");

  useEffect(() => {
    loadProducts();
    if (!isEditing) {
      checkLimits();
    } else if (editPromotion) {
      setDiscountedPrice(editPromotion.promoPrice?.toString() || "");
      setStock(editPromotion.stock?.toString() || "");
      setCustomImage(editPromotion.image || "");
    }
  }, [editPromotion, isEditing]);

  useEffect(() => {
    if (showProductSelector) {
      loadProducts();
    }
  }, [showProductSelector]);

  const checkLimits = async () => {
    try {
      const response = await apiRequest("GET", "/api/business/limits");
      const data = await response.json();
      
      if (data.success && data.limits) {
        if (!data.limits.flashPromotions.canAdd) {
          Alert.alert(
            "Límite alcanzado",
            `Ya tienes ${data.limits.flashPromotions.current} promociones flash activas. El máximo es ${data.limits.flashPromotions.max}. Espera a que terminen o pausa alguna.`,
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        }
      }
    } catch (error) {
      console.error("Error checking limits:", error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await apiRequest("GET", "/api/business/products");
      const data = await response.json();
      if (data.success && data.products) {
        const availableProducts = data.products.filter((p: Product) => p.isAvailable);
        setProducts(availableProducts);
        
        // Si estamos editando, auto-seleccionamos el producto correspondiente
        if (isEditing && editPromotion) {
          const found = availableProducts.find((p: Product) => p.id === editPromotion.productId);
          if (found) setSelectedProduct(found);
        }
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedProduct || !discountedPrice || !stock) {
      Alert.alert("Error", "Selecciona un producto y completa todos los campos");
      return;
    }

    const discountPrice = parseFloat(discountedPrice);
    if (discountPrice >= selectedProduct.price) {
      Alert.alert("Error", "El precio promocional debe ser menor al precio original");
      return;
    }

    setLoading(true);
    try {
      const promotionData = {
        businessId: "",
        title: `${selectedProduct.name} - Promoción Flash`,
        description: selectedProduct.description || `Promoción flash de ${selectedProduct.name}`,
        type: "flash",
        originalPrice: selectedProduct.price,
        promoPrice: discountPrice,
        stock: parseInt(stock),
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + duration * 60 * 1000).toISOString(),
        image: customImage || selectedProduct.image
      };
      
      const url = isEditing ? `/api/promotions/${editPromotion.id}` : "/api/promotions";
      const method = isEditing ? "PUT" : "POST";
      const response = await apiRequest(method, url, promotionData);
      const data = await response.json();
      
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(isEditing ? "Promoción actualizada" : "Promoción flash creada", "success");
        navigation.goBack();
      } else {
        Alert.alert("Error", data.error || "Ocurrió un problema en el servidor");
      }
    } catch (error: any) {
      console.error("Error:", error);
      Alert.alert("Error", error.message || "No se pudo guardar la promoción");
    } finally {
      setLoading(false);
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <Pressable
      style={styles.productCardNative}
      onPress={() => {
        setSelectedProduct(item);
        setDiscountedPrice("");
        setShowProductSelector(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <Image
        source={{ uri: item.image || "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop" }}
        style={styles.productImageNative}
        contentFit="cover"
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <ThemedText style={{ fontWeight: "800", fontSize: 15, color: '#FFF' }}>{item.name}</ThemedText>
        <ThemedText style={{ color: '#94a3b8', fontSize: 12, marginTop: 2, fontWeight: '500' }}>{item.category}</ThemedText>
        <ThemedText style={{ color: "#a855f7", fontWeight: "900", fontSize: 14, marginTop: 4 }}>${item.price.toLocaleString('es-AR')}</ThemedText>
      </View>
    </Pressable>
  );

  if (loadingProducts) {
    return (
      <View style={[styles.container, styles.centerView, { backgroundColor: '#05080f' }]}>
        <ActivityIndicator size="large" color="#a855f7" />
      </View>
    );
  }

  return (
    <LinearGradient colors={['#05080f', '#0b111e']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 40 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backButtonNative}>
          <Feather name="arrow-left" size={22} color="#a855f7" />
        </Pressable>

        <ThemedText style={styles.screenTitle}>
          {isEditing ? "Editar Oferta Flash" : "Lanzar Oferta Flash"}
        </ThemedText>
        <ThemedText style={styles.screenSubtitle}>
          Configurá los disparadores de tiempo y stock inmediato.
        </ThemedText>

        <View style={styles.formCardNative}>
          <ThemedText style={styles.inputLabelNative}>Seleccionar Producto comercial *</ThemedText>
          <Pressable
            style={styles.productSelectorNative}
            onPress={() => setShowProductSelector(true)}
          >
            {selectedProduct ? (
              <View style={styles.selectedProductNative}>
                <Image
                  source={{ uri: selectedProduct.image || "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop" }}
                  style={styles.selectedProductImageNative}
                  contentFit="cover"
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <ThemedText style={{ fontWeight: "800", color: '#FFF', fontSize: 15 }}>{selectedProduct.name}</ThemedText>
                  <ThemedText style={{ color: '#94a3b8', fontSize: 12 }}>Precio Carta: ${selectedProduct.price.toLocaleString('es-AR')}</ThemedText>
                </View>
              </View>
            ) : (
              <ThemedText style={{ color: '#64748b', fontWeight: '500' }}>Toca para abrir la lista del menú...</ThemedText>
            )}
            <Feather name="chevron-down" size={20} color="#a855f7" />
          </Pressable>

          <ThemedText style={styles.inputLabelNative}>Precio Promocional Líquido *</ThemedText>
          <TextInput
            style={styles.inputNative}
            value={discountedPrice}
            onChangeText={setDiscountedPrice}
            placeholder={selectedProduct ? `Debe ser menor a ${selectedProduct.price}` : "Ingresá el valor de oferta"}
            placeholderTextColor="#64748b"
            keyboardType="numeric"
          />

          <ThemedText style={styles.inputLabelNative}>Unidades de Stock Limitado *</ThemedText>
          <TextInput
            style={styles.inputNative}
            value={stock}
            onChangeText={setStock}
            placeholder="Ej: 15 canillas o combos"
            placeholderTextColor="#64748b"
            keyboardType="numeric"
          />

          <ThemedText style={styles.inputLabelNative}>Duración en Radar (Minutos) *</ThemedText>
          <View style={styles.durationRowNative}>
            {[5, 10, 15].map((min) => {
              const isSelected = duration === min;
              return (
                <Pressable
                  key={min}
                  onPress={() => {
                    setDuration(min as 5 | 10 | 15);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.durationButtonNative,
                    isSelected ? styles.durationActiveNative : styles.durationInactiveNative
                  ]}
                >
                  <ThemedText style={[styles.durationTextNative, { color: isSelected ? "#05080f" : "#cbd5e1" }]}>
                    {min} min
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={handleCreate}
          disabled={loading || !selectedProduct}
          style={({ pressed }) => [
            styles.createButtonNative,
            { backgroundColor: pressed ? "rgba(168, 85, 247, 0.85)" : "#a855f7" },
            (loading || !selectedProduct) && { opacity: 0.4 }
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#05080f" />
          ) : (
            <>
              <Feather name="zap" size={18} color="#05080f" style={{ marginRight: 8 }} />
              <ThemedText style={styles.createButtonTextNative}>
                {isEditing ? "Confirmar Modificación" : "Lanzar Promoción Flash"}
              </ThemedText>
            </>
          )}
        </Pressable>
      </ScrollView>

      {showProductSelector && (
        <View style={styles.modalOverlayNative}>
          <View style={styles.modalContentNative}>
            <View style={styles.modalHeaderNative}>
              <ThemedText style={{ fontSize: 18, fontWeight: '900', color: '#FFF' }}>Vincular Producto</ThemedText>
              <Pressable style={styles.closeModalBtn} onPress={() => setShowProductSelector(false)}>
                <Feather name="x" size={20} color="#a855f7" />
              </Pressable>
            </View>
            <FlatList
              data={products}
              renderItem={renderProduct}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyProductsNative}>
                  <Feather name="package" size={40} color="#64748b" />
                  <ThemedText style={{ color: '#94a3b8', marginTop: Spacing.md, fontWeight: '700' }}>
                    No hay productos en carta
                  </ThemedText>
                  <ThemedText style={{ color: '#64748b', textAlign: "center", marginTop: 4, fontSize: 13 }}>
                    Cargá insumos dentro de la sección Menú primero.
                  </ThemedText>
                </View>
              }
            />
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerView: { justifyContent: "center", alignItems: "center" },
  scrollContent: { paddingHorizontal: Spacing.lg },
  backButtonNative: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.04)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", marginBottom: Spacing.md },
  screenTitle: { fontSize: 22, fontWeight: '900', color: '#FFF' },
  screenSubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2, marginBottom: Spacing.xl, fontWeight: '500' },
  
  formCardNative: { padding: Spacing.lg, borderRadius: BorderRadius.lg, backgroundColor: "rgba(15, 23, 42, 0.55)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.06)" },
  inputLabelNative: { fontSize: 13, fontWeight: "700", color: "#cbd5e1", marginBottom: 6, marginTop: Spacing.md },
  inputNative: { height: 48, backgroundColor: "rgba(5, 8, 15, 0.4)", borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, fontSize: 15, color: "#FFF", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  
  productSelectorNative: { height: 52, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(5, 8, 15, 0.4)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectedProductNative: { flexDirection: "row", alignItems: "center", flex: 1 },
  selectedProductImageNative: { width: 36, height: 36, borderRadius: BorderRadius.sm },
  
  durationRowNative: { flexDirection: "row", gap: Spacing.sm, marginTop: 4 },
  durationButtonNative: { flex: 1, height: 46, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  durationActiveNative: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  durationInactiveNative: { backgroundColor: 'rgba(5, 8, 15, 0.4)', borderColor: 'rgba(255,255,255,0.1)' },
  durationTextNative: { fontSize: 14, fontWeight: '800' },
  
  createButtonNative: { flexDirection: "row", height: 50, borderRadius: BorderRadius.full, alignItems: "center", justifyContent: "center", marginTop: Spacing.xl, ...Shadows.md, shadowColor: "#a855f7", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  createButtonTextNative: { color: "#05080f", fontWeight: "900", fontSize: 15, letterSpacing: 0.3 },
  
  modalOverlayNative: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(5, 8, 15, 0.85)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContentNative: { width: "100%", maxWidth: 400, borderRadius: BorderRadius.xl, padding: 20, maxHeight: "75%", backgroundColor: '#0b111e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  modalHeaderNative: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg, paddingBottom: Spacing.sm, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  closeModalBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  
  productCardNative: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(15, 23, 42, 0.4)" },
  productImageNative: { width: 46, height: 46, borderRadius: BorderRadius.sm },
  emptyProductsNative: { alignItems: "center", justifyContent: "center", paddingVertical: 40 },
});