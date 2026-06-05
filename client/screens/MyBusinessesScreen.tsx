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
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import Animated, { FadeInDown } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  };

  const handlePickImage = async () => {
    try {
      setUploadingImage(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setNewBusiness(prev => ({ ...prev, image: base64Image }));
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        Alert.alert('Éxito', 'Imagen vinculada correctamente.');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
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

      setNewBusiness(prev => ({ ...prev, address: fullAddress }));
      setBusinessLat(location.coords.latitude);
      setBusinessLng(location.coords.longitude);
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Éxito", "Ubicación obtenida");
    } catch (error) {
      Alert.alert("Error", "No se pudo obtener la ubicación");
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
    if (!editingBusiness || !newBusiness.name.trim()) {
      Alert.alert("Error", "El nombre del negocio es requerido");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiRequest("PUT", `/api/business/${editingBusiness.id}`, {
        ...newBusiness,
        latitude: businessLat,
        longitude: businessLng,
      });
      const data = await response.json();
      
      if (data.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowEditModal(false);
        setEditingBusiness(null);
        await loadBusinesses();
        Alert.alert("Éxito", "Negocio actualizado correctamente");
      } else {
        Alert.alert("Error", data.error || "No se pudo actualizar");
      }
    } catch (error: any) {
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

  if (isLoading && businesses.length === 0) {
    return (
      <View style={[styles.container, styles.centerView]}>
        <ActivityIndicator size="large" color="#00f2fe" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🪐 NUEVA CABECERA ULTRA MODERNA CYBERPUNK (Adiós bloque violeta sólido) */}
      <BlurView intensity={40} tint="dark" style={[styles.headerContainer, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerCore}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButtonNative}>
            <Feather name="arrow-left" size={22} color="#00f2fe" />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={styles.headerTitle}>Mis Negocios</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              {businesses.length} {businesses.length === 1 ? "negocio" : "negocios"} en la red AstroBar
            </ThemedText>
          </View>
        </View>
      </BlurView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00f2fe" />
        }
      >
        {/* 🪐 BOTÓN AGREGAR CON REESTRUCTURACIÓN CIAN NEÓN */}
        <Pressable style={({ pressed }) => [
          styles.addButtonNative,
          { backgroundColor: pressed ? "rgba(0, 242, 254, 0.85)" : "#00f2fe" }
        ]} onPress={() => setShowAddModal(true)}>
          <Feather name="plus" size={18} color="#05080f" style={{ marginRight: 6 }} />
          <ThemedText style={styles.addButtonTextNative}>Agregar Nuevo Negocio</ThemedText>
        </Pressable>

        {businesses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="briefcase" size={32} color="#94a3b8" />
            </View>
            <ThemedText style={styles.emptyText}>Sin comercios vinculados</ThemedText>
            <ThemedText style={styles.emptySubtext}>Vinculá tu primer bar para empezar a lanzar promos.</ThemedText>
          </View>
        ) : (
          businesses.map((business: any, index: number) => {
            const isSelected = selectedBusiness?.id === business.id;
            return (
              <Animated.View key={business.id} entering={FadeInDown.delay(index * 80)}>
                <Pressable
                  style={[
                    styles.businessCardNative,
                    isSelected && styles.selectedCardNative,
                  ]}
                  onPress={() => handleSelectBusiness(business)}
                >
                  <Image
                    source={{ uri: getImageUrl(business.image) }}
                    style={styles.businessImageNative}
                    resizeMode="cover"
                  />
                  
                  {/* Sutil difuminado oscuro sobre el asset gráfico */}
                  <LinearGradient colors={['transparent', 'rgba(11, 17, 30, 0.95)']} style={styles.imageGradient} />

                  <View style={styles.businessInfoNative}>
                    <View style={styles.businessHeaderCore}>
                      <ThemedText style={styles.businessNameNative} numberOfLines={1}>
                        {business.name}
                      </ThemedText>
                      <View style={[styles.statusBadgeNative, business.isOpen ? styles.openBadgeNative : styles.closedBadgeNative]}>
                        <ThemedText style={[styles.statusTextNative, { color: business.isOpen ? "#39ff14" : "#94a3b8" }]}>
                          {business.isOpen ? "Abierto" : "Cerrado"}
                        </ThemedText>
                      </View>
                    </View>
                    
                    <ThemedText style={styles.businessTypeNative}>
                      {BUSINESS_TYPES.find(t => t.id === business.type)?.name || "Establecimiento Nocturno"}
                    </ThemedText>

                    {business.stats && (
                      <View style={styles.statsGridNative}>
                        <View style={styles.statBox}>
                          <ThemedText style={styles.statValueNative}>{business.stats.pendingOrders}</ThemedText>
                          <ThemedText style={styles.statLabelNative}>Pendientes</ThemedText>
                        </View>
                        <View style={styles.statBox}>
                          <ThemedText style={styles.statValueNative}>{business.stats.todayOrders}</ThemedText>
                          <ThemedText style={styles.statLabelNative}>Hoy</ThemedText>
                        </View>
                        <View style={styles.statBox}>
                          <ThemedText style={styles.statValueNative}>{formatCurrency(business.stats.todayRevenue)}</ThemedText>
                          <ThemedText style={styles.statLabelNative}>Caja</ThemedText>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* 🪐 ACCIONES INTERNAS REDISEÑADAS EN FILA */}
                  <View style={styles.actionsRowNative}>
                    <Pressable style={styles.actionButtonNative} onPress={() => handleEditBusiness(business)}>
                      <Feather name="edit-3" size={16} color="#00f2fe" style={{ marginRight: 6 }} />
                      <ThemedText style={[styles.actionTextNative, { color: "#00f2fe" }]}>Editar</ThemedText>
                    </Pressable>
                    <Pressable style={[styles.actionButtonNative, styles.dangerActionBorder]} onPress={() => confirmDelete(business)}>
                      <Feather name="trash-2" size={16} color="#ff4c4c" style={{ marginRight: 6 }} />
                      <ThemedText style={[styles.actionTextNative, { color: "#ff4c4c" }]}>Eliminar</ThemedText>
                    </Pressable>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>

      {/* 🪐 MODAL AGREGAR NEGOCIO ESTILIZADO */}
      <Modal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlayNative}>
          <View style={styles.modalContentNative}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.modalTitleNative}>Nuevo Comercio</ThemedText>

              <ThemedText style={styles.inputLabelNative}>Nombre del bar *</ThemedText>
              <TextInput style={styles.inputNative} placeholder="Ej. Astro Bar Central" placeholderTextColor="#64748b" value={newBusiness.name} onChangeText={(text) => setNewBusiness(prev => ({ ...prev, name: text }))} />

              <ThemedText style={styles.inputLabelNative}>Descripción comercial</ThemedText>
              <TextInput style={[styles.inputNative, styles.textAreaNative]} placeholder="Breve reseña o lema del bar..." placeholderTextColor="#64748b" value={newBusiness.description} onChangeText={(text) => setNewBusiness(prev => ({ ...prev, description: text }))} multiline numberOfLines={3} />

              <ThemedText style={styles.inputLabelNative}>Categoría de Establecimiento</ThemedText>
              <View style={styles.typeSelectorNative}>
                {BUSINESS_TYPES.map(type => (
                  <Pressable key={type.id} style={[styles.typeOptionNative, newBusiness.type === type.id && styles.typeOptionSelectedNative]} onPress={() => setNewBusiness(prev => ({ ...prev, type: type.id }))}>
                    <Feather name={type.icon as any} size={14} color={newBusiness.type === type.id ? "#00f2fe" : "#94a3b8"} />
                    <ThemedText style={[styles.typeOptionTextNative, { color: newBusiness.type === type.id ? "#00f2fe" : "#cbd5e1" }]}>{type.name}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <ThemedText style={styles.inputLabelNative}>Dirección Física</ThemedText>
              <TextInput style={styles.inputNative} placeholder="Calle, Altura, Localidad" placeholderTextColor="#64748b" value={newBusiness.address} onChangeText={(text) => setNewBusiness(prev => ({ ...prev, address: text }))} />

              <ThemedText style={styles.inputLabelNative}>Teléfono de Atención</ThemedText>
              <TextInput style={styles.inputNative} placeholder="Ej. 11 9388 52" placeholderTextColor="#64748b" value={newBusiness.phone} onChangeText={(text) => setNewBusiness(prev => ({ ...prev, phone: text }))} keyboardType="phone-pad" />

              <ThemedText style={styles.inputLabelNative}>Imagen Representativa</ThemedText>
              <Pressable style={styles.imagePickerButtonNative} onPress={handlePickImage}>
                {uploadingImage ? (
                  <ActivityIndicator size="small" color="#00f2fe" />
                ) : newBusiness.image ? (
                  <Image source={{ uri: getImageUrl(newBusiness.image) }} style={styles.selectedImageNative} resizeMode="cover" />
                ) : (
                  <View style={{ alignItems: 'center' }}>
                    <Feather name="camera" size={24} color="#00f2fe" />
                    <ThemedText style={styles.imagePickerTextNative}>Cargar Banner Comercial</ThemedText>
                  </View>
                )}
              </Pressable>

              <View style={styles.modalButtonsNative}>
                <Pressable style={[styles.modalButtonNative, styles.cancelBtnNative]} onPress={() => setShowAddModal(false)}>
                  <ThemedText style={{ color: '#94a3b8', fontWeight: '700' }}>Cancelar</ThemedText>
                </Pressable>
                <Pressable style={[styles.modalButtonNative, styles.confirmBtnNative]} onPress={handleCreateBusiness}>
                  <ThemedText style={{ color: '#05080f', fontWeight: '900' }}>Crear Comercio</ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🪐 MODAL EDITAR NEGOCIO ESTILIZADO */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => { setShowEditModal(false); setEditingBusiness(null); }}>
        <View style={styles.modalOverlayNative}>
          <View style={styles.modalContentNative}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <ThemedText style={styles.modalTitleNative}>Editar Datos</ThemedText>

              <ThemedText style={styles.inputLabelNative}>Nombre Comercial *</ThemedText>
              <TextInput style={styles.inputNative} placeholder="Nombre del negocio" placeholderTextColor="#64748b" value={newBusiness.name} onChangeText={(text) => setNewBusiness(prev => ({ ...prev, name: text }))} />

              <ThemedText style={styles.inputLabelNative}>Descripción</ThemedText>
              <TextInput style={[styles.inputNative, styles.textAreaNative]} placeholder="Descripción..." placeholderTextColor="#64748b" value={newBusiness.description} onChangeText={(text) => setNewBusiness(prev => ({ ...prev, description: text }))} multiline />

              <Pressable style={styles.gpsBtnNative} onPress={handlePickLocation}>
                <Feather name="map-pin" size={16} color="#05080f" style={{ marginRight: 6 }} />
                <ThemedText style={{ color: '#05080f', fontWeight: '900', fontSize: 14 }}>Actualizar Ubicación GPS</ThemedText>
              </Pressable>

              <View style={styles.modalButtonsNative}>
                <Pressable style={[styles.modalButtonNative, styles.cancelBtnNative]} onPress={() => { setShowEditModal(false); setEditingBusiness(null); }}>
                  <ThemedText style={{ color: '#94a3b8', fontWeight: '700' }}>Cancelar</ThemedText>
                </Pressable>
                <Pressable style={[styles.modalButtonNative, styles.confirmBtnNative]} onPress={handleUpdateBusiness}>
                  <ThemedText style={{ color: '#05080f', fontWeight: '900' }}>Guardar Cambios</ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 🪐 MODAL CONFIRMACIÓN DE BORRADO */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={[styles.modalOverlayNative, { justifyContent: 'center', backgroundColor: 'rgba(5, 8, 15, 0.9)' }]}>
          <View style={styles.deleteContentCardNative}>
            <Feather name="alert-triangle" size={36} color="#ff4c4c" style={{ marginBottom: Spacing.sm }} />
            <ThemedText style={styles.modalTitleNative}>¿Eliminar comercio?</ThemedText>
            <ThemedText style={{ color: '#94a3b8', textAlign: 'center', marginVertical: Spacing.md, fontSize: 14, fontWeight: '500' }}>
              Esta operación es irreversible. Los bares con reservas vigentes o promociones activas en curso no se podrán remover.
            </ThemedText>
            <View style={{ flexDirection: 'row', gap: Spacing.md, width: '100%' }}>
              <Pressable style={[styles.modalButtonNative, styles.cancelBtnNative]} onPress={() => setShowDeleteModal(false)}>
                <ThemedText style={{ color: '#cbd5e1', fontWeight: '700' }}>Volver atrás</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalButtonNative, { backgroundColor: '#ff4c4c' }]} onPress={handleDeleteBusiness}>
                <ThemedText style={{ color: '#fff', fontWeight: '900' }}>Eliminar</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#05080f" },
  centerView: { justifyContent: "center", alignItems: "center" },
  headerContainer: { paddingBottom: Spacing.md, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(11, 17, 30, 0.4)" },
  headerCore: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg },
  backButtonNative: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", marginRight: Spacing.md },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#FFF" },
  headerSubtitle: { fontSize: 13, color: "#94a3b8", marginTop: 2, fontWeight: "500" },
  content: { flex: 1, padding: Spacing.lg },
  
  addButtonNative: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 48, borderRadius: BorderRadius.md, marginBottom: Spacing.xl, shadowColor: "#00f2fe", shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  addButtonTextNative: { color: "#05080f", fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  
  businessCardNative: { backgroundColor: "rgba(15, 23, 42, 0.55)", borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, overflow: "hidden", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.08)" },
  selectedCardNative: { borderColor: "#00f2fe", shadowColor: "#00f2fe", shadowOpacity: 0.2, shadowRadius: 10 },
  businessImageNative: { width: "100%", height: 140 },
  imageGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  businessInfoNative: { padding: Spacing.md, marginTop: -40, zIndex: 2 },
  businessHeaderCore: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  businessNameNative: { fontSize: 19, fontWeight: "900", color: "#FFF", flex: 1 },
  statusBadgeNative: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.sm, marginLeft: Spacing.sm },
  openBadgeNative: { backgroundColor: "rgba(57, 255, 20, 0.15)" },
  closedBadgeNative: { backgroundColor: "rgba(255,255,255,0.08)" },
  statusTextNative: { fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  businessTypeNative: { fontSize: 13, color: "#94a3b8", fontWeight: "600", marginTop: 2 },
  
  statsGridNative: { flexDirection: "row", marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  statBox: { flex: 1, alignItems: "center" },
  statValueNative: { fontSize: 16, fontWeight: "900", color: "#00f2fe" },
  statLabelNative: { fontSize: 11, color: "#94a3b8", marginTop: 2, fontWeight: "500" },
  
  actionsRowNative: { flexDirection: "row", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(5, 8, 15, 0.4)" },
  actionButtonNative: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md },
  dangerActionBorder: { borderLeftWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  actionTextNative: { fontSize: 14, fontWeight: "800", includeFontPadding: false },
  
  modalOverlayNative: { flex: 1, backgroundColor: "rgba(5, 8, 15, 0.8)", justifyContent: "flex-end" },
  modalContentNative: { backgroundColor: "#0b111e", borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg, paddingBottom: Spacing['3xl'], maxHeight: "85%", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  modalTitleNative: { fontSize: 20, fontWeight: "900", color: "#FFF", marginBottom: Spacing.lg, textAlign: "center" },
  inputLabelNative: { fontSize: 13, fontWeight: "700", color: "#cbd5e1", marginBottom: 6 },
  inputNative: { backgroundColor: "rgba(15, 23, 42, 0.6)", borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 15, color: "#FFF", marginBottom: Spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  textAreaNative: { minHeight: 70, textAlignVertical: "top" },
  
  typeSelectorNative: { flexDirection: "row", flexWrap: "wrap", marginBottom: Spacing.md, gap: Spacing.xs },
  typeOptionNative: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: "rgba(15, 23, 42, 0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  typeOptionSelectedNative: { backgroundColor: "rgba(0, 242, 254, 0.15)", borderColor: "#00f2fe" },
  typeOptionTextNative: { fontSize: 13, marginLeft: 6, fontWeight: "600" },
  
  imagePickerButtonNative: { backgroundColor: "rgba(15, 23, 42, 0.4)", borderRadius: BorderRadius.md, padding: Spacing.lg, alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.12)", borderStyle: "dashed", minHeight: 100 },
  selectedImageNative: { width: "100%", height: 100, borderRadius: BorderRadius.md },
  imagePickerTextNative: { fontSize: 13, color: "#94a3b8", marginTop: Spacing.xs, fontWeight: "600" },
  
  modalButtonsNative: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  modalButtonNative: { flex: 1, height: 46, borderRadius: BorderRadius.md, justifyContent: "center", alignItems: "center" },
  cancelBtnNative: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  confirmBtnNative: { backgroundColor: "#00f2fe" },
  gpsBtnNative: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#00f2fe', height: 46, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  
  deleteContentCardNative: { backgroundColor: "#0b111e", borderRadius: BorderRadius.xl, padding: Spacing.xl, marginHorizontal: Spacing.lg, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing["2xl"] },
  emptyIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: "rgba(255,255,255,0.05)", justifyContent: "center", alignItems: "center", marginBottom: Spacing.md },
  emptyText: { fontSize: 17, fontWeight: "800", color: "#FFF" },
  emptySubtext: { fontSize: 13, color: "#94a3b8", marginTop: 4, textAlign: "center" },
});