import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Linking,
  Modal,
  Switch,
  ActivityIndicator,
  Platform,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";

import { ThemedText } from "@/components/ThemedText";
import { Badge } from "@/components/Badge";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useApp, ThemeMode } from "@/contexts/AppContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { resolveProfileImageUrl, addCacheBuster } from "@/lib/imageUtils";

type ProfileScreenNavigationProp =
  NativeStackNavigationProp<ProfileStackParamList>;

interface SettingsItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}

function SettingsItem({
  icon,
  label,
  value,
  onPress,
  danger,
}: SettingsItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsItem,
        {
          backgroundColor: pressed ? theme.backgroundSecondary : "transparent",
        }]}
    >
      <View
        style={[
          styles.settingsIcon,
          { backgroundColor: danger ? "#FFEBEE" : theme.backgroundSecondary }]}
      >
        <Feather
          name={icon}
          size={20}
          color={danger ? AstroBarColors.error : AstroBarColors.primary}
        />
      </View>
      <View style={styles.settingsContent}>
        <ThemedText
          type="body"
          style={{ color: danger ? AstroBarColors.error : theme.text }}
        >
          {label}
        </ThemedText>
        {value ? (
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  );
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" }];

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { settings, updateSettings } = useApp();
  const { user, logout, updateUser } = useAuth();
  const { showToast } = useToast();
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImageVersion, setProfileImageVersion] = useState(0);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfile, setEditProfile] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    email: user?.email || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showAddressesModal, setShowAddressesModal] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<Notifications.PermissionStatus>("undetermined");
  const [userStats, setUserStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const approvalStatus =
    user?.role === "business_owner" ? user?.isActive
        ? { text: "Aprobado", variant: "success" as const }
        : { text: "En revision", variant: "warning" as const }
      : null;
  const [driverStrikes, setDriverStrikes] = useState(0);
  const maxStrikes = 3;

  useEffect(() => {
    const loadDriverStatus = async () => {
      // Removed delivery driver functionality
    };
    loadDriverStatus();
  }, [user?.role]);

  useEffect(() => {
    const loadProfileFromServer = async () => {
      try {
        const response = await apiRequest("GET", "/api/user/profile");
        const data = await response.json();
        if (data.success && data.user) {
          if (data.user.profileImage) {
            const version = Date.now();
            setProfileImageVersion(version);
            const baseUrl = resolveProfileImageUrl(data.user.profileImage);
            setProfileImage(addCacheBuster(baseUrl, version));
            await updateUser({ profileImage: data.user.profileImage });
          }
        }
      } catch (error) {
        
      }
    };

    const loadUserStats = async () => {
      if (user?.role !== 'customer' && user?.role !== 'business_owner') return;
      setLoadingStats(true);
      try {
        const endpoint = user?.role === 'customer' ? '/api/user/stats' : '/api/business/stats';
        const response = await apiRequest("GET", endpoint);
        const data = await response.json();
        if (data.success) {
          setUserStats(data.stats);
        }
      } catch (error) {
        
      } finally {
        setLoadingStats(false);
      }
    };
    
    if (user) {
      loadProfileFromServer();
      loadUserStats();
    }
  }, []);

  useEffect(() => {
    if (user?.profileImage) {
      const version = profileImageVersion || Date.now();
      const baseUrl = resolveProfileImageUrl(user.profileImage);
      setProfileImage(addCacheBuster(baseUrl, version));
    }
  }, [user?.profileImage]);

  const getThemeLabel = (mode: ThemeMode) => {
    switch (mode) {
      case "system":
        return "Sistema";
      case "light":
        return "Claro";
      case "dark":
        return "Oscuro";
      default:
        return "Sistema";
    }
  };

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Permisos de galeráa denegados", "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, // reduce size to avoid backend limits
    });

    const asset = result?.assets?.[0];
    if (!result.canceled && asset?.uri) {
      await uploadImage(asset.uri);
    } else if (!result.canceled) {
      showToast("No se pudo leer la imagen seleccionada", "error");
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      let imageData: string;
      
      if (Platform.OS === "web") {
        // On web, fetch the blob and convert to base64
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        // On native, use FileSystem
        const encoding = (FileSystem as any)?.EncodingType?.Base64 || "base64";
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding,
        });
        const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
        const mimeType = extension === "png" ? "image/png" : "image/jpeg";
        imageData = `data:${mimeType};base64,${base64}`;
      }

      // Reject images larger than ~2 MB to avoid backend failures
      const estimatedBytes = Math.ceil(imageData.length * 0.75);
      if (estimatedBytes > 2 * 1024 * 1024) {
        throw new Error("La imagen es muy pesada. Usa una foto más ligera (~2MB max)");
      }

      const apiResponse = await apiRequest("POST", "/api/user/profile-image", {
        image: imageData,
      });

      const data = await apiResponse.json();

      if (data.success && data.profileImage) {
        const version = Date.now();
        setProfileImageVersion(version);
        const baseUrl = resolveProfileImageUrl(data.profileImage);
        setProfileImage(addCacheBuster(baseUrl, version));
        await updateUser({ profileImage: data.profileImage });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Imagen actualizada", "success");
      } else {
        throw new Error(data.error || "Error al subir imagen");
      }
    } catch (error: any) {
      console.error("Error uploading image:", error?.message || error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const friendly = error?.message || "No se pudo subir la imagen";
      showToast(friendly, "error");
      // Si el backend devolvióá texto de error completo (ej. 400: ...), muástralo para diagnástico en dispositivo.
      if (error?.message && error.message.includes(":")) {
        showToast(error.message, "error");
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message:
          "Descubre AstroBar - Tu plataforma de promociones nocturnas en Buenos Aires. Ofertas exclusivas en bares. https://astrobar.com.ar",
        title: "AstroBar - Promociones Nocturnas",
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const shareToSocialMedia = (platform: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = encodeURIComponent(
      "Descubre AstroBar - Tu plataforma de promociones nocturnas en Buenos Aires. Ofertas exclusivas en bares.");
    const url = encodeURIComponent("https://astrobar.com.ar");

    let shareUrl = "";
    switch (platform) {
      case "whatsapp":
        shareUrl = `whatsapp://send?text=${message}%20${url}`;
        break;
      case "facebook":
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${message}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?text=${message}&url=${url}`;
        break;
      case "telegram":
        shareUrl = `https://t.me/share/url?url=${url}&text=${message}`;
        break;
    }

    Linking.openURL(shareUrl).catch(() => {
      
    });
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowLogoutModal(false);
    await logout();
  };

  useEffect(() => {
    if (showNotificationsModal) {
      syncNotificationStatus();
    }
  }, [showNotificationsModal]);

  const syncNotificationStatus = async () => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      setNotificationStatus(permissions.status);
      return permissions.status;
    } catch (error) {
      console.error("Error consultando permisos de notificaciones", error);
      return notificationStatus;
    }
  };

  const handleThemeSelect = async (mode: ThemeMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setThemeMode(mode);
    setShowThemeModal(false);
  };

  const handleNotificationsToggle = async (value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (value) {
      const currentStatus = await syncNotificationStatus();
      let finalStatus = currentStatus;
      if (currentStatus !== "granted") {
        const requested = await Notifications.requestPermissionsAsync();
        finalStatus = requested.status;
        setNotificationStatus(finalStatus);
      }

      if (finalStatus !== "granted") {
        showToast("Activa permisos de notificacián en ajustes del sistema", "error");
        return;
      }
      await updateSettings({ notificationsEnabled: true });
      showToast("Notificaciones activadas", "success");
    } else {
      await updateSettings({ notificationsEnabled: false });
      showToast("Notificaciones desactivadas", "info");
    }
  };

  const getRoleLabel = () => {
    
    switch (user?.role) {
      case "customer":
        return "Cliente";
      case "business_owner":
        return "Dueño de Bar";
      case "admin":
      case "super_admin":
        return "Administrador";
      default:
        return user?.role || "Usuario";
    }
  };

  return (
    <LinearGradient
      colors={[theme.gradientStart || '#FFFFFF', theme.gradientEnd || '#F5F5F5']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: Spacing.xl + Math.max(tabBarHeight, insets.bottom + 64),
          }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.card },
            Shadows.md]}
        >
          <Pressable 
            style={styles.avatarContainer} 
            onPress={pickImage}
            disabled={isUploadingImage}
          >
            <Image
              source={
                profileImage
                  ? { uri: profileImage }
                  : require("../../assets/astrobarlogo.jpg")
              }
              style={[styles.avatar, isUploadingImage && { opacity: 0.5 }]}
              contentFit="cover"
            />
            {isUploadingImage ? (
              <View style={[styles.editBadge, { backgroundColor: AstroBarColors.primary }]}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : (
              <View
                style={[
                  styles.editBadge,
                  { backgroundColor: AstroBarColors.primary }]}
              >
                <Feather name="camera" size={14} color="#FFFFFF" />
              </View>
            )}
          </Pressable>
          <ThemedText type="h2" style={styles.userName}>
            {user?.name || "Usuario"}
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            {user?.phone ? user.phone.replace(/^(\+52)+/, '+52') : "Sin teláfono"}
          </ThemedText>
          <Badge
            text={getRoleLabel()}
            variant="primary"
            style={{ marginTop: Spacing.sm }}
          />
          {approvalStatus ? (
            <Badge
              text={approvalStatus.text}
              variant={approvalStatus.variant}
              style={{ marginTop: Spacing.xs }}
            />
          ) : null}
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <ThemedText type="h4" style={styles.sectionTitle}>
            Cuenta
          </ThemedText>
          <SettingsItem
            icon="user"
            label="Editar perfil"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setEditProfile({
                name: user?.name || "",
                phone: user?.phone || "",
                email: user?.email || "",
                currentPassword: "",
                newPassword: "",
                confirmPassword: ""
              });
              setShowEditProfileModal(true);
            }}
          />
          {user?.role === "customer" && (
            <SettingsItem
              icon="wallet"
              label="Mi billetera"
              value="Vincular Mercado Pago"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("CustomerWallet" as any);
              }}
            />
          )}
          {user?.role === "business_owner" && (
            <>
              <SettingsItem
                icon="briefcase"
                label="Mis negocios"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("MyBusinesses");
                }}
              />
              <SettingsItem
                icon="dollar-sign"
                label="Mi billetera"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("PaymentHistory");
                }}
              />
            </>
          )}
          {(user?.role === "admin" || user?.role === "super_admin") && (
            <SettingsItem
              icon="dollar-sign"
              label="Billetera de Plataforma"
              value="Ingresos y comisiones"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate("Wallet");
              }}
            />
          )}
        </View>

        {user?.role === 'customer' && userStats && (
          <View style={[styles.statsCard, { backgroundColor: theme.card }, Shadows.md]}>
            <View style={styles.statsHeader}>
              <Feather name="award" size={24} color={AstroBarColors.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Mis Estadísticas</ThemedText>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: AstroBarColors.primary }}>{userStats.totalPoints}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Puntos</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: AstroBarColors.success }}>{userStats.promotionsRedeemed}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Canjeadas</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: AstroBarColors.warning }}>{userStats.barsVisited}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Bares</ThemedText>
              </View>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: AstroBarColors.primaryLight }]}>
              <Feather name="star" size={16} color={AstroBarColors.primary} />
              <ThemedText type="body" style={{ color: AstroBarColors.primary, fontWeight: '600', marginLeft: Spacing.xs }}>
                Nivel: {userStats.currentLevel.charAt(0).toUpperCase() + userStats.currentLevel.slice(1)}
              </ThemedText>
            </View>
            {userStats.pointsToNextLevel > 0 && (
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }}>
                {userStats.pointsToNextLevel} puntos para el siguiente nivel
              </ThemedText>
            )}
          </View>
        )}

        {user?.role === 'business_owner' && userStats && (
          <View style={[styles.statsCard, { backgroundColor: theme.card }, Shadows.md]}>
            <View style={styles.statsHeader}>
              <Feather name="trending-up" size={24} color={AstroBarColors.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Estadísticas del Bar</ThemedText>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: AstroBarColors.primary }}>${userStats.totalRevenue || 0}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Ingresos</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: AstroBarColors.success }}>{userStats.totalPromotions || 0}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Promociones</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: AstroBarColors.warning }}>{userStats.totalRedemptions || 0}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>Canjes</ThemedText>
              </View>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: AstroBarColors.primaryLight }]}>
              <Feather name="star" size={16} color={AstroBarColors.primary} />
              <ThemedText type="body" style={{ color: AstroBarColors.primary, fontWeight: '600', marginLeft: Spacing.xs }}>
                Ranking: #{userStats.ranking || 'N/A'} • {userStats.rating || '0.0'} ⭐
              </ThemedText>
            </View>
            {userStats.activePromotions > 0 && (
              <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.sm }}>
                {userStats.activePromotions} promociones activas ahora
              </ThemedText>
            )}
          </View>
        )}

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <ThemedText type="h4" style={styles.sectionTitle}>
            Preferencias
          </ThemedText>
          <SettingsItem
            icon="moon"
            label="Tema"
            value={getThemeLabel(themeMode)}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowThemeModal(true);
            }}
          />
          <SettingsItem
            icon="bell"
            label="Notificaciones"
            value={settings.notificationsEnabled ? "Activadas" : "Desactivadas"}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowNotificationsModal(true);
            }}
          />
          <SettingsItem
            icon="globe"
            label="Idioma"
            value="Español"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowLanguageModal(true);
            }}
          />
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <ThemedText type="h4" style={styles.sectionTitle}>
            Más
          </ThemedText>
          <SettingsItem
            icon="share-2"
            label="Compartir AstroBar"
            onPress={handleShare}
          />
          <View style={styles.socialButtons}>
            <Pressable
              style={[styles.socialButton, { backgroundColor: "#25D366" }]}
              onPress={() => shareToSocialMedia("whatsapp")}
            >
              <Feather name="message-circle" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={[styles.socialButton, { backgroundColor: "#1877F2" }]}
              onPress={() => shareToSocialMedia("facebook")}
            >
              <Feather name="facebook" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={[styles.socialButton, { backgroundColor: "#1DA1F2" }]}
              onPress={() => shareToSocialMedia("twitter")}
            >
              <Feather name="twitter" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={[styles.socialButton, { backgroundColor: "#0088CC" }]}
              onPress={() => shareToSocialMedia("telegram")}
            >
              <Feather name="send" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          <SettingsItem
            icon="file-text"
            label="Términos y condiciones"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Terms' as any);
            }}
          />
          <SettingsItem
            icon="shield"
            label="Política de privacidad"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Privacy' as any);
            }}
          />
        </View>

        <View
          style={[styles.section, { backgroundColor: theme.card }, Shadows.sm]}
        >
          <SettingsItem
            icon="log-out"
            label="Cerrar sesión"
            onPress={handleLogout}
            danger
          />
        </View>

        <ThemedText
          type="caption"
          style={[styles.version, { color: theme.textSecondary }]}
        >
          AstroBar v1.0.0
        </ThemedText>
      </ScrollView>

      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLogoutModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={[styles.modalIcon, { backgroundColor: "#FFEBEE" }]}>
              <Feather name="log-out" size={28} color={AstroBarColors.error} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Cerrar sesión
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              áEstás seguro que deseas cerrar sesión?
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: theme.border }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.logoutButton]}
                onPress={confirmLogout}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFFFFF", fontWeight: "600" }}
                >
                  Cerrar sesión
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowThemeModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="moon" size={28} color={AstroBarColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Seleccionar tema
            </ThemedText>
            <View style={styles.themeOptions}>
              {themeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor:
                        themeMode === option.value
                          ? AstroBarColors.primaryLight
                          : theme.backgroundSecondary,
                      borderColor:
                        themeMode === option.value
                          ? AstroBarColors.primary
                          : "transparent",
                    }]}
                  onPress={() => handleThemeSelect(option.value)}
                >
                  <Feather
                    name={
                      option.value === "system"
                        ? "smartphone"
                        : option.value === "light"
                          ? "sun"
                          : "moon"
                    }
                    size={20}
                    color={
                      themeMode === option.value
                        ? AstroBarColors.primary
                        : theme.textSecondary
                    }
                  />
                  <ThemedText
                    type="body"
                    style={{
                      color:
                        themeMode === option.value
                          ? AstroBarColors.primary
                          : theme.text,
                      marginLeft: Spacing.sm,
                      fontWeight: themeMode === option.value ? "600" : "400",
                    }}
                  >
                    {option.label}
                  </ThemedText>
                  {themeMode === option.value ? (
                    <Feather
                      name="check"
                      size={20}
                      color={AstroBarColors.primary}
                      style={{ marginLeft: "auto" }}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setShowThemeModal(false)}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Cerrar
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showNotificationsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowNotificationsModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="bell" size={28} color={AstroBarColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Notificaciones
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              Recibe alertas sobre tus pedidos y promociones especiales. Si el permiso está bloqueado, debes activarlo en la configuracián del sistema.
            </ThemedText>
            <View style={[styles.strikeInfoCard, { backgroundColor: theme.backgroundSecondary, marginBottom: Spacing.md }]}>
              <Feather name="info" size={16} color={theme.textSecondary} />
              <ThemedText type="caption" style={{ color: theme.textSecondary, marginLeft: Spacing.sm, flex: 1 }}>
                Estado del permiso: {notificationStatus === "granted" ? "Permitido" : notificationStatus === "denied" ? "Bloqueado" : "Sin solicitar"}
              </ThemedText>
            </View>
            <View style={styles.switchRow}>
              <ThemedText type="body" style={{ color: theme.text }}>
                Activar notificaciones
              </ThemedText>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{
                  false: theme.border,
                  true: AstroBarColors.primaryLight,
                }}
                thumbColor={
                  settings.notificationsEnabled ? AstroBarColors.primary : "#f4f3f4"
                }
              />
            </View>
            {notificationStatus === "denied" ? (
              <Pressable
                style={[styles.modalButtonFull, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border, marginTop: Spacing.sm }]}
                onPress={() => Linking.openSettings()}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Abrir ajustes del sistema
                </ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: AstroBarColors.primary }]}
              onPress={() => setShowNotificationsModal(false)}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                Listo
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="globe" size={28} color={AstroBarColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Idioma
            </ThemedText>
            <View style={styles.themeOptions}>
              <View
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: AstroBarColors.primaryLight,
                    borderColor: AstroBarColors.primary,
                  }]}
              >
                <ThemedText
                  type="body"
                  style={{ color: AstroBarColors.primary, fontWeight: "600" }}
                >
                  Español
                </ThemedText>
                <Feather
                  name="check"
                  size={20}
                  color={AstroBarColors.primary}
                  style={{ marginLeft: "auto" }}
                />
              </View>
            </View>
            <ThemedText
              type="small"
              style={[styles.comingSoon, { color: theme.textSecondary }]}
            >
              Más idiomas próximamente...
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setShowLanguageModal(false)}
            >
              <ThemedText type="body" style={{ color: theme.text }}>
                Cerrar
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showTermsModal}
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View
          style={[
            styles.fullScreenModal,
            { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}
        >
          <View
            style={[
              styles.fullScreenHeader,
              { borderBottomColor: theme.border }]}
          >
            <ThemedText type="h3">Términos y condiciones</ThemedText>
            <Pressable
              style={[
                styles.closeButton,
                { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setShowTermsModal(false)}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.fullScreenContent}
            contentContainerStyle={{
              padding: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            }}
          >
            <ThemedText type="h4" style={styles.legalTitle}>
              áltima actualizacián: Enero 2025
            </ThemedText>
            
            <ThemedText type="body" style={styles.legalText}>
              Bienvenido a AstroBar. Estos Términos y Condiciones ("Términos") rigen el uso de la aplicacián mávil AstroBar y los servicios relacionados ("Servicios"). Al acceder o utilizar AstroBar, usted acepta estar legalmente vinculado por estos Términos. Si no está de acuerdo, no utilice la aplicacián.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              1. Definiciones
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              á "AstroBar", "nosotros", "nuestro" se refiere al operador de la aplicacián.{"\n"}
              á "Usuario", "usted" se refiere a cualquier persona que acceda o utilice los Servicios.{"\n"}
              á "Bar" o "Establecimiento" se refiere a los negocios registrados en la plataforma.{"\n"}
              á "Promocián" se refiere a ofertas especiales publicadas por los Bares.{"\n"}
              á "Promocián Flash" se refiere a ofertas de tiempo limitado (5-15 minutos).
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              2. Elegibilidad y Registro
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              2.1. Debe ser mayor de 18 aáos para utilizar AstroBar. Al registrarse, usted declara y garantiza que tiene al menos 18 aáos de edad.{"\n\n"}
              2.2. Debe proporcionar informacián precisa, completa y actualizada durante el registro.{"\n\n"}
              2.3. Es responsable de mantener la confidencialidad de su cuenta y contraseáa.{"\n\n"}
              2.4. Debe notificarnos inmediatamente cualquier uso no autorizado de su cuenta.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              3. Descripcián de los Servicios
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              3.1. AstroBar es una plataforma que conecta usuarios con bares y establecimientos nocturnos en Buenos Aires, Argentina.{"\n\n"}
              3.2. Los Servicios incluyen:{"\n"}
              á Visualizacián de promociones de bares cercanos{"\n"}
              á Aceptacián y pago de promociones{"\n"}
              á Generacián de cádigos QR para canje{"\n"}
              á Sistema de puntos y niveles de fidelizacián{"\n"}
              á Notificaciones de promociones flash{"\n\n"}
              3.3. AstroBar actáa como intermediario entre usuarios y establecimientos. No somos propietarios ni operadores de los bares listados.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              4. Promociones y Transacciones
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              4.1. Las promociones son creadas y gestionadas por los establecimientos. AstroBar no garantiza la disponibilidad, calidad o exactitud de las promociones.{"\n\n"}
              4.2. Al aceptar una promocián, usted se compromete a pagar el precio indicado Más la comisián de plataforma.{"\n\n"}
              4.3. Tiene 60 segundos (configurable) para cancelar una transaccián sin cargo despuás de aceptarla.{"\n\n"}
              4.4. Una vez generado el cádigo QR, debe canjearlo en el establecimiento dentro del horario de validez.{"\n\n"}
              4.5. Los cádigos QR son de un solo uso y no son transferibles.{"\n\n"}
              4.6. Las promociones flash tienen stock limitado y se asignan por orden de aceptacián.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              5. Pagos y Comisiones
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              5.1. Los pagos se procesan a travás de Mercado Pago, un proveedor de servicios de pago de terceros.{"\n\n"}
              5.2. El precio total incluye:{"\n"}
              á Precio del producto/servicio (100% para el bar){"\n"}
              á Comisián de plataforma (5%-30% adicional){"\n\n"}
              5.3. Todas las transacciones son finales despuás del peráodo de cancelacián.{"\n\n"}
              5.4. Los reembolsos se procesan ánicamente en casos de:{"\n"}
              á Cancelacián dentro del peráodo permitido{"\n"}
              á Error tácnico comprobado{"\n"}
              á Incumplimiento del establecimiento{"\n\n"}
              5.5. Los reembolsos se procesan en 5-10 dáas hábiles al mátodo de pago original.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              6. Sistema de Puntos y Niveles
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              6.1. Los usuarios ganan 10 puntos por cada promocián canjeada exitosamente.{"\n\n"}
              6.2. Los niveles son: Copper (0-99), Bronze (100-249), Silver (250-499), Gold (500-999), Platinum (1000+).{"\n\n"}
              6.3. Los puntos no tienen valor monetario y no son transferibles.{"\n\n"}
              6.4. AstroBar se reserva el derecho de modificar o cancelar el sistema de puntos con previo aviso.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              7. Conducta del Usuario
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Usted se compromete a NO:{"\n"}
              á Usar la aplicacián para actividades ilegales{"\n"}
              á Crear máltiples cuentas para obtener beneficios indebidos{"\n"}
              á Compartir o vender cádigos QR{"\n"}
              á Acosar o amenazar a personal de establecimientos{"\n"}
              á Intentar acceder a sistemas o datos no autorizados{"\n"}
              á Publicar contenido ofensivo, difamatorio o ilegal{"\n"}
              á Usar bots, scripts o automatizacián no autorizada{"\n\n"}
              La violacián de estas normas puede resultar en suspensián o terminacián de su cuenta.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              8. Responsabilidad de los Establecimientos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              8.1. Los establecimientos son responsables de:{"\n"}
              á La calidad y seguridad de sus productos{"\n"}
              á El cumplimiento de regulaciones sanitarias{"\n"}
              á La informacián de alárgenos{"\n"}
              á El servicio al cliente en sus instalaciones{"\n\n"}
              8.2. AstroBar no es responsable por problemas de salud, intoxicacián o lesiones derivadas del consumo de productos en los establecimientos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              9. Limitacián de Responsabilidad
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              9.1. AstroBar se proporciona "tal cual" sin garantáas de ningán tipo.{"\n\n"}
              9.2. No garantizamos que los Servicios sean ininterrumpidos, seguros o libres de errores.{"\n\n"}
              9.3. No somos responsables por:{"\n"}
              á Párdida de datos o contenido{"\n"}
              á Daáos indirectos, incidentales o consecuentes{"\n"}
              á Acciones u omisiones de establecimientos{"\n"}
              á Fallas tácnicas o interrupciones del servicio{"\n\n"}
              9.4. Nuestra responsabilidad máxima se limita al monto pagado por usted en los áltimos 3 meses.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              10. Propiedad Intelectual
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              10.1. Todos los derechos de propiedad intelectual de AstroBar (marca, logo, diseáo, cádigo) son propiedad exclusiva de AstroBar.{"\n\n"}
              10.2. Se le otorga una licencia limitada, no exclusiva e intransferible para usar la aplicacián.{"\n\n"}
              10.3. No puede copiar, modificar, distribuir o crear obras derivadas sin autorizacián escrita.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              11. Privacidad y Datos Personales
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              11.1. El uso de sus datos personales se rige por nuestra Política de Privacidad.{"\n\n"}
              11.2. Al usar AstroBar, usted consiente la recopilacián y uso de sus datos segán lo descrito en la Política de Privacidad.{"\n\n"}
              11.3. Cumplimos con la Ley de Proteccián de Datos Personales de Argentina (Ley 25.326).
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              12. Modificaciones
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              12.1. Podemos modificar estos Términos en cualquier momento.{"\n\n"}
              12.2. Los cambios significativos se notificarán mediante la aplicacián o por correo electránico.{"\n\n"}
              12.3. El uso continuado de los Servicios despuás de las modificaciones constituye aceptacián de los nuevos Términos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              13. Terminacián
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              13.1. Puede eliminar su cuenta en cualquier momento desde la configuracián de la aplicacián.{"\n\n"}
              13.2. Podemos suspender o terminar su cuenta si:{"\n"}
              á Viola estos Términos{"\n"}
              á Realiza actividades fraudulentas{"\n"}
              á No paga por servicios adquiridos{"\n"}
              á Por razones de seguridad o legales{"\n\n"}
              13.3. La terminacián no afecta obligaciones pendientes.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              14. Ley Aplicable y Jurisdiccián
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              14.1. Estos Términos se rigen por las leyes de la Repáblica Argentina.{"\n\n"}
              14.2. Cualquier disputa se resolverá en los tribunales de la Ciudad Autánoma de Buenos Aires, Argentina.{"\n\n"}
              14.3. Si alguna disposicián es inválida, las deMás permanecen en vigor.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              15. Consumo Responsable
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              15.1. AstroBar promueve el consumo responsable de alcohol.{"\n\n"}
              15.2. No conduzca bajo los efectos del alcohol.{"\n\n"}
              15.3. Los establecimientos pueden negarse a servir a personas en estado de intoxicacián.{"\n\n"}
              15.4. Si bebe, no maneje. Use transporte páblico o servicios de taxi.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              16. Contacto
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Para consultas sobre estos Términos:{"\n\n"}
              Email: legal@astrobar.com.ar{"\n"}
              Soporte: Seccián "Ayuda y Soporte" en la aplicacián{"\n"}
              Direccián: Buenos Aires, Argentina{"\n\n"}
              Al utilizar AstroBar, usted reconoce haber leádo, entendido y aceptado estos Términos y Condiciones en su totalidad.
            </ThemedText>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showPrivacyModal}
        animationType="slide"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View
          style={[
            styles.fullScreenModal,
            { backgroundColor: theme.backgroundRoot, paddingTop: insets.top }]}
        >
          <View
            style={[
              styles.fullScreenHeader,
              { borderBottomColor: theme.border }]}
          >
            <ThemedText type="h3">Politica de privacidad</ThemedText>
            <Pressable
              style={[
                styles.closeButton,
                { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => setShowPrivacyModal(false)}
            >
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.fullScreenContent}
            contentContainerStyle={{
              padding: Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            }}
          >
            <ThemedText type="h4" style={styles.legalTitle}>
              áltima actualizacián: Enero 2025
            </ThemedText>

            <ThemedText type="body" style={styles.legalText}>
              En AstroBar, tu privacidad es nuestra prioridad. Esta Política describe cámo recopilamos, usamos y protegemos tu informacián personal en Buenos Aires, Argentina.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              1. Informacián que Recopilamos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Recopilamos: nombre, námero de teláfono, email, historial de promociones canjeadas, datos de pago (procesados de forma segura por Mercado Pago), ubicacián (solo cuando usas la app), y preferencias de usuario.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              2. Uso de la Informacián
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Usamos tu informacián para: procesar transacciones de promociones, verificar tu identidad, procesar pagos, enviarte notificaciones sobre promociones flash, mejorar nuestros servicios, cumplir con obligaciones legales, y comunicarnos contigo sobre ofertas (con tu consentimiento).
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              3. Compartir Informacián
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Compartimos informacián limitada con: establecimientos (nombre para validar cádigos QR), procesadores de pago (Mercado Pago), y autoridades cuando la ley lo requiera. No vendemos tus datos a terceros.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              4. Seguridad de Datos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Implementamos medidas de seguridad incluyendo: encriptacián de datos en tránsito y reposo, autenticacián segura, almacenamiento seguro de contraseáas con hash, y acceso restringido a datos personales.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              5. Tus Derechos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Tienes derecho a: acceder a tus datos personales, corregir informacián inexacta, solicitar la eliminacián de tu cuenta y datos, oponerte al procesamiento de tus datos, y retirar tu consentimiento para comunicaciones promocionales.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              6. Retencián de Datos
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Conservamos tus datos mientras tu cuenta está activa y por el peráodo requerido por ley argentina. Puedes solicitar la eliminacián de tu cuenta desde la configuracián de la aplicacián.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              7. Cookies y Tecnologáas Similares
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Usamos tecnologáas similares a cookies para mejorar tu experiencia, recordar preferencias, y analizar el uso de la aplicacián.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              8. Menores de Edad
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              AstroBar no está dirigido a menores de 18 aáos. No recopilamos intencionalmente informacián de menores. Si eres padre y crees que tu hijo ha proporcionado informacián, contáctanos.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              9. Cambios a esta Política
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Podemos actualizar esta Política periádicamente. Te notificaremos de cambios significativos a travás de la aplicacián o por email.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              10. Ley Aplicable
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Esta Política se rige por la Ley de Proteccián de Datos Personales de Argentina (Ley 25.326) y las leyes de la Repáblica Argentina.
            </ThemedText>

            <ThemedText type="h4" style={styles.legalTitle}>
              11. Contacto
            </ThemedText>
            <ThemedText type="body" style={styles.legalText}>
              Para ejercer tus derechos o resolver dudas sobre privacidad:{"\n\n"}
              Email: privacidad@astrobar.com.ar{"\n"}
              Soporte: Seccián "Ayuda y Soporte" en la aplicacián{"\n"}
              Direccián: Buenos Aires, Argentina
            </ThemedText>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showEditProfileModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditProfileModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowEditProfileModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="user" size={28} color={AstroBarColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Editar perfil
            </ThemedText>
            
            <View style={{ width: '100%', gap: 16 }}>
              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>Nombre</ThemedText>
                <TextInput
                  style={[
                    styles.profileInput,
                    { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }
                  ]}
                  value={editProfile.name}
                  onChangeText={(text) => setEditProfile({...editProfile, name: text})}
                  placeholder="Tu nombre"
                  placeholderTextColor={theme.textSecondary}
                />
              </View>
              
              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>Email</ThemedText>
                <TextInput
                  style={[
                    styles.profileInput,
                    { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }
                  ]}
                  value={editProfile.email}
                  onChangeText={(text) => setEditProfile({...editProfile, email: text})}
                  placeholder="Tu email"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              
              <View>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>Teláfono</ThemedText>
                <TextInput
                  style={[
                    styles.profileInput,
                    { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }
                  ]}
                  value={editProfile.phone}
                  onChangeText={(text) => setEditProfile({...editProfile, phone: text})}
                  placeholder="Tu teláfono"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={{ borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 16, marginTop: 8 }}>
                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 12, fontWeight: '600' }}>Cambiar contraseáa (opcional)</ThemedText>
                
                <View style={{ marginBottom: 12 }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>Contraseáa actual</ThemedText>
                  <TextInput
                    style={[
                      styles.profileInput,
                      { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }
                    ]}
                    value={editProfile.currentPassword}
                    onChangeText={(text) => setEditProfile({...editProfile, currentPassword: text})}
                    placeholder="Contraseáa actual"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                  />
                </View>
                
                <View style={{ marginBottom: 12 }}>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>Nueva contraseáa</ThemedText>
                  <TextInput
                    style={[
                      styles.profileInput,
                      { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }
                    ]}
                    value={editProfile.newPassword}
                    onChangeText={(text) => setEditProfile({...editProfile, newPassword: text})}
                    placeholder="Nueva contraseáa"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                  />
                </View>
                
                <View>
                  <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: 8 }}>Confirmar contraseáa</ThemedText>
                  <TextInput
                    style={[
                      styles.profileInput,
                      { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }
                    ]}
                    value={editProfile.confirmPassword}
                    onChangeText={(text) => setEditProfile({...editProfile, confirmPassword: text})}
                    placeholder="Confirmar contraseáa"
                    placeholderTextColor={theme.textSecondary}
                    secureTextEntry
                  />
                </View>
              </View>
            </View>
            
            <View style={styles.modalButtons}>
              <Pressable
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { borderColor: theme.border }]}
                onPress={() => setShowEditProfileModal(false)}
              >
                <ThemedText type="body" style={{ color: theme.text }}>
                  Cancelar
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: AstroBarColors.primary }]}
                onPress={async () => {
                  if (!editProfile.name.trim()) {
                    showToast("El nombre es obligatorio", "error");
                    return;
                  }
                  
                  // Validar cambio de contraseáa si se intentá
                  if (editProfile.newPassword || editProfile.currentPassword || editProfile.confirmPassword) {
                    if (!editProfile.currentPassword) {
                      showToast("Ingresa tu contraseáa actual", "error");
                      return;
                    }
                    if (!editProfile.newPassword) {
                      showToast("Ingresa la nueva contraseáa", "error");
                      return;
                    }
                    if (editProfile.newPassword !== editProfile.confirmPassword) {
                      showToast("Las contraseáas no coinciden", "error");
                      return;
                    }
                    if (editProfile.newPassword.length < 6) {
                      showToast("La contraseáa debe tener al menos 6 caracteres", "error");
                      return;
                    }
                  }
                  
                  try {
                    const updateData: any = {
                      name: editProfile.name.trim(),
                      email: editProfile.email.trim(),
                      phone: editProfile.phone.trim()
                    };
                    
                    // Solo incluir contraseáas si se está cambiando
                    if (editProfile.newPassword) {
                      updateData.currentPassword = editProfile.currentPassword;
                      updateData.newPassword = editProfile.newPassword;
                    }
                    
                    const response = await apiRequest("PUT", "/api/user/profile", updateData);
                    
                    const data = await response.json();
                    
                    if (data.success) {
                      await updateUser({ 
                        name: editProfile.name.trim(),
                        email: editProfile.email.trim(),
                        phone: editProfile.phone.trim()
                      });
                      setShowEditProfileModal(false);
                      showToast(editProfile.newPassword ? "Perfil y contraseáa actualizados" : "Perfil actualizado", "success");
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    } else {
                      throw new Error(data.error || "Error al actualizar");
                    }
                  } catch (error: any) {
                    console.error("Error updating profile:", error);
                    showToast(error.message || "Error al actualizar perfil", "error");
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                  }
                }}
              >
                <ThemedText
                  type="body"
                  style={{ color: "#FFFFFF", fontWeight: "600" }}
                >
                  Guardar
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showAddressesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddressesModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAddressesModal(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="map-pin" size={28} color={AstroBarColors.primary} />
            </View>
            <ThemedText type="h3" style={styles.modalTitle}>
              Direcciones guardadas
            </ThemedText>
            <ThemedText
              type="body"
              style={[styles.modalMessage, { color: theme.textSecondary }]}
            >
              Esta funcián estará disponible próximamente. Podrás gestionar tus
              direcciones de entrega favoritas.
            </ThemedText>
            <Pressable
              style={[
                styles.modalButtonFull,
                { backgroundColor: AstroBarColors.primary }]}
              onPress={() => setShowAddressesModal(false)}
            >
              <ThemedText
                type="body"
                style={{ color: "#FFFFFF", fontWeight: "600" }}
              >
                Entendido
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  profileCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    position: "relative",
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  userName: {
    marginBottom: Spacing.xs,
  },
  section: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  sectionTitle: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  settingsItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  settingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  settingsContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  version: {
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  socialButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: "center",
  },
  modalIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  modalMessage: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonFull: {
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
  },
  cancelButton: {
    borderWidth: 1,
  },
  logoutButton: {
    backgroundColor: AstroBarColors.error,
  },
  themeOptions: {
    width: "100%",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  comingSoon: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  fullScreenModal: {
    flex: 1,
  },
  fullScreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenContent: {
    flex: 1,
  },
  placeholderCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  legalTitle: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  legalText: {
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  strikesContainer: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  strikesHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  strikesIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    marginRight: Spacing.md,
  },
  strikesInfo: {
    flex: 1,
  },
  strikesVisual: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  strikeIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
  },
  strikeInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  statsCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  profileInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
  },
});

