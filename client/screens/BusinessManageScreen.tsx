import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isAvailable: boolean;
}

interface Business {
  id: string;
  name: string;
  description?: string;
  address?: string;
  phone?: string;
  image?: string;
  latitude?: number;
  longitude?: number;
  isOpen: boolean;
  products: Product[];
}

export default function BusinessManageScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme: rawTheme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isDark = rawTheme?.background === "#000000" || rawTheme?.background === "black" || rawTheme?.background === "#121212";

  const theme = {
    card: isDark ? '#111927' : (rawTheme?.card || rawTheme?.colors?.card || "#FFFFFF"),
    border: isDark ? '#1f293d' : (rawTheme?.border || rawTheme?.colors?.border || "#E0E0E0"),
    textSecondary: isDark ? '#94a3b8' : (rawTheme?.textSecondary || rawTheme?.colors?.textSecondary || "#A0A0A0"),
    surface: isDark ? '#0b111e' : (rawTheme?.colors?.surface || rawTheme?.card || "#FFFFFF"),
    text: isDark ? '#ffffff' : (rawTheme?.text || rawTheme?.colors?.text || "#000000"),
  };

  const [editMode, setEditMode] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessImage, setBusinessImage] = useState("");
  const [businessLat, setBusinessLat] = useState<number | null>(null);
  const [businessLng, setBusinessLng] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const {
    data: business,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery<Business>({
    queryKey: ["/api/business", user?.id, "details"],
    enabled: !!user?.id,
  });

  const toggleBusinessMutation = useMutation({
    mutationFn: async ({ businessId, isOpen }: { businessId: string; isOpen: boolean }) => {
      await apiRequest("PUT", `/api/business/${businessId}`, {
        name: businessName || business?.name,
        address: businessAddress || business?.address,
        latitude: businessLat || business?.latitude,
        longitude: businessLng || business?.longitude,
        isOpen: isOpen
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business", user?.id, "details"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      Alert.alert("Error", "No se pudo cambiar el estado del bar");
    }
  });

  const handleToggleBusiness = (isOpen: boolean) => {
    if (business) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toggleBusinessMutation.mutate({ businessId: business.id, isOpen });
    }
  };

  React.useEffect(() => {
    if (business) {
      setBusinessName(business.name || "");
      setBusinessDescription(business.description || "");
      setBusinessAddress(business.address || "");
      setBusinessPhone(business.phone || "");
      setBusinessImage(business.image || "");
      setBusinessLat(business.latitude || null);
      setBusinessLng(business.longitude || null);
    }
  }, [business]);

  const handlePickLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Necesitamos acceso a tu ubicación");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const geocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      const fullAddress = geocode[0]
        ? `${geocode[0].street || ""} ${geocode[0].streetNumber || ""}, ${geocode[0].city || ""}, ${geocode[0].region || ""}`.trim()
        : "Buenos Aires, Argentina";
      setBusinessAddress(fullAddress);
      setBusinessLat(location.coords.latitude);
      setBusinessLng(location.coords.longitude);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Éxito", "Ubicación obtenida de forma correcta");
    } catch (error) {
      Alert.alert("Error", "No se pudo obtener la ubicación");
    }
  };

  const handleSaveSettings = async () => {
    if (!businessName.trim()) {
      Alert.alert("Error", "El nombre del bar es obligatorio");
      return;
    }
    if (!businessLat || !businessLng) {
      Alert.alert("Error", "Debes configurar la ubicación");
      return;
    }
    try {
      await apiRequest("PUT", `/api/business/${business?.id}`, {
        name: businessName.trim(),
        description: businessDescription.trim() || "",
        address: businessAddress.trim(),
        phone: businessPhone.trim() || "",
        image: businessImage || "",
        latitude: Number(businessLat),
        longitude: Number(businessLng),
        isOpen: business?.isOpen ?? false,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Éxito", "Información actualizada");
      setEditMode(false);
      refetch();
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar los cambios");
    }
  };

  const placeholderTextColor = theme.textSecondary || "#A0A0A0";

  if (isLoading) {
    return (
      <ThemedView style={[styles.center, { backgroundColor: theme.surface }]}>
        <ActivityIndicator size="large" color="#00f2fe" />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.surface, paddingTop: insets.top }]}>
      
      {/* 🪐 CAMBIO GLOBAL: Barra superior de navegación unificada en cian neón */}
      <View style={[styles.topNav, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={({ pressed }) => [
            styles.navButton,
            { backgroundColor: pressed ? "rgba(0, 242, 254, 0.15)" : "rgba(0, 242, 254, 0.08)" }
          ]}
          onPress={() => navigation.navigate('BusinessPromotions' as never)}
        >
          <Feather name="megaphone" size={16} color="#00f2fe" />
          <ThemedText style={styles.navButtonText}>Promociones</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00f2fe" />
        }
      >
        <View style={styles.header}>
          <ThemedText type="h2" style={{ color: theme.text, fontWeight: '800' }}>Ajustes del Bar</ThemedText>
        </View>

        {/* Card VIP de Estado Abierto/Cerrado */}
        <View style={[styles.businessCard, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: isDark ? 1 : 0 }, Shadows.md]}>
          <View style={styles.businessRow}>
            <View>
              <ThemedText type="h3" style={{ color: theme.text, fontWeight: '700' }}>{business?.name || "Mi Negocio"}</ThemedText>
              <ThemedText type="caption" style={{ color: business?.isOpen ? "#39ff14" : "#ff4c4c", marginTop: 4, fontWeight: "800", fontSize: 13 }}>
                {business?.isOpen ? "Abierto ahora" : "Cerrado temporalmente"}
              </ThemedText>
            </View>
            <Switch
              value={business?.isOpen ?? false}
              onValueChange={handleToggleBusiness}
              trackColor={{ false: "#4b5563", true: "rgba(0, 242, 254, 0.25)" }}
              thumbColor={business?.isOpen ? "#00f2fe" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* Formulario */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.form}>
          <ThemedText type="body" style={[styles.label, { color: theme.text }]}>Nombre del Bar *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? '#162235' : theme.card, color: theme.text, borderColor: theme.border }]}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Ej. Astro Bar"
            placeholderTextColor={placeholderTextColor}
          />

          <ThemedText type="body" style={[styles.label, { color: theme.text }]}>Descripción</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: isDark ? '#162235' : theme.card, color: theme.text, borderColor: theme.border }]}
            value={businessDescription}
            onChangeText={setBusinessDescription}
            placeholder="Contale a tus clientes sobre tu bar..."
            placeholderTextColor={placeholderTextColor}
            multiline
            numberOfLines={3}
          />

          <ThemedText type="body" style={[styles.label, { color: theme.text }]}>Teléfono de Contacto</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? '#162235' : theme.card, color: theme.text, borderColor: theme.border }]}
            value={businessPhone}
            onChangeText={setBusinessPhone}
            placeholder="Ej. 1123456789"
            placeholderTextColor={placeholderTextColor}
            keyboardType="phone-pad"
          />

          <ThemedText type="body" style={[styles.label, { color: theme.text }]}>Dirección física *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: isDark ? '#0d1527' : '#eceff1', color: theme.text, borderColor: theme.border, opacity: 0.85 }]}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            placeholder="Dirección del local"
            placeholderTextColor={placeholderTextColor}
            editable={false}
          />

          {/* 🪐 BOTÓN GPS PURGADO Y CONVERTIDO A CIAN NEÓN */}
          <Pressable 
            style={({ pressed }) => [
              styles.geoButtonNative,
              { backgroundColor: pressed ? "rgba(0, 242, 254, 0.85)" : "#00f2fe" }
            ]} 
            onPress={handlePickLocation}
          >
            <Feather name="map-pin" size={15} color="#05080f" style={{ marginRight: 8 }} />
            <ThemedText style={styles.geoButtonTextNative}>Obtener Ubicación por GPS</ThemedText>
          </Pressable>

          {businessLat && businessLng && (
            <ThemedText type="caption" style={[styles.geoSuccess, { color: '#39ff14', fontWeight: '700', marginTop: Spacing.sm }]}>
              ✓ Coordenadas fijadas: ({businessLat.toFixed(4)}, {businessLng.toFixed(4)})
            </ThemedText>
          )}

          {/* 🪐 BOTONES DE ACCIÓN ACCESIBLES SIN TEXTO RECORTADO */}
          <View style={styles.actionRow}>
            <Pressable 
              style={({ pressed }) => [
                styles.btnNative, 
                styles.btnCancelNative, 
                { 
                  borderColor: theme.border, 
                  backgroundColor: pressed ? "rgba(255,255,255,0.05)" : (isDark ? '#111927' : 'transparent') 
                }
              ]} 
              onPress={() => refetch()}
            >
              <ThemedText style={[styles.btnCancelTextNative, { color: theme.textSecondary }]}>Restablecer</ThemedText>
            </Pressable>

            <Pressable 
              style={({ pressed }) => [
                styles.btnNative, 
                styles.btnSaveNative, 
                { backgroundColor: pressed ? "rgba(0, 242, 254, 0.85)" : "#00f2fe" }
              ]} 
              onPress={handleSaveSettings}
            >
              <ThemedText style={styles.btnSaveTextNative}>Guardar Cambios</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  topNav: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  navButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: "rgba(0, 242, 254, 0.2)" },
  navButtonText: { marginLeft: Spacing.xs, fontSize: 13, color: '#00f2fe', fontWeight: '800', letterSpacing: 0.5 },
  header: { paddingVertical: Spacing.xs, marginBottom: Spacing.xs },
  businessCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md },
  businessRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  form: { marginTop: Spacing.xs },
  label: { fontWeight: "700", marginBottom: 6, marginTop: Spacing.sm, fontSize: 14 },
  input: { height: 48, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, fontSize: 15, fontWeight: '500' },
  textArea: { height: 84, paddingTop: Spacing.sm, textAlignVertical: "top" },
  
  // 🔮 REESTRUCTURACIÓN DE BOTÓN GPS NATIVO PREMIUM
  geoButtonNative: { 
    flexDirection: "row", 
    height: 50, 
    borderRadius: BorderRadius.md, 
    justifyContent: "center", 
    alignItems: "center", 
    marginTop: Spacing.md, 
    shadowColor: "#00f2fe",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4 
  },
  geoButtonTextNative: { color: "#05080f", fontWeight: "900", fontSize: 14, letterSpacing: 0.5, includeFontPadding: false, textAlignVertical: "center" },
  geoSuccess: { marginTop: Spacing.xs, textAlign: "center" },
  actionRow: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.xl, gap: Spacing.md },
  
  // 🔮 REESTRUCTURACIÓN NATIVA DE BOTONES INFERIORES SINFÍN DE RE CORTES
  btnNative: { flex: 1, height: 50, borderRadius: BorderRadius.md, justifyContent: "center", alignItems: "center" },
  btnCancelNative: { borderWidth: 1.5 },
  btnCancelTextNative: { fontWeight: "800", fontSize: 15, includeFontPadding: false, textAlignVertical: "center" },
  btnSaveNative: { shadowColor: "#00f2fe", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnSaveTextNative: { color: "#05080f", fontWeight: "900", fontSize: 15, letterSpacing: 0.5, includeFontPadding: false, textAlignVertical: "center" },
});