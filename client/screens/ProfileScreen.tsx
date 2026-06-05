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

type ProfileScreenNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

interface SettingsItemProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}

function SettingsItem({ icon, label, value, onPress, danger }: SettingsItemProps) {
  const { theme } = useTheme();
  const isDark = theme.background === "#000000" || theme.background === "black" || theme.background === "#121212";

  // Colores dedicados para cada icono para darle personalidad
  const getIconColor = () => {
    if (danger) return AstroBarColors.error;
    if (isDark) {
      switch (icon) {
        case "user": return "#00f2fe";        // Cian
        case "wallet": return "#39ff14";      // Verde neón
        case "dollar-sign": return "#39ff14"; // Verde neón
        case "briefcase": return "#3b82f6";   // Azul eléctrico
        case "moon": return "#a55eea";        // Violeta
        case "bell": return "#ff9f43";        // Naranja
        case "globe": return "#45aaf2";       // Celeste
        case "share-2": return "#2ed573";     // Verde
        case "file-text": return "#fed330";   // Amarillo
        case "shield": return "#00f2fe";      // Cian neón
        default: return "#00f2fe";
      }
    }
    return AstroBarColors.primary;
  };

  const iconBg = danger 
    ? (isDark ? "rgba(255, 76, 76, 0.15)" : "#FFEBEE") 
    : (isDark ? "#1f293d" : theme.backgroundSecondary);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsItem,
        {
          backgroundColor: pressed ? (isDark ? "#1d2736" : theme.backgroundSecondary) : "transparent",
        }
      ]}
    >
      <View style={[styles.settingsIcon, { backgroundColor: iconBg }]}>
        <Feather name={icon} size={18} color={getIconColor()} />
      </View>
      <View style={styles.settingsContent}>
        <ThemedText
          type="body"
          style={{ color: danger ? AstroBarColors.error : theme.text, fontWeight: "600", fontSize: 15 }}
        >
          {label}
        </ThemedText>
        {value ? (
          <ThemedText type="small" style={{ color: isDark ? "#94a3b8" : theme.textSecondary, marginTop: 2 }}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      <Feather name="chevron-right" size={18} color={isDark ? "#4b5563" : theme.textSecondary} />
    </Pressable>
  );
}

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" }
];

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

  const isDark = theme.background === "#000000" || theme.background === "black" || theme.background === "#121212";

  const approvalStatus =
    user?.role === "business_owner" ? user?.isActive
        ? { text: "Aprobado", variant: "success" as const }
        : { text: "En revisión", variant: "warning" as const }
      : null;

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
      } catch (error) {}
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
      } catch (error) {}
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
      case "system": return "Sistema";
      case "light": return "Claro";
      case "dark": return "Oscuro";
      default: return "Sistema";
    }
  };

  const pickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showToast("Permisos de galería denegados", "error");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    const asset = result?.assets?.[0];
    if (!result.canceled && asset?.uri) {
      await uploadImage(asset.uri);
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      let imageData: string;
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        imageData = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const encoding = (FileSystem as any)?.EncodingType?.Base64 || "base64";
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding });
        const extension = uri.split(".").pop()?.toLowerCase() || "jpg";
        const mimeType = extension === "png" ? "image/png" : "image/jpeg";
        imageData = `data:${mimeType};base64,${base64}`;
      }

      const estimatedBytes = Math.ceil(imageData.length * 0.75);
      if (estimatedBytes > 2 * 1024 * 1024) {
        throw new Error("La imagen es muy pesada. Usa una foto más ligera (~2MB max)");
      }

      const apiResponse = await apiRequest("POST", "/api/user/profile-image", { image: imageData });
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error?.message || "No se pudo subir la imagen", "error");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: "Descubre AstroBar - Tu plataforma de promociones nocturnas en Buenos Aires. Ofertas exclusivas en bares. https://astrobar.com.ar",
        title: "AstroBar - Promociones Nocturnas",
      });
    } catch (error) {}
  };

  const shareToSocialMedia = (platform: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const message = encodeURIComponent("Descubre AstroBar - Tu plataforma de promociones nocturnas en Buenos Aires. Ofertas exclusivas en bares.");
    const url = encodeURIComponent("https://astrobar.com.ar");

    let shareUrl = "";
    switch (platform) {
      case "whatsapp": shareUrl = `whatsapp://send?text=${message}%20${url}`; break;
      case "facebook": shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${message}`; break;
      case "twitter": shareUrl = `https://twitter.com/intent/tweet?text=${message}&url=${url}`; break;
      case "telegram": shareUrl = `https://t.me/share/url?url=${url}&text=${message}`; break;
    }
    Linking.openURL(shareUrl).catch(() => {});
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
    if (showNotificationsModal) syncNotificationStatus();
  }, [showNotificationsModal]);

  const syncNotificationStatus = async () => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      setNotificationStatus(permissions.status);
      return permissions.status;
    } catch (error) {
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
        showToast("Activa permisos de notificación en ajustes del sistema", "error");
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
      case "customer": return "Cliente";
      case "business_owner": return "Dueño de Bar";
      case "admin":
      case "super_admin": return "Administrador";
      default: return user?.role || "Usuario";
    }
  };

  // Variables de diseño unificadas AstroBar
  const bgContainer = isDark ? '#0b111e' : '#f5f5f5'; 
  const bgSurface = isDark ? '#111927' : '#ffffff';   
  const bgElement = isDark ? '#1f293d' : '#f5f5f5';   
  const textTitle = isDark ? '#ffffff' : '#333333';
  const textSub = isDark ? '#94a3b8' : '#666666';
  const borderStyle = isDark ? '#1f293d' : '#f0f0f0';

  return (
    <LinearGradient
      colors={[isDark ? '#0d1527' : (theme.gradientStart || '#FFFFFF'), isDark ? '#05070c' : (theme.gradientEnd || '#F5F5F5')]}
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
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 👤 TARJETA VIP DE PERFIL */}
        <View style={[styles.profileCard, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.md]}>
          <Pressable 
            style={[styles.avatarContainer, { borderColor: isDark ? '#00f2fe' : AstroBarColors.primary }]} 
            onPress={pickImage}
            disabled={isUploadingImage}
          >
            <Image
              source={profileImage ? { uri: profileImage } : require("../../assets/astrobarlogo.jpg")}
              style={[styles.avatar, isUploadingImage && { opacity: 0.5 }]}
              contentFit="cover"
            />
            <View style={[styles.editBadge, { backgroundColor: AstroBarColors.primary, borderColor: bgSurface }]}>
              {isUploadingImage ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="camera" size={12} color="#FFFFFF" />}
            </View>
          </Pressable>
          <ThemedText type="h2" style={[styles.userName, { color: textTitle, fontWeight: '800' }]}>
            {user?.name || "Usuario"}
          </ThemedText>
          <ThemedText type="body" style={{ color: textSub, fontWeight: '500' }}>
            {user?.phone ? user.phone.replace(/^(\+52)+/, '+52') : "Sin teléfono"}
          </ThemedText>
          
          <Badge
            text={getRoleLabel()}
            variant="primary"
            style={{ marginTop: Spacing.sm, backgroundColor: isDark ? '#1c2d4a' : AstroBarColors.primary }}
          />
          {approvalStatus ? (
            <Badge
              text={approvalStatus.text}
              variant={approvalStatus.variant}
              style={{ marginTop: Spacing.xs }}
            />
          ) : null}
        </View>

        {/* ⚙️ SECCIÓN CUENTA */}
        <View style={[styles.section, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.sm]}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: textSub, letterSpacing: 0.6 }]}>
            CUENTA
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

        {/* 📊 SECCIÓN ESTADÍSTICAS DEL NEGOCIO / CLIENTE */}
        {user?.role === 'customer' && userStats && (
          <View style={[styles.statsCard, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.md]}>
            <View style={styles.statsHeader}>
              <Feather name="award" size={22} color={isDark ? '#fed330' : AstroBarColors.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm, color: textTitle, fontWeight: '700' }}>Mis Estadísticas</ThemedText>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: isDark ? '#00f2fe' : AstroBarColors.primary, fontWeight: '800' }}>{userStats.totalPoints}</ThemedText>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Puntos</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: '#39ff14', fontWeight: '800' }}>{userStats.promotionsRedeemed}</ThemedText>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Canjeadas</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: '#ff9f43', fontWeight: '800' }}>{userStats.barsVisited}</ThemedText>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Bares</ThemedText>
              </View>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: isDark ? '#1a2536' : AstroBarColors.primaryLight }]}>
              <Feather name="star" size={15} color={isDark ? '#00f2fe' : AstroBarColors.primary} />
              <ThemedText type="body" style={{ color: isDark ? '#00f2fe' : AstroBarColors.primary, fontWeight: '700', marginLeft: Spacing.xs }}>
                Nivel: {userStats.currentLevel.charAt(0).toUpperCase() + userStats.currentLevel.slice(1)}
              </ThemedText>
            </View>
            {userStats.pointsToNextLevel > 0 && (
              <ThemedText type="small" style={{ color: textSub, textAlign: 'center', marginTop: Spacing.sm, fontWeight: '500' }}>
                {userStats.pointsToNextLevel} puntos para el siguiente nivel
              </ThemedText>
            )}
          </View>
        )}

        {user?.role === 'business_owner' && userStats && (
          <View style={[styles.statsCard, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.md]}>
            <View style={styles.statsHeader}>
              <Feather name="trending-up" size={22} color={isDark ? '#39ff14' : AstroBarColors.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm, color: textTitle, fontWeight: '700' }}>Estadísticas del Bar</ThemedText>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: '#39ff14', fontWeight: '800' }}>${userStats.totalRevenue || 0}</ThemedText>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Ingresos</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: isDark ? '#00f2fe' : AstroBarColors.primary, fontWeight: '800' }}>{userStats.totalPromotions || 0}</ThemedText>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Promociones</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText type="h2" style={{ color: '#ff9f43', fontWeight: '800' }}>{userStats.totalRedemptions || 0}</ThemedText>
                <ThemedText type="small" style={{ color: textSub, fontWeight: '600' }}>Canjes</ThemedText>
              </View>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: isDark ? '#142a29' : AstroBarColors.primaryLight }]}>
              <Feather name="star" size={15} color={isDark ? '#39ff14' : AstroBarColors.primary} />
              <ThemedText type="body" style={{ color: isDark ? '#39ff14' : AstroBarColors.primary, fontWeight: '700', marginLeft: Spacing.xs }}>
                Ranking: #{userStats.ranking || 'N/A'} • {userStats.rating || '0.0'} ⭐
              </ThemedText>
            </View>
            {userStats.activePromotions > 0 && (
              <ThemedText type="small" style={{ color: textSub, textAlign: 'center', marginTop: Spacing.sm, fontWeight: '500' }}>
                {userStats.activePromotions} promociones activas ahora
              </ThemedText>
            )}
          </View>
        )}

        {/* 🎨 PREFERENCIAS */}
        <View style={[styles.section, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.sm]}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: textSub, letterSpacing: 0.6 }]}>
            PREFERENCIAS
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

        {/* 🔗 MÁS */}
        <View style={[styles.section, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.sm]}>
          <ThemedText type="h4" style={[styles.sectionTitle, { color: textSub, letterSpacing: 0.6 }]}>
            MÁS
          </ThemedText>
          <SettingsItem icon="share-2" label="Compartir AstroBar" onPress={handleShare} />
          
          <View style={[styles.socialButtons, { borderBottomColor: borderStyle, borderBottomWidth: 0.5, paddingBottom: 16 }]}>
            <Pressable style={[styles.socialButton, { backgroundColor: "#25D366" }]} onPress={() => shareToSocialMedia("whatsapp")}>
              <Feather name="message-circle" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable style={[styles.socialButton, { backgroundColor: "#1877F2" }]} onPress={() => shareToSocialMedia("facebook")}>
              <Feather name="facebook" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable style={[styles.socialButton, { backgroundColor: "#1DA1F2" }]} onPress={() => shareToSocialMedia("twitter")}>
              <Feather name="twitter" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable style={[styles.socialButton, { backgroundColor: "#0088CC" }]} onPress={() => shareToSocialMedia("telegram")}>
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

        {/* 🚪 CERRAR SESIÓN */}
        <View style={[styles.section, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }, Shadows.sm]}>
          <SettingsItem icon="log-out" label="Cerrar sesión" onPress={handleLogout} danger />
        </View>

        <ThemedText type="caption" style={[styles.version, { color: textSub, fontWeight: '600' }]}>
          AstroBar v1.0.0
        </ThemedText>
      </ScrollView>

      {/* 📥 MODALS TOTALMENTE REDISEÑADOS CON SOPORTE OSCURO */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLogoutModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }]}>
            <View style={[styles.modalIcon, { backgroundColor: isDark ? "rgba(255, 76, 76, 0.15)" : "#FFEBEE" }]}>
              <Feather name="log-out" size={26} color={AstroBarColors.error} />
            </View>
            <ThemedText type="h3" style={[styles.modalTitle, { color: textTitle }]}>Cerrar sesión</ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: textSub }]}>¿Estás seguro que deseas cerrar sesión?</ThemedText>
            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.cancelButton, { borderColor: borderStyle }]} onPress={() => setShowLogoutModal(false)}>
                <ThemedText type="body" style={{ color: textTitle, fontWeight: '600' }}>Cancelar</ThemedText>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.logoutButton]} onPress={confirmLogout}>
                <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700" }}>Cerrar sesión</ThemedText>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showThemeModal} transparent animationType="fade" onRequestClose={() => setShowThemeModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowThemeModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }]}>
            <View style={[styles.modalIcon, { backgroundColor: bgElement }]}>
              <Feather name="moon" size={26} color={isDark ? '#00f2fe' : AstroBarColors.primary} />
            </View>
            <ThemedText type="h3" style={[styles.modalTitle, { color: textTitle }]}>Seleccionar tema</ThemedText>
            <View style={styles.themeOptions}>
              {themeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.themeOption,
                    {
                      backgroundColor: themeMode === option.value ? (isDark ? '#1a273a' : AstroBarColors.primaryLight) : bgElement,
                      borderColor: themeMode === option.value ? (isDark ? '#00f2fe' : AstroBarColors.primary) : "transparent",
                    }
                  ]}
                  onPress={() => handleThemeSelect(option.value)}
                >
                  <Feather
                    name={option.value === "system" ? "smartphone" : option.value === "light" ? "sun" : "moon"}
                    size={18}
                    color={themeMode === option.value ? (isDark ? '#00f2fe' : AstroBarColors.primary) : textSub}
                  />
                  <ThemedText type="body" style={{ color: themeMode === option.value ? (isDark ? '#00f2fe' : AstroBarColors.primary) : textTitle, marginLeft: Spacing.sm, fontWeight: themeMode === option.value ? "700" : "500" }}>
                    {option.label}
                  </ThemedText>
                  {themeMode === option.value ? <Feather name="check" size={18} color={isDark ? '#00f2fe' : AstroBarColors.primary} style={{ marginLeft: "auto" }} /> : null}
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.modalButtonFull, { backgroundColor: bgElement }]} onPress={() => setShowThemeModal(false)}>
              <ThemedText type="body" style={{ color: textTitle, fontWeight: '600' }}>Cerrar</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showNotificationsModal} transparent animationType="fade" onRequestClose={() => setShowNotificationsModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowNotificationsModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }]}>
            <View style={[styles.modalIcon, { backgroundColor: bgElement }]}>
              <Feather name="bell" size={26} color={isDark ? '#ff9f43' : AstroBarColors.primary} />
            </View>
            <ThemedText type="h3" style={[styles.modalTitle, { color: textTitle }]}>Notificaciones</ThemedText>
            <ThemedText type="body" style={[styles.modalMessage, { color: textSub }]}>Recibe alertas comerciales sobre tus pedidos y promociones especiales.</ThemedText>
            <View style={[styles.strikeInfoCard, { backgroundColor: bgElement, marginBottom: Spacing.md }]}>
              <Feather name="info" size={14} color={textSub} />
              <ThemedText type="caption" style={{ color: textSub, marginLeft: Spacing.sm, flex: 1, fontWeight: '500' }}>
                Permiso: {notificationStatus === "granted" ? "Permitido" : notificationStatus === "denied" ? "Bloqueado" : "Sin solicitar"}
              </ThemedText>
            </View>
            <View style={styles.switchRow}>
              <ThemedText type="body" style={{ color: textTitle, fontWeight: '600' }}>Activar notificaciones</ThemedText>
              <Switch
                value={settings.notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: borderStyle, true: isDark ? '#1a3a2a' : AstroBarColors.primaryLight }}
                thumbColor={settings.notificationsEnabled ? (isDark ? '#39ff14' : AstroBarColors.primary) : "#f4f3f4"}
              />
            </View>
            {notificationStatus === "denied" ? (
              <Pressable style={[styles.modalButtonFull, { backgroundColor: bgElement, borderWidth: 1, borderColor: borderStyle }]} onPress={() => Linking.openSettings()}>
                <ThemedText type="body" style={{ color: textTitle }}>Abrir ajustes del sistema</ThemedText>
              </Pressable>
            ) : null}
            <Pressable style={[styles.modalButtonFull, { backgroundColor: AstroBarColors.primary }]} onPress={() => setShowNotificationsModal(false)}>
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700" }}>Listo</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* MODAL EDITAR PERFIL ACTUALIZADO */}
      <Modal visible={showEditProfileModal} transparent animationType="fade" onRequestClose={() => setShowEditProfileModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowEditProfileModal(false)}>
          <ScrollView contentContainerStyle={{flexGrow: 1, justifyContent: 'center', alignItems: 'center', width: '100%'}} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalContent, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0, maxWidth: 360, marginVertical: 40 }]}>
              <View style={[styles.modalIcon, { backgroundColor: bgElement }]}>
                <Feather name="user" size={26} color={isDark ? '#00f2fe' : AstroBarColors.primary} />
              </View>
              <ThemedText type="h3" style={[styles.modalTitle, { color: textTitle, marginBottom: 20 }]}>Editar perfil</ThemedText>
              
              <View style={{ width: '100%', gap: 14 }}>
                <View>
                  <ThemedText type="small" style={{ color: textSub, marginBottom: 6, fontWeight: '600' }}>Nombre</ThemedText>
                  <TextInput
                    style={[styles.profileInput, { backgroundColor: bgElement, color: textTitle, borderColor: borderStyle }]}
                    value={editProfile.name}
                    onChangeText={(text) => setEditProfile({...editProfile, name: text})}
                    placeholder="Tu nombre"
                    placeholderTextColor={textSub}
                  />
                </View>
                <View>
                  <ThemedText type="small" style={{ color: textSub, marginBottom: 6, fontWeight: '600' }}>Email</ThemedText>
                  <TextInput
                    style={[styles.profileInput, { backgroundColor: bgElement, color: textTitle, borderColor: borderStyle }]}
                    value={editProfile.email}
                    onChangeText={(text) => setEditProfile({...editProfile, email: text})}
                    placeholder="Tu email"
                    placeholderTextColor={textSub}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View>
                  <ThemedText type="small" style={{ color: textSub, marginBottom: 6, fontWeight: '600' }}>Teléfono</ThemedText>
                  <TextInput
                    style={[styles.profileInput, { backgroundColor: bgElement, color: textTitle, borderColor: borderStyle }]}
                    value={editProfile.phone}
                    onChangeText={(text) => setEditProfile({...editProfile, phone: text})}
                    placeholder="Tu teléfono"
                    placeholderTextColor={textSub}
                    keyboardType="phone-pad"
                  />
                </View>
                
                <View style={{ borderTopWidth: 1, borderTopColor: borderStyle, paddingTop: 14, marginTop: 6 }}>
                  <ThemedText type="small" style={{ color: isDark ? '#00f2fe' : AstroBarColors.primary, marginBottom: 10, fontWeight: '700' }}>Cambiar contraseña (opcional)</ThemedText>
                  <View style={{ marginBottom: 10 }}>
                    <TextInput
                      style={[styles.profileInput, { backgroundColor: bgElement, color: textTitle, borderColor: borderStyle }]}
                      value={editProfile.currentPassword}
                      onChangeText={(text) => setEditProfile({...editProfile, currentPassword: text})}
                      placeholder="Contraseña actual"
                      placeholderTextColor={textSub}
                      secureTextEntry
                    />
                  </View>
                  <View style={{ marginBottom: 10 }}>
                    <TextInput
                      style={[styles.profileInput, { backgroundColor: bgElement, color: textTitle, borderColor: borderStyle }]}
                      value={editProfile.newPassword}
                      onChangeText={(text) => setEditProfile({...editProfile, newPassword: text})}
                      placeholder="Nueva contraseña"
                      placeholderTextColor={textSub}
                      secureTextEntry
                    />
                  </View>
                  <View>
                    <TextInput
                      style={[styles.profileInput, { backgroundColor: bgElement, color: textTitle, borderColor: borderStyle }]}
                      value={editProfile.confirmPassword}
                      onChangeText={(text) => setEditProfile({...editProfile, confirmPassword: text})}
                      placeholder="Confirmar contraseña"
                      placeholderTextColor={textSub}
                      secureTextEntry
                    />
                  </View>
                </View>
              </View>
              
              <View style={[styles.modalButtons, { marginTop: 20 }]}>
                <Pressable style={[styles.modalButton, styles.cancelButton, { borderColor: borderStyle }]} onPress={() => setShowEditProfileModal(false)}>
                  <ThemedText type="body" style={{ color: textTitle, fontWeight: '600' }}>Cancelar</ThemedText>
                </Pressable>
                <Pressable style={[styles.modalButton, { backgroundColor: AstroBarColors.primary }]} onPress={async () => {
                    if (!editProfile.name.trim()) { showToast("El nombre es obligatorio", "error"); return; }
                    if (editProfile.newPassword || editProfile.currentPassword || editProfile.confirmPassword) {
                      if (!editProfile.currentPassword) { showToast("Ingresa tu contraseña actual", "error"); return; }
                      if (!editProfile.newPassword) { showToast("Ingresa la nueva contraseña", "error"); return; }
                      if (editProfile.newPassword !== editProfile.confirmPassword) { showToast("Las contraseñas no coinciden", "error"); return; }
                      if (editProfile.newPassword.length < 6) { showToast("La contraseña debe tener al menos 6 caracteres", "error"); return; }
                    }
                    try {
                      const updateData: any = { name: editProfile.name.trim(), email: editProfile.email.trim(), phone: editProfile.phone.trim() };
                      if (editProfile.newPassword) { updateData.currentPassword = editProfile.currentPassword; updateData.newPassword = editProfile.newPassword; }
                      const response = await apiRequest("PUT", "/api/user/profile", updateData);
                      const data = await response.json();
                      if (data.success) {
                        await updateUser({ name: editProfile.name.trim(), email: editProfile.email.trim(), phone: editProfile.phone.trim() });
                        setShowEditProfileModal(false);
                        showToast(editProfile.newPassword ? "Perfil y contraseña actualizados" : "Perfil actualizado", "success");
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      } else { throw new Error(data.error || "Error al actualizar"); }
                    } catch (error: any) {
                      showToast(error.message || "Error al actualizar perfil", "error");
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    }
                }}>
                  <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "700" }}>Guardar</ThemedText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Modal>

      {/* SECCIÓN RESTO DE MODALS (IDIOMA, DIRECCIONES) MATCHEADOS */}
      <Modal visible={showLanguageModal} transparent animationType="fade" onRequestClose={() => setShowLanguageModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowLanguageModal(false)}>
          <View style={[styles.modalContent, { backgroundColor: bgSurface, borderColor: borderStyle, borderWidth: isDark ? 1 : 0 }]}>
            <View style={[styles.modalIcon, { backgroundColor: bgElement }]}>
              <Feather name="globe" size={26} color={isDark ? '#45aaf2' : AstroBarColors.primary} />
            </View>
            <ThemedText type="h3" style={[styles.modalTitle, { color: textTitle }]}>Idioma</ThemedText>
            <View style={styles.themeOptions}>
              <View style={[styles.themeOption, { backgroundColor: isDark ? '#1a273a' : AstroBarColors.primaryLight, borderColor: isDark ? '#00f2fe' : AstroBarColors.primary }]}>
                <ThemedText type="body" style={{ color: isDark ? '#00f2fe' : AstroBarColors.primary, fontWeight: "700" }}>Español</ThemedText>
                <Feather name="check" size={18} color={isDark ? '#00f2fe' : AstroBarColors.primary} style={{ marginLeft: "auto" }} />
              </View>
            </View>
            <ThemedText type="small" style={[styles.comingSoon, { color: textSub, marginTop: 4, fontWeight: '500' }]}>Más idiomas próximamente...</ThemedText>
            <Pressable style={[styles.modalButtonFull, { backgroundColor: bgElement }]} onPress={() => setShowLanguageModal(false)}>
              <ThemedText type="body" style={{ color: textTitle, fontWeight: '600' }}>Cerrar</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  profileCard: { alignItems: "center", padding: Spacing.xl, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  avatarContainer: { position: "relative", marginBottom: Spacing.md, width: 104, height: 104, borderRadius: 52, borderWidth: 2.5, padding: 4, justifyContent: 'center', alignItems: 'center' },
  avatar: { width: '100%', height: '100%', borderRadius: 50 },
  editBadge: { position: "absolute", bottom: -2, right: -2, width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", borderWidth: 2.5 },
  userName: { marginBottom: Spacing.xs },
  section: { borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, overflow: "hidden" },
  sectionTitle: { padding: Spacing.lg, paddingBottom: Spacing.xs, fontSize: 12, fontWeight: "800" },
  settingsItem: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  settingsIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  settingsContent: { flex: 1, marginLeft: Spacing.md },
  version: { textAlign: "center", marginTop: Spacing.md, marginBottom: Spacing.xl },
  socialButtons: { flexDirection: "row", justifyContent: "center", gap: Spacing.md, paddingHorizontal: Spacing.lg },
  socialButton: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.75)", justifyContent: "center", alignItems: "center", padding: Spacing.lg },
  modalContent: { width: "100%", maxWidth: 330, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: "center" },
  modalIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", marginBottom: Spacing.lg },
  modalTitle: { marginBottom: Spacing.sm, textAlign: "center", fontWeight: '800' },
  modalMessage: { textAlign: "center", marginBottom: Spacing.xl, fontWeight: '500', fontSize: 14, lineHeight: 20 },
  modalButtons: { flexDirection: "row", gap: Spacing.md, width: "100%" },
  modalButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center" },
  modalButtonFull: { width: "100%", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center", marginTop: Spacing.md },
  cancelButton: { borderWidth: 1 },
  logoutButton: { backgroundColor: AstroBarColors.error },
  themeOptions: { width: "100%", gap: Spacing.sm, marginBottom: Spacing.md },
  themeOption: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingVertical: Spacing.md, marginBottom: Spacing.md },
  comingSoon: { textAlign: "center", marginBottom: Spacing.md },
  statsCard: { padding: Spacing.xl, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  statsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.lg },
  statItem: { alignItems: 'center' },
  levelBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.md, borderRadius: BorderRadius.full },
  profileInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 15, fontWeight: '500' },
});