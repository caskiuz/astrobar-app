import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useBusiness, Business } from "@/contexts/BusinessContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MyBusinessesRouteProp = RouteProp<RootStackParamList, "MyBusinesses">;

const BUSINESS_TYPES = [
  { id: "bar", name: "Bar", icon: "coffee" },
  { id: "nightclub", name: "Discoteca", icon: "music" },
  { id: "pub", name: "Pub", icon: "beer" },
  { id: "lounge", name: "Lounge", icon: "star" },
  { id: "restaurant_bar", name: "Restaurante Bar", icon: "utensils" },
];

export default function MyBusinessesScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MyBusinessesRouteProp>();
  const { user } = useAuth();
  const { 
    businesses, 
    selectedBusiness, 
    isLoading, 
    loadBusinesses, 
    selectBusiness,
    createBusiness,
    deleteBusiness,
  } = useBusiness();

  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [businessToDelete, setBusinessToDelete] = useState<Business | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [businessLat, setBusinessLat] = useState<number | null>(null);
  const [businessLng, setBusinessLng] = useState<number | null>(null);

  const [newBusiness, setNewBusiness] = useState({
    name: "",
    description: "",
    type: "bar",
    address: "",
    phone: "",
    image: "",
  });

  useEffect(() => {
    const params = route.params;
    if (!params) return;

    if (params.openAddModal) {
      setShowAddModal(true);
    }

    if (params.draft) {
      setNewBusiness((prev) => ({
        ...prev,
        name: params.draft?.name || prev.name,
        type: params.draft?.type || prev.type,
        address: params.draft?.address || prev.address,
        phone: params.draft?.phone || prev.phone || user?.phone || "",
      }));
    }

    if (params.openAddModal || params.draft) {
      navigation.setParams({ openAddModal: undefined, draft: undefined });
    }
  }, [navigation, route.params, user?.phone]);

  useFocusEffect(
    useCallback(() => {
      loadBusinesses();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBusinesses();
    setRefreshing(false);
  };

  const handleSelectBusiness = async (business: Business) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await selectBusiness(business);
    // Solo volver atr�s si no estamos en la pantalla principal de perfil
    // Permitir editar si estamos navegando desde perfil
  };

  const handlePickImage = async () => {
    console.log('?? Iniciando selecci�n de imagen');
    try {
      setUploadingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      console.log('?? Resultado:', { canceled: result.canceled, hasAssets: !!result.assets?.[0] });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        console.log('?? Imagen convertida, tama�o:', base64Image.length);
        setNewBusiness(prev => ({ ...prev, image: base64Image }));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert('�xito', 'Imagen seleccionada. Presiona Actualizar.');
      }
    } catch (error) {
      console.error('?? Error:', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePickLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Necesitamos acceso a tu ubicaci�n");
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

      setNewBusiness(prev => ({ ...prev, address: fullAddress }));
      setBusinessLat(location.coords.latitude);
      setBusinessLng(location.coords.longitude);
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("�xito", "Ubicaci�n obtenida");
    } catch (error) {
      Alert.alert("Error", "No se pudo obtener la ubicaci�n");
    }
  };

  const handleEditBusiness = (business: Business) => {
    setEditingBusiness(business);
    setNewBusiness({
      name: business.name,
      description: business.description || "",
      type: business.type || "bar",
      address: business.address || "",
      phone: business.phone || "",
      image: business.image || "",
    });
    setShowEditModal(true);
  };

  const handleUpdateBusiness = async () => {
    console.log('?? Actualizando negocio');
    if (!editingBusiness || !newBusiness.name.trim()) {
      Alert.alert("Error", "El nombre del negocio es requerido");
      return;
    }

    console.log('?? Datos:', { id: editingBusiness.id, hasImage: !!newBusiness.image, imageSize: newBusiness.image?.length });

    setSubmitting(true);
    try {
      const response = await apiRequest("PUT", `/api/business/${editingBusiness.id}`, {
        ...newBusiness,
        latitude: businessLat,
        longitude: businessLng,
      });
      const data = await response.json();
      
      console.log('?? Respuesta:', data);
      
      if (data.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowEditModal(false);
        setEditingBusiness(null);
        await loadBusinesses();
        Alert.alert("�xito", "Negocio actualizado correctamente");
      } else {
        Alert.alert("Error", data.error || "No se pudo actualizar");
      }
    } catch (error: any) {
      console.error('?? Error:', error);
      Alert.alert("Error", error.message || "No se pudo actualizar el negocio");
    } finally {
      setSubmitting(false);
    }
  };
  const handleCreateBusiness = async () => {
    if (!newBusiness.name.trim()) {
      Alert.alert("Error", "El nombre del negocio es requerido");
      return;
    }

    setSubmitting(true);
    try {
      await createBusiness(newBusiness);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAddModal(false);
      setNewBusiness({
        name: "",
        description: "",
        type: "bar",
        address: "",
        phone: "",
        image: "",
      });
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo crear el negocio");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (business: Business) => {
    setBusinessToDelete(business);
    setShowDeleteModal(true);
  };

  const handleDeleteBusiness = async () => {
    if (!businessToDelete) return;

    setSubmitting(true);
    try {
      await deleteBusiness(businessToDelete.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowDeleteModal(false);
      setBusinessToDelete(null);
    } catch (error: any) {
      Alert.alert("Error", error.message || "No se pudo eliminar el negocio");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `$${(amount / 100).toFixed(2)}`;
  };

  const getImageUrl = (imagePath: string | undefined): string | undefined => {
    if (!imagePath) {
      return "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop";
    }
    if (imagePath.startsWith("data:image")) return imagePath;
    if (imagePath.startsWith("http")) return imagePath;
    return `${getApiUrl()}${imagePath}`;
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.backgroundDefault,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: insets.top + Spacing.md,
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.md,
      backgroundColor: AstroBarColors.primary,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
      marginRight: Spacing.md,
    },
    headerContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: "#fff",
    },
    headerSubtitle: {
      fontSize: 14,
      color: "rgba(255,255,255,0.8)",
      marginTop: 4,
    },
    content: {
      flex: 1,
      padding: Spacing.lg,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: AstroBarColors.primary,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.lg,
      ...Shadows.md,
    },
    addButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
      marginLeft: Spacing.sm,
    },
    businessCard: {
      backgroundColor: theme.colors.card,
      borderRadius: BorderRadius.lg,
      marginBottom: Spacing.md,
      overflow: "hidden",
      ...Shadows.sm,
    },
    selectedCard: {
      borderWidth: 2,
      borderColor: AstroBarColors.primary,
    },
    businessImage: {
      width: "100%",
      height: 120,
      backgroundColor: theme.colors.border,
    },
    businessImagePlaceholder: {
      width: "100%",
      height: 120,
      backgroundColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
    },
    businessInfo: {
      padding: Spacing.md,
    },
    businessHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    businessName: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 4,
      borderRadius: BorderRadius.sm,
      marginLeft: Spacing.sm,
    },
    openBadge: {
      backgroundColor: AstroBarColors.success + "20",
    },
    closedBadge: {
      backgroundColor: theme.colors.border,
    },
    statusText: {
      fontSize: 12,
      fontWeight: "600",
    },
    businessType: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    statsRow: {
      flexDirection: "row",
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    statItem: {
      flex: 1,
      alignItems: "center",
    },
    statValue: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.colors.text,
    },
    statLabel: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing.md,
    },
    actionButtonDanger: {
      borderLeftWidth: 1,
      borderLeftColor: theme.colors.border,
    },
    actionText: {
      fontSize: 14,
      fontWeight: "600",
      marginLeft: Spacing.xs,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      backgroundColor: "#ffffff",
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
      paddingBottom: insets.bottom + Spacing['3xl'],
      maxHeight: "90%",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.text,
      marginBottom: Spacing.lg,
      textAlign: "center",
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.text,
      marginBottom: Spacing.xs,
    },
    input: {
      backgroundColor: theme.colors.backgroundDefault,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      fontSize: 16,
      color: theme.colors.text,
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    textArea: {
      minHeight: 80,
      textAlignVertical: "top",
    },
    typeSelector: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    typeOption: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.full,
      backgroundColor: theme.colors.backgroundDefault,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    typeOptionSelected: {
      backgroundColor: AstroBarColors.primary + "20",
      borderColor: AstroBarColors.primary,
    },
    typeOptionText: {
      fontSize: 14,
      marginLeft: Spacing.xs,
      color: theme.colors.text,
    },
    imagePickerButton: {
      backgroundColor: theme.colors.backgroundDefault,
      borderRadius: BorderRadius.md,
      padding: Spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: Spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
      minHeight: 120,
    },
    selectedImage: {
      width: "100%",
      height: 120,
      borderRadius: BorderRadius.md,
    },
    imagePickerText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: Spacing.sm,
    },
    modalButtons: {
      flexDirection: "row",
      gap: Spacing.md,
      marginTop: Spacing.lg,
    },
    modalButton: {
      flex: 1,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
      alignItems: "center",
    },
    cancelButton: {
      backgroundColor: theme.colors.backgroundDefault,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    confirmButton: {
      backgroundColor: AstroBarColors.primary,
    },
    deleteButton: {
      backgroundColor: AstroBarColors.error,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: "600",
    },
    deleteModalContent: {
      backgroundColor: theme.colors.card,
      borderRadius: BorderRadius.xl,
      padding: Spacing.lg,
      marginHorizontal: Spacing.lg,
      alignItems: "center",
    },
    deleteIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: AstroBarColors.error + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.md,
    },
    deleteMessage: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.sm,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: Spacing["2xl"],
    },
    emptyIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.border,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: Spacing.lg,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.text,
    },
    emptySubtext: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginTop: Spacing.xs,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
  });

  if (isLoading && businesses.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>Mis Negocios</ThemedText>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AstroBarColors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText style={styles.headerTitle}>Mis Negocios</ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            {businesses.length} {businesses.length === 1 ? "negocio" : "negocios"} registrados
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={AstroBarColors.primary}
          />
        }
      >
        <Pressable style={styles.addButton} onPress={() => setShowAddModal(true)}>
          <Feather name="plus" size={20} color="#fff" />
          <ThemedText style={styles.addButtonText}>Agregar Nuevo Negocio</ThemedText>
        </Pressable>

        {businesses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="briefcase" size={36} color={theme.colors.textSecondary} />
            </View>
            <ThemedText style={styles.emptyText}>Sin negocios</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Agrega tu primer negocio para comenzar
            </ThemedText>
          </View>
        ) : (
          businesses.map((business: any, index: number) => (
            <Animated.View
              key={business.id}
              entering={FadeInDown.delay(index * 100)}
            >
              <Pressable
                style={[
                  styles.businessCard,
                  selectedBusiness?.id === business.id && styles.selectedCard,
                ]}
                onPress={() => handleSelectBusiness(business)}
              >
                {business.image || true ? (
                  <Image
                    source={{ uri: getImageUrl(business.image) }}
                    style={styles.businessImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.businessImagePlaceholder}>
                    <Feather name="image" size={32} color={theme.colors.textSecondary} />
                  </View>
                )}

                <View style={styles.businessInfo}>
                  <View style={styles.businessHeader}>
                    <ThemedText style={styles.businessName} numberOfLines={1}>
                      {business.name}
                    </ThemedText>
                    <View
                      style={[
                        styles.statusBadge,
                        business.isOpen ? styles.openBadge : styles.closedBadge,
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.statusText,
                          { color: business.isOpen ? AstroBarColors.success : theme.colors.textSecondary },
                        ]}
                      >
                        {business.isOpen ? "Abierto" : "Cerrado"}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={styles.businessType}>
                    {BUSINESS_TYPES.find(t => t.id === business.type)?.name || "Negocio"}
                  </ThemedText>

                  {business.stats && (
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>
                          {business.stats.pendingOrders}
                        </ThemedText>
                        <ThemedText style={styles.statLabel}>Pendientes</ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>
                          {business.stats.todayOrders}
                        </ThemedText>
                        <ThemedText style={styles.statLabel}>Hoy</ThemedText>
                      </View>
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statValue}>
                          {formatCurrency(business.stats.todayRevenue)}
                        </ThemedText>
                        <ThemedText style={styles.statLabel}>Ingresos</ThemedText>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.actionsRow}>
                  <Pressable
                    style={styles.actionButton}
                    onPress={() => handleEditBusiness(business)}
                  >
                    <Feather name="edit-2" size={18} color={AstroBarColors.primary} />
                    <ThemedText style={[styles.actionText, { color: AstroBarColors.primary }]}>
                      Editar
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.actionButtonDanger]}
                    onPress={() => confirmDelete(business)}
                  >
                    <Feather name="trash-2" size={18} color={AstroBarColors.error} />
                    <ThemedText style={[styles.actionText, { color: AstroBarColors.error }]}>
                      Eliminar
                    </ThemedText>
                  </Pressable>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Nuevo Negocio</ThemedText>

            <ThemedText style={styles.inputLabel}>Nombre *</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Nombre del negocio"
              placeholderTextColor={theme.colors.textSecondary}
              value={newBusiness.name}
              onChangeText={(text) => setNewBusiness(prev => ({ ...prev, name: text }))}
            />

            <ThemedText style={styles.inputLabel}>Descripcion</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Breve descripcion de tu negocio"
              placeholderTextColor={theme.colors.textSecondary}
              value={newBusiness.description}
              onChangeText={(text) => setNewBusiness(prev => ({ ...prev, description: text }))}
              multiline
            />

            <ThemedText style={styles.inputLabel}>Tipo de negocio</ThemedText>
            <View style={styles.typeSelector}>
              {BUSINESS_TYPES.map(type => (
                <Pressable
                  key={type.id}
                  style={[
                    styles.typeOption,
                    newBusiness.type === type.id && styles.typeOptionSelected,
                  ]}
                  onPress={() => setNewBusiness(prev => ({ ...prev, type: type.id }))}
                >
                  <Feather
                    name={type.icon as any}
                    size={16}
                    color={newBusiness.type === type.id ? AstroBarColors.primary : theme.colors.text}
                  />
                  <ThemedText style={styles.typeOptionText}>{type.name}</ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.inputLabel}>Direccion</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Direccion del negocio"
              placeholderTextColor={theme.colors.textSecondary}
              value={newBusiness.address}
              onChangeText={(text) => setNewBusiness(prev => ({ ...prev, address: text }))}
            />

            <ThemedText style={styles.inputLabel}>Telefono</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Numero de contacto"
              placeholderTextColor={theme.colors.textSecondary}
              value={newBusiness.phone}
              onChangeText={(text) => setNewBusiness(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />

            <ThemedText style={styles.inputLabel}>Imagen del negocio</ThemedText>
            <Pressable style={styles.imagePickerButton} onPress={handlePickImage} disabled={uploadingImage}>
              {uploadingImage ? (
                <>
                  <ActivityIndicator size="large" color={AstroBarColors.primary} />
                  <ThemedText style={styles.imagePickerText}>
                    Procesando imagen...
                  </ThemedText>
                </>
              ) : newBusiness.image ? (
                <Image
                  source={{ uri: getImageUrl(newBusiness.image) }}
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Feather name="camera" size={32} color={theme.colors.textSecondary} />
                  <ThemedText style={styles.imagePickerText}>
                    Toca para seleccionar imagen
                  </ThemedText>
                </>
              )}
            </Pressable>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <ThemedText style={[styles.buttonText, { color: theme.colors.text }]}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleCreateBusiness}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: "#fff" }]}>
                    Crear Negocio
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Business Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Editar Negocio</ThemedText>

            <ThemedText style={styles.inputLabel}>Nombre *</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Nombre del negocio"
              placeholderTextColor={theme.colors.textSecondary}
              value={newBusiness.name}
              onChangeText={(text) => setNewBusiness(prev => ({ ...prev, name: text }))}
            />

            <ThemedText style={styles.inputLabel}>Descripcion</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Breve descripcion de tu negocio"
              placeholderTextColor={theme.colors.textSecondary}
              value={newBusiness.description}
              onChangeText={(text) => setNewBusiness(prev => ({ ...prev, description: text }))}
              multiline
            />

            <ThemedText style={styles.inputLabel}>Tipo de negocio</ThemedText>
            <View style={styles.typeSelector}>
              {BUSINESS_TYPES.map(type => (
                <Pressable
                  key={type.id}
                  style={[
                    styles.typeOption,
                    newBusiness.type === type.id && styles.typeOptionSelected,
                  ]}
                  onPress={() => setNewBusiness(prev => ({ ...prev, type: type.id }))}
                >
                  <Feather
                    name={type.icon as any}
                    size={16}
                    color={newBusiness.type === type.id ? AstroBarColors.primary : theme.colors.text}
                  />
                  <ThemedText style={styles.typeOptionText}>{type.name}</ThemedText>
                </Pressable>
              ))}
            </View>

            <ThemedText style={styles.inputLabel}>Direccion</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Direccion del negocio"
              placeholderTextColor={theme.colors.textSecondary}
              value={newBusiness.address}
              onChangeText={(text) => setNewBusiness(prev => ({ ...prev, address: text }))}
            />

            <ThemedText style={styles.inputLabel}>Telefono</ThemedText>
            <TextInput
              style={styles.input}
              placeholder="Numero de contacto"
              placeholderTextColor={theme.colors.textSecondary}
              value={newBusiness.phone}
              onChangeText={(text) => setNewBusiness(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />

            <Pressable
              style={[styles.modalButton, styles.confirmButton, { marginBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
              onPress={handlePickLocation}
            >
              <Feather name="map-pin" size={18} color="#fff" />
              <ThemedText style={[styles.buttonText, { color: "#fff", marginLeft: 8 }]}>
                Usar mi ubicacion GPS
              </ThemedText>
            </Pressable>
            {businessLat && businessLng && (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
                <Feather name="check-circle" size={16} color="#4CAF50" />
                <ThemedText style={{ color: "#4CAF50", marginLeft: 6, fontSize: 12 }}>
                  Ubicaci�n configurada ({businessLat.toFixed(4)}, {businessLng.toFixed(4)})
                </ThemedText>
              </View>
            )}

            <ThemedText style={styles.inputLabel}>Imagen del negocio</ThemedText>
            <Pressable style={styles.imagePickerButton} onPress={handlePickImage} disabled={uploadingImage}>
              {uploadingImage ? (
                <>
                  <ActivityIndicator size="large" color={AstroBarColors.primary} />
                  <ThemedText style={styles.imagePickerText}>
                    Procesando imagen...
                  </ThemedText>
                </>
              ) : newBusiness.image ? (
                <Image
                  source={{ uri: getImageUrl(newBusiness.image) }}
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Feather name="camera" size={32} color={theme.colors.textSecondary} />
                  <ThemedText style={styles.imagePickerText}>
                    Toca para seleccionar imagen
                  </ThemedText>
                </>
              )}
            </Pressable>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingBusiness(null);
                }}
              >
                <ThemedText style={[styles.buttonText, { color: theme.colors.text }]}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleUpdateBusiness}
                disabled={submitting || uploadingImage}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: "#fff" }]}>
                    Actualizar
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={[styles.modalOverlay, { justifyContent: "center" }]}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteIcon}>
              <Feather name="alert-triangle" size={32} color={AstroBarColors.error} />
            </View>
            <ThemedText style={styles.modalTitle}>Eliminar Negocio</ThemedText>
            <ThemedText style={styles.deleteMessage}>
              Esta acci�n no se puede deshacer. Si el negocio tiene pedidos activos, no podr� ser eliminado.
            </ThemedText>

            <View style={[styles.modalButtons, { width: "100%" }]}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <ThemedText style={[styles.buttonText, { color: theme.colors.text }]}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteBusiness}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: "#fff" }]}>
                    Eliminar
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
