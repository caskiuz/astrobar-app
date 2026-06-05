import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { Platform, View, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay,
  withSpring 
} from "react-native-reanimated";

import { apiRequest } from "@/lib/query-client";
import { User, UserRole } from "@/types";
import { ThemedText } from "@/components/ThemedText";
import { AstroBarColors } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pendingVerificationPhone: string | null;
  biometricAvailable: boolean;
  biometricType: string | null;
  requestPhoneLogin: (phone: string) => Promise<{ userNotFound?: boolean; requiresVerification?: boolean }>;
  loginWithPassword: (identifier: string, password: string) => Promise<{ success: boolean; requiresVerification?: boolean }>;
  signup: (name: string, role: UserRole, phone: string, email?: string, password?: string) => Promise<{ requiresVerification: boolean }>;
  verifyPhone: (phone: string, code: string) => Promise<User>;
  resendVerification: (phone: string) => Promise<void>;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "@AstroBar_user";
const PENDING_PHONE_KEY = "@AstroBar_pending_phone";
const BIOMETRIC_PHONE_KEY = "@AstroBar_biometric_phone";

const normalizePhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+54${digits}`;
  if (phone.startsWith("+")) return phone.replace(/\s+/g, "");
  return `+${digits}`;
};

// 🌌 COMPONENTE INTERNO: Estrellas con parpadeo desfasado para el Splash
function SplashStarParticle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const opacity = useSharedValue(0.1);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(0.8, { duration: 1000 + Math.random() * 800 }), -1, true)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        animatedStyle,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    />
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingVerificationPhone, setPendingVerificationPhone] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);
  const [starList, setStarList] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);

  // Valores compartidos para la animación de entrada del Splash
  const logoScale = useSharedValue(0.4);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(15);

  useEffect(() => {
    loadUser();
    checkBiometricAvailability();
    generateSplashStars();
  }, []);

  const generateSplashStars = () => {
    const generated = Array.from({ length: 35 }).map((_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 1500,
    }));
    setStarList(generated);

    // Activamos animaciones estéticas fluidas
    logoScale.value = withSpring(1, { damping: 11, stiffness: 85 });
    logoOpacity.value = withTiming(1, { duration: 700 });
    textOpacity.value = withDelay(400, withTiming(1, { duration: 700 }));
    textY.value = withDelay(400, withSpring(0, { damping: 14 }));
  };

  const checkBiometricAvailability = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);

      if (compatible && enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType("fingerprint");
        } else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType("face");
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType("iris");
        }
      }
    } catch (error) {
      setBiometricAvailable(false);
    }
  };

  const loadUser = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const userData = JSON.parse(stored);
        setUser(userData);
        setToken(userData.token || null);
        
        if (userData.token) {
          await AsyncStorage.setItem("token", userData.token);
        }
      }
      
      const pendingPhone = await AsyncStorage.getItem(PENDING_PHONE_KEY);
      if (pendingPhone) {
        setPendingVerificationPhone(pendingPhone);
      }
      
      // 🔥 Delay artificial para que el Splash Screen luzca espectacular
      await new Promise((resolve) => setTimeout(resolve, 1600));

    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPhoneLogin = async (phone: string): Promise<{ userNotFound?: boolean; requiresVerification?: boolean }> => {
    const normalizedPhone = normalizePhone(phone);
    const response = await apiRequest("POST", "/api/auth/send-code", { phone: normalizedPhone });
    const data = await response.json();

    if (data.userNotFound) { return { userNotFound: true }; }

    await AsyncStorage.setItem(PENDING_PHONE_KEY, normalizedPhone);
    setPendingVerificationPhone(normalizedPhone);
    return { requiresVerification: true };
  };

  const loginWithPassword = async (identifier: string, password: string): Promise<{ success: boolean; requiresVerification?: boolean }> => {
    const isEmail = identifier.includes('@');
    
    if (isEmail) {
      const response = await apiRequest("POST", "/api/auth/dev-email-login", { email: identifier, password });
      const data = await response.json();

      if (!data.success) { throw new Error(data.error || "Credenciales incorrectas"); }

      const newUser: User = {
        id: data.user.id,
        email: data.user.email || undefined,
        name: data.user.name,
        phone: data.user.phone,
        role: data.user.role,
        phoneVerified: data.user.phoneVerified,
        isActive: data.user.isActive,
        token: data.token,
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      await AsyncStorage.setItem("token", data.token);
      setUser(newUser);
      return { success: true };
    }

    await requestPhoneLogin(identifier);
    return { success: false, requiresVerification: true };
  };

  const signup = async (name: string, role: UserRole, phone: string, email?: string, password?: string): Promise<{ requiresVerification: boolean }> => {
    const response = await apiRequest("POST", "/api/auth/phone-signup", { name, role, phone, email, password });
    const data = await response.json();

    if (!data.success) { throw new Error(data.error || "Error al crear la cuenta"); }

    if (data.requiresVerification) {
      await AsyncStorage.setItem(PENDING_PHONE_KEY, phone);
      setPendingVerificationPhone(phone);
      return { requiresVerification: true };
    }
    return { requiresVerification: false };
  };

  const verifyPhone = async (phone: string, code: string) => {
    const normalizedPhone = normalizePhone(phone);
    const response = await apiRequest("POST", "/api/auth/phone-login", { phone: normalizedPhone, code });
    const data = await response.json();

    const newUser: User = {
      id: data.user.id,
      email: data.user.email || undefined,
      name: data.user.name,
      phone: data.user.phone,
      role: data.user.role,
      phoneVerified: true,
      isActive: data.user.isActive,
      biometricEnabled: data.user.biometricEnabled || false,
      createdAt: new Date().toISOString(),
      preferences: { theme: "system", accentColor: "#00C853" },
      token: data.token,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    await AsyncStorage.setItem("token", data.token);
    await AsyncStorage.removeItem(PENDING_PHONE_KEY);
    setUser(newUser);
    setPendingVerificationPhone(null);
    return newUser;
  };

  const resendVerification = async (phone: string) => {
    await apiRequest("POST", "/api/auth/send-code", { phone });
  };

  const loginWithBiometric = async (): Promise<boolean> => {
    try {
      const storedPhone = await AsyncStorage.getItem(BIOMETRIC_PHONE_KEY);
      if (!storedPhone) return false;

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Inicia sesión con tu huella",
        fallbackLabel: "Usar código SMS",
        cancelLabel: "Cancelar",
        disableDeviceFallback: false,
      });

      if (!authResult.success) return false;

      const response = await apiRequest("POST", "/api/auth/biometric-login", { phone: storedPhone });
      const data = await response.json();
      if (data.error) return false;

      const newUser: User = {
        id: data.user.id,
        email: data.user.email || undefined,
        name: data.user.name,
        phone: data.user.phone,
        role: data.user.role,
        phoneVerified: data.user.phoneVerified,
        biometricEnabled: data.user.biometricEnabled,
        isActive: data.user.isActive,
        createdAt: new Date().toISOString(),
        token: data.token,
        preferences: { theme: "system", accentColor: "#00C853" },
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
      await AsyncStorage.setItem("token", data.token);
      setUser(newUser);
      return true;
    } catch (error) {
      return false;
    }
  };

  const enableBiometric = async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirma tu identidad para activar huella",
        fallbackLabel: "Cancelar",
        cancelLabel: "Cancelar",
        disableDeviceFallback: true,
      });

      if (!authResult.success) return false;

      const response = await apiRequest("POST", "/api/auth/enable-biometric", { userId: user.id });
      const data = await response.json();

      if (data.success) {
        await AsyncStorage.setItem(BIOMETRIC_PHONE_KEY, user.phone);
        const updatedUser = { ...user, biometricEnabled: true };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
        setUser(updatedUser);
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const disableBiometric = async () => {
    if (!user) return;
    try {
      await apiRequest("POST", "/api/auth/disable-biometric", { userId: user.id });
      await AsyncStorage.removeItem(BIOMETRIC_PHONE_KEY);
      const updatedUser = { ...user, biometricEnabled: false };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (error) {}
  };

  const logout = async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem(PENDING_PHONE_KEY);
    try {
      const { clearTokenCache } = await import("@/lib/query-client");
      clearTokenCache();
    } catch (error) {}
    setUser(null);
    setToken(null);
    setPendingVerificationPhone(null);
  };

  const updateUser = async (updates: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...updates };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setUser(updated);
    }
  };

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));

  // 🚀 CORRECCIÓN CLAVE: Usamos el alias global '@/assets' para blindar la build de EAS
  if (isLoading) {
    return (
      <View style={styles.splashContainer}>
        <LinearGradient colors={["#0b111e", "#05080f"]} style={StyleSheet.absoluteFillObject} />
        {starList.map((star) => (
          <SplashStarParticle key={star.id} x={star.x} y={star.y} size={star.size} delay={star.delay} />
        ))}
        <View style={styles.centerContent}>
          <Animated.View style={[styles.logoWrapper, logoStyle]}>
            <Image source={require("@/assets/astrobarlogo.jpg")} style={styles.logo} contentFit="cover" />
          </Animated.View>
          <Animated.View style={[styles.textWrapper, textStyle]}>
            <ThemedText style={styles.titleText}>ASTRO BAR</ThemedText>
            <View style={styles.neonLine} />
            <ThemedText style={styles.subtitleText}>Verificando Centro de Control...</ThemedText>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        pendingVerificationPhone,
        biometricAvailable,
        biometricType,
        requestPhoneLogin,
        loginWithPassword,
        signup,
        verifyPhone,
        resendVerification,
        loginWithBiometric,
        enableBiometric,
        disableBiometric,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  splashContainer: { flex: 1, backgroundColor: "#05080f", justifyContent: "center", alignItems: "center" },
  star: { position: "absolute", backgroundColor: "#FFFFFF" },
  centerContent: { alignItems: "center", justifyContent: "center" },
  logoWrapper: { width: 110, height: 110, borderRadius: 55, padding: 3, shadowColor: "#00f2fe", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 12, elevation: 10, marginBottom: 20 },
  logo: { width: "100%", height: "100%", borderRadius: 55, borderWidth: 2, borderColor: "#00f2fe" },
  textWrapper: { alignItems: "center", marginTop: 4 },
  titleText: { fontSize: 26, fontWeight: "900", color: "#FFFFFF", letterSpacing: 5, textShadowColor: "#00f2fe", textShadowRadius: 10, textAlign: "center" },
  neonLine: { width: 45, height: 2, backgroundColor: "#00f2fe", borderRadius: 2, marginVertical: 10, shadowColor: "#00f2fe", shadowOpacity: 0.8, shadowRadius: 4 },
  subtitleText: { fontSize: 11, fontWeight: "700", color: "#94a3b8", letterSpacing: 1.5, textTransform: "uppercase" },
});