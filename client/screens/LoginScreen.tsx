import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ImageBackground,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Share,
  Dimensions,
  FlatList,
  TextInput,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withDelay 
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { ThemeToggleButton } from "@/components/ThemeToggleButton";
import { PlaceholderImage } from "@/components/PlaceholderImage";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useToast } from "@/contexts/ToastContext";
import { apiRequest } from "@/lib/query-client";

// 🪐 RUTA RELATIVA REAL: Subir dos niveles exactos desde client/screens/
import astrobarLogoImg from "../../assets/astrobarlogo.jpg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface FeaturedBusiness {
  id: string;
  name: string;
  image?: string;
  type: string;
  rating: number;
  deliveryTime?: string;
}

const astrobarBgImage = require("../../assets/astrobarfondo.jpeg");

type LoginScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Login">;
};

// Componente para renderizar y animar cada estrella en el espacio exterior
function StarParticle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0.9, { duration: 1200 + Math.random() * 1000 }),
        -1,
        true
      )
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

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { theme } = useTheme();
  const {
    requestPhoneLogin,
    loginWithPassword,
    loginWithBiometric,
    biometricAvailable,
    biometricType,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const [loginMode, setLoginMode] = useState<"sms" | "password">("password");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; identifier?: string; password?: string }>({});
  const [featuredBusinesses, setFeaturedBusinesses] = useState<FeaturedBusiness[]>([]);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [starList, setStarList] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    fetchFeaturedBusinesses();
    checkBiometricLogin();
    generateConstellation();
  }, []);

  const generateConstellation = () => {
    const generated = Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * (SCREEN_HEIGHT * 0.75),
      size: Math.random() * 2.5 + 1,
      delay: Math.random() * 1800,
    }));
    setStarList(generated);
  };

  const fetchFeaturedBusinesses = async () => {
    try {
      const res = await apiRequest("GET", "/api/businesses/featured");
      const data = await res.json();
      setFeaturedBusinesses(data.businesses || []);
    } catch (error) {
      console.log("Could not fetch featured businesses");
    }
  };

  const checkBiometricLogin = async () => {
    if (biometricAvailable) {
      const storedPhone = await import("@react-native-async-storage/async-storage")
        .then((m) => m.default.getItem("@astrobar_biometric_phone"));
      setShowBiometricOption(!!storedPhone);
    }
  };

  const formatPhoneDisplay = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const numbers = text.replace(/\D/g, "").slice(0, 10);
    setPhone(numbers);
    if (errors.phone) setErrors({});
  };

  const validate = () => {
    const newErrors: { phone?: string; identifier?: string; password?: string } = {};
    if (loginMode === "sms") {
      if (!phone) {
        newErrors.phone = "El teléfono es requerido";
      } else if (phone.length < 10) {
        newErrors.phone = "Ingresa 10 dígitos";
      }
    } else {
      if (!identifier) newErrors.identifier = "Correo o teléfono es requerido";
      if (!password) newErrors.password = "La contraseña es requerida";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePasswordLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await loginWithPassword(identifier, password);
      if (result?.requiresVerification) {
        showToast("Verifica tu teléfono para continuar", "info");
        navigation.navigate("VerifyPhone", { phone: identifier });
      }
    } catch (error: any) {
      showToast(error.message || "Error al iniciar sesión", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!validate()) return;
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const normalizedPhone = `+54${phone}`;
      const result = await requestPhoneLogin(normalizedPhone);
      if (result?.userNotFound) {
        showToast("No encontramos tu cuenta. Regístrate primero.", "info");
        navigation.navigate("Signup", { phone: normalizedPhone });
        return;
      }
      if (result?.requiresVerification) {
        navigation.navigate("VerifyPhone", { phone: normalizedPhone });
      }
    } catch (error: any) {
      showToast(error.message || "Error al enviar código", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ImageBackground source={astrobarBgImage} style={styles.container} resizeMode="cover">
      <LinearGradient 
        colors={['rgba(11, 17, 30, 0.85)', 'rgba(15, 23, 42, 0.75)', 'rgba(49, 46, 129, 0.45)']}
        style={StyleSheet.absoluteFill}
      />

      {starList.map((star) => (
        <StarParticle key={star.id} x={star.x} y={star.y} size={star.size} delay={star.delay} />
      ))}

      <View style={[styles.themeToggleContainer, { top: insets.top + Spacing.md }]}>
        <ThemeToggleButton />
      </View>

      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoContainer}>
            {/* CORRECCIÓN: Ahora consume la imagen estática blindada de forma directa */}
            <Image
              source={astrobarLogoImg}
              style={styles.logo}
              contentFit="contain"
            />
            <ThemedText type="hero" style={styles.appName}>AstroBar</ThemedText>
            <ThemedText type="body" style={styles.slogan}>Conectando bares con usuarios</ThemedText>
          </View>

          <BlurView intensity={35} tint="dark" style={[styles.formCard, Shadows.lg]}>
            <BaseFormTitle loginMode={loginMode} />

            {loginMode === "password" ? (
              <>
                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>Correo o teléfono</ThemedText>
                  <View style={[styles.inputBox, errors.identifier ? styles.inputBoxError : null]}>
                    <Feather name="user" size={18} color="#00f2fe" style={styles.inputBoxIcon} />
                    <TextInput
                      placeholder="correo@ejemplo.com"
                      value={identifier}
                      onChangeText={(text) => setIdentifier(text)}
                      placeholderTextColor="#64748b"
                      style={styles.textInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>
                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>Contraseña</ThemedText>
                  <View style={[styles.inputBox, errors.password ? styles.inputBoxError : null]}>
                    <Feather name="lock" size={18} color="#00f2fe" style={styles.inputBoxIcon} />
                    <TextInput
                      placeholder="Tu contraseña"
                      value={password}
                      secureTextEntry={!showPassword}
                      onChangeText={(text) => setPassword(text)}
                      placeholderTextColor="#64748b"
                      style={styles.textInput}
                      autoCapitalize="none"
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                      <Feather name={showPassword ? "eye-off" : "eye"} size={18} color="#94a3b8" />
                    </Pressable>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.inputWrapper}>
                <ThemedText type="small" style={styles.inputLabel}>Número de teléfono</ThemedText>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCode}>
                    <ThemedText type="body" style={styles.countryCodeText}>+54</ThemedText>
                  </View>
                  <View style={styles.inputBox}>
                    <Feather name="phone" size={18} color="#00f2fe" style={styles.inputBoxIcon} />
                    <TextInput
                      placeholder="11 97 123 4567"
                      value={formatPhoneDisplay(phone)}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      placeholderTextColor="#64748b"
                      style={styles.textInput}
                      maxLength={14}
                    />
                  </View>
                </View>
              </View>
            )}

            <Button
              onPress={loginMode === "password" ? handlePasswordLogin : handlePhoneLogin}
              disabled={isLoading}
              style={styles.loginButton}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={{color: '#FFF', fontWeight: 'bold', fontSize: 15}}>
                  {loginMode === "password" ? "Iniciar sesión" : "Enviar código SMS"}
                </ThemedText>
              )}
            </Button>

            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setLoginMode(loginMode === "password" ? "sms" : "password");
              }}
              style={styles.switchModeButton}
            >
              <ThemedText type="small" style={styles.switchModeText}>
                {loginMode === "password" ? "Usar código SMS alternativo" : "Iniciar con correo y contraseña"}
              </ThemedText>
            </Pressable>
          </BlurView>

          <View style={styles.footer}>
            <ThemedText type="body" style={styles.footerText}>¿No tienes cuenta? </ThemedText>
            <Pressable onPress={() => navigation.navigate("Signup")}>
              <ThemedText type="body" style={styles.signupLink}>Regístrate</ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

function BaseFormTitle({ loginMode }: { loginMode: "sms" | "password" }) {
  return (
    <>
      <ThemedText type="h3" style={styles.formTitle}>Bienvenido a AstroBar</ThemedText>
      <ThemedText type="body" style={styles.formSubtitle}>
        {loginMode === "password" 
          ? "Usa tu correo o teléfono con contraseña" 
          : "Te enviaremos un código SMS para verificar"}
      </ThemedText>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  star: { position: "absolute", backgroundColor: "#FFFFFF", shadowColor: "#FFFFFF", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 2 },
  themeToggleContainer: {
    position: "absolute",
    right: Spacing.lg,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
  },
  overlay: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  logoContainer: { alignItems: "center", marginBottom: Spacing.lg, marginTop: Spacing.sm },
  logo: { width: 94, height: 94, marginBottom: Spacing.xs, borderRadius: 47, borderWidth: 2, borderColor: '#00f2fe' },
  appName: { color: "#FFFFFF", textShadowColor: '#00f2fe', textShadowRadius: 8, fontWeight: '900' },
  slogan: { color: "#94a3b8", fontWeight: "600", marginTop: 2, fontSize: 13 },
  formCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    overflow: 'hidden'
  },
  formTitle: { textAlign: "center", color: "#FFF", marginBottom: Spacing.xs, fontWeight: '800' },
  formSubtitle: { textAlign: "center", color: "#94a3b8", marginBottom: Spacing.xl, fontSize: 13, fontWeight: '500' },
  inputWrapper: { marginBottom: Spacing.md },
  inputLabel: { color: "#cbd5e1", fontWeight: "600", marginBottom: 6, fontSize: 13 },
  phoneInputContainer: { flexDirection: "row", gap: Spacing.sm },
  countryCode: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    height: 48,
  },
  countryCodeText: { color: "#FFF", fontWeight: "700" },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputBoxIcon: { marginRight: Spacing.xs },
  textInput: { flex: 1, fontSize: 15, color: "#FFF", fontWeight: '500' },
  inputBoxError: { borderColor: AstroBarColors.error },
  loginButton: { 
    marginTop: Spacing.xs, 
    backgroundColor: AstroBarColors.primary,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AstroBarColors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4
  },
  switchModeButton: { marginTop: Spacing.md, paddingVertical: 4, alignItems: 'center' },
  switchModeText: { color: '#00f2fe', fontWeight: "700" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: Spacing.sm },
  footerText: { color: "#94a3b8", fontWeight: '500' },
  signupLink: { color: '#00f2fe', fontWeight: "800", marginLeft: 4 },
});