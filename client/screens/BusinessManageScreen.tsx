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

  // Normalización segura del tema visual
  const theme = {
    card: rawTheme?.card || rawTheme?.colors?.card || "#FFFFFF",
    border: rawTheme?.border || rawTheme?.colors?.border || "#E0E0E0",
    textSecondary: rawTheme?.textSecondary || rawTheme?.colors?.textSecondary || "#A0A0A0",
    surface: rawTheme?.colors?.surface || rawTheme?.card || "#FFFFFF",
    text: rawTheme?.text || rawTheme?.colors?.text || "#000000",
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

  // CORRECCIÓN: El switch ahora le pega a la ruta de business propia del dueño
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

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Necesitamos acceso a tus fotos");
        return;
      }
      setUploadingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setBusinessImage(base64Image);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo seleccionar la imagen");
    } finally {
      setUploadingImage(false);
    }
  };

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
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color={AstroBarColors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Barra superior de navegación */}
      <View style={[styles.topNav, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable
          style={styles.navButton}
          onPress={() => navigation.navigate('BusinessPromotions' as never)}
        >
          <Feather name="megaphone" size={20} color={theme.textSecondary} />
          <ThemedText style={[styles.navButtonText, { color: theme.textSecondary }]}>Promociones</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={AstroBarColors.primary} />
        }
      >
        <View style={styles.header}>
          <ThemedText type="h2">Ajustes del Bar</ThemedText>
        </View>

        {/* Card de Estado Abierto/Cerrado */}
        <View style={[styles.businessCard, { backgroundColor: theme.card }, Shadows.md]}>
          <View style={styles.businessRow}>
            <View>
              <ThemedText type="h3">{business?.name || "Mi Negocio"}</ThemedText>
              <ThemedText type="caption" style={{ color: business?.isOpen ? "#4CAF50" : "#F44336", marginTop: 4, fontWeight: "bold" }}>
                {business?.isOpen ? "Abierto" : "Cerrado"}
              </ThemedText>
            </View>
            <Switch
              value={business?.isOpen ?? false}
              onValueChange={handleToggleBusiness}
              trackColor={{ false: "#F44336", true: "#4CAF50" }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* FORMULARIO RESTAURADO */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.form}>
          <ThemedText type="body" style={styles.label}>Nombre del Bar *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Ej. Astro Bar"
            placeholderTextColor={placeholderTextColor}
          />

          <ThemedText type="body" style={styles.label}>Descripción</ThemedText>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            value={businessDescription}
            onChangeText={setBusinessDescription}
            placeholder="Contale a tus clientes sobre tu bar..."
            placeholderTextColor={placeholderTextColor}
            multiline
            numberOfLines={3}
          />

          <ThemedText type="body" style={styles.label}>Teléfono de Contacto</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            value={businessPhone}
            onChangeText={setBusinessPhone}
            placeholder="Ej. 1123456789"
            placeholderTextColor={placeholderTextColor}
            keyboardType="phone-pad"
          />

          <ThemedText type="body" style={styles.label}>Dirección física *</ThemedText>
          <TextInput
            style={[styles.input, { backgroundColor: theme.card, color: theme.text, borderColor: theme.border }]}
            value={businessAddress}
            onChangeText={setBusinessAddress}
            placeholder="Dirección del local"
            placeholderTextColor={placeholderTextColor}
            editable={false}
          />

          {/* Botón de GPS */}
          <Pressable 
            style={[styles.geoButton, { backgroundColor: AstroBarColors.primary }]} 
            onPress={handlePickLocation}
          >
            <Feather name="map-pin" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
            <ThemedText style={styles.geoButtonText}>Obtener Ubicación por GPS</ThemedText>
          </Pressable>

          {businessLat && businessLng && (
            <ThemedText type="caption" style={styles.geoSuccess}>
              ✓ Coordenadas fijadas: ({businessLat.toFixed(4)}, {businessLng.toFixed(4)})
            </ThemedText>
          )}

          {/* Botones de acción */}
          <View style={styles.actionRow}>
            <Pressable 
              style={[styles.btn, styles.btnCancel, { borderColor: theme.border }]} 
              onPress={() => refetch()}
            >
              <ThemedText style={{ color: theme.textSecondary }}>Reestablecer</ThemedText>
            </Pressable>

            <Pressable 
              style={[styles.btn, styles.btnSave, { backgroundColor: AstroBarColors.primary }]} 
              onPress={handleSaveSettings}
            >
              <ThemedText style={styles.btnSaveText}>Guardar Cambios</ThemedText>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  topNav: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  navButtonText: {
    marginLeft: Spacing.xs,
    fontSize: 14,
    fontWeight: "500",
  },
  header: {
    paddingVertical: Spacing.sm,
  },
  businessCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  businessRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  form: {
    marginTop: Spacing.xs,
  },
  label: {
    fontWeight: "600",
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  textArea: {
    height: 80,
    paddingTop: Spacing.sm,
    textAlignVertical: "top",
  },
  geoButton: {
    flexDirection: "row",
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  geoButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  geoSuccess: {
    color: "#4CAF50",
    marginTop: Spacing.xs,
    textAlign: "center",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  btnCancel: {
    borderWidth: 1,
  },
  btnSave: {
    elevation: 2,
  },
  btnSaveText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});