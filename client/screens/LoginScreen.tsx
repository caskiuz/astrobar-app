import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ImageBackground,
  Image,
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

const { width: screenWidth } = Dimensions.get("window");

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

  const [loginMode, setLoginMode] = useState<"sms" | "password">("sms");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; identifier?: string; password?: string }>({});
  const [featuredBusinesses, setFeaturedBusinesses] = useState<FeaturedBusiness[]>([]);
  const [showBiometricOption, setShowBiometricOption] = useState(false);

  useEffect(() => {
    fetchFeaturedBusinesses();
    checkBiometricLogin();
  }, []);

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
      {/* Overlay con degradado espacial */}
      <LinearGradient 
        colors={['rgba(15, 23, 42, 0.8)', 'rgba(30, 27, 75, 0.7)', 'rgba(88, 28, 135, 0.5)']}
        style={StyleSheet.absoluteFill}
      />

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
            <Image
              source={require("../../assets/astrobarlogo.jpg")}
              style={styles.logo}
              resizeMode="contain"
            />
            <ThemedText type="hero" style={styles.appName}>AstroBar</ThemedText>
            <ThemedText type="body" style={styles.slogan}>Conectando bares con usuarios</ThemedText>
          </View>

          <BlurView intensity={40} tint="dark" style={[styles.formCard, Shadows.lg]}>
            <ThemedText type="h3" style={styles.formTitle}>Bienvenido a AstroBar</ThemedText>
            <ThemedText type="body" style={styles.formSubtitle}>
              {loginMode === "password" 
                ? "Usa tu correo o teléfono con contraseña" 
                : "Te enviaremos un código SMS para verificar"}
            </ThemedText>

            {loginMode === "password" ? (
              <>
                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>Correo o teléfono</ThemedText>
                  <View style={[styles.inputBox, errors.identifier ? styles.inputBoxError : null]}>
                    <Feather name="user" size={20} color="#BBB" style={styles.inputBoxIcon} />
                    <TextInput
                      placeholder="correo@ejemplo.com"
                      value={identifier}
                      onChangeText={(text) => setIdentifier(text)}
                      placeholderTextColor="#777"
                      style={styles.textInput}
                    />
                  </View>
                </View>
                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>Contraseña</ThemedText>
                  <View style={[styles.inputBox, errors.password ? styles.inputBoxError : null]}>
                    <Feather name="lock" size={20} color="#BBB" style={styles.inputBoxIcon} />
                    <TextInput
                      placeholder="Tu contraseña"
                      value={password}
                      secureTextEntry={!showPassword}
                      onChangeText={(text) => setPassword(text)}
                      placeholderTextColor="#777"
                      style={styles.textInput}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)}>
                      <Feather name={showPassword ? "eye-off" : "eye"} size={20} color="#BBB" />
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
                    <Feather name="phone" size={20} color="#BBB" style={styles.inputBoxIcon} />
                    <TextInput
                      placeholder="11 97 123 4567"
                      value={formatPhoneDisplay(phone)}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      placeholderTextColor="#777"
                      style={styles.textInput}
                      maxLength={12}
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
                <ThemedText style={{color: '#FFF', fontWeight: 'bold'}}>
                  {loginMode === "password" ? "Iniciar sesión" : "Enviar código SMS"}
                </ThemedText>
              )}
            </Button>

            <Pressable
              onPress={() => setLoginMode(loginMode === "password" ? "sms" : "password")}
              style={styles.switchModeButton}
            >
              <ThemedText type="small" style={styles.switchModeText}>
                {loginMode === "password" ? "Iniciar con código SMS" : "Iniciar con contraseña"}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  themeToggleContainer: {
    position: "absolute",
    right: Spacing.lg,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
  },
  overlay: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  logoContainer: { alignItems: "center", marginBottom: Spacing.xl },
  logo: { width: 100, height: 100, marginBottom: Spacing.sm, borderRadius: 50 },
  appName: { color: "#FFFFFF", textShadowColor: AstroBarColors.primary, textShadowRadius: 10 },
  slogan: { color: AstroBarColors.primary, fontWeight: "500", marginTop: 5 },
  formCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  formTitle: { textAlign: "center", color: "#FFF", marginBottom: Spacing.xs },
  formSubtitle: { textAlign: "center", color: "#BBB", marginBottom: Spacing.lg },
  inputWrapper: { marginBottom: Spacing.md },
  inputLabel: { color: "#EEE", fontWeight: "600", marginBottom: Spacing.xs },
  phoneInputContainer: { flexDirection: "row", gap: Spacing.sm },
  countryCode: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    height: 52,
  },
  countryCodeText: { color: "#FFF", fontWeight: "600" },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  inputBoxIcon: { marginRight: Spacing.sm },
  textInput: { flex: 1, fontSize: 16, color: "#FFF" },
  inputBoxError: { borderColor: AstroBarColors.error },
  loginButton: { 
    marginTop: Spacing.sm, 
    backgroundColor: '#8B5CF6', // Violeta intenso neón
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5
  },
  switchModeButton: { marginTop: Spacing.md, alignItems: 'center' },
  switchModeText: { color: '#A78BFA', fontWeight: "500" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  footerText: { color: "#BBB" },
  signupLink: { color: '#8B5CF6', fontWeight: "bold", marginLeft: 5 },
});