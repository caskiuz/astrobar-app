import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  ImageBackground,
  Share,
  TextInput,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { Input } from "@/components/Input";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { UserRole } from "@/types";
import { useToast } from "@/contexts/ToastContext";

const foodBgImage = require("../../assets/astrobarfondo.jpeg");
const PENDING_BUSINESS_DRAFT_KEY = "@AstroBar_pending_business_draft";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type SignupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Signup">;
  route: RouteProp<RootStackParamList, "Signup">;
};

const ROLES: {
  value: UserRole;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}[] = [
  {
    value: "customer",
    label: "Cliente",
    icon: "user",
    description: "Descubre promociones en bares",
  },
  {
    value: "business_owner",
    label: "Dueño de Bar",
    icon: "zap",
    description: "Crea promociones para tu bar",
  },
];

const BUSINESS_TYPES = [
  { id: "bar", name: "Bar" },
  { id: "nightclub", name: "Discoteca" },
  { id: "pub", name: "Pub" },
  { id: "lounge", name: "Lounge" },
  { id: "restaurant_bar", name: "Restaurante Bar" },
  { id: "other", name: "Otro" },
];

// Componente para renderizar y animar cada estrella en el espacio exterior
function StarParticle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(0.9, { duration: 1200 + Math.random() * 1000 }), -1, true)
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

import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay } from "react-native-reanimated";

export default function SignupScreen({ navigation, route }: SignupScreenProps) {
  const { theme } = useTheme();
  const { signup } = useAuth();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();

  const initialPhone = route.params?.phone || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState(initialPhone);
  const [role, setRole] = useState<UserRole>("customer");
  const [birthDate, setBirthDate] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("bar");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showUserExistsModal, setShowUserExistsModal] = useState(false);
  const [starList, setStarList] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 2.5 + 1,
      delay: Math.random() * 1800,
    }));
    setStarList(generated);
  }, []);

  const calculateAge = (dateString: string) => {
    const [day, month, year] = dateString.split('/').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const formatDateDisplay = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  };

  const handleDateChange = (text: string) => {
    const numbers = text.replace(/\D/g, "").slice(0, 8);
    setBirthDate(numbers);
    if (errors.birthDate) {
      setErrors((prev) => ({ ...prev, birthDate: "" }));
    }
  };

  const formatPhoneDisplay = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6)
      return `${numbers.slice(0, 3)} ${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)} ${numbers.slice(3, 6)} ${numbers.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const numbers = text.replace(/\D/g, "").slice(0, 10);
    setPhone(numbers);
    if (role === "business_owner" && !businessPhone) {
      setBusinessPhone(numbers);
    }
    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: "" }));
    }
  };

  const validateEmail = (emailValue: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "El nombre es requerido";
    }

    if (email.trim() && !validateEmail(email)) {
      newErrors.email = "Ingresa un correo válido";
    }

    if (!password) {
      newErrors.password = "La contraseña es requerida";
    } else if (password.length < 8) {
      newErrors.password = "Mínimo 8 caracteres";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Las contraseñas no coinciden";
    }

    if (!phone) {
      newErrors.phone = "El teléfono es requerido";
    } else if (phone.length < 10) {
      newErrors.phone = "Ingresa 10 dígitos";
    }

    if (!birthDate) {
      newErrors.birthDate = "La fecha de nacimiento es requerida";
    } else {
      const age = calculateAge(birthDate);
      if (age < 18) {
        newErrors.birthDate = "Debes ser mayor de 18 años para usar AstroBar";
      }
    }

    if (role === "business_owner") {
      if (!businessName.trim()) {
        newErrors.businessName = "El nombre del negocio es requerido";
      }
      if (!businessAddress.trim()) {
        newErrors.businessAddress = "La dirección es requerida";
      }
      if (!businessType) {
        newErrors.businessType = "Selecciona el tipo de negocio";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const formattedPhone = phone.startsWith('+') ? phone : `+54${phone}`;
      const result = await signup(
        name,
        role,
        formattedPhone,
        email.trim() ? email : undefined,
        password,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (result?.requiresVerification) {
        if (role === "business_owner") {
          await AsyncStorage.setItem(
            PENDING_BUSINESS_DRAFT_KEY,
            JSON.stringify({
              name: businessName.trim(),
              type: businessType,
              address: businessAddress.trim(),
              phone: businessPhone.trim() || formattedPhone,
            })
          );
        }
        navigation.navigate("VerifyPhone", { phone: formattedPhone });
      }
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error.message?.includes("already") || error.message?.includes("existe")) {
        setShowUserExistsModal(true);
      } else {
        setErrors({ email: error.message || "Error al crear la cuenta" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message:
          "Descubre AstroBar - Tu Promociones Nocturnas de confianza. Descubre promociones en bares con un toque. Descarga ahora: https://AstroBar.replit.app",
        title: "AstroBar - Promociones Nocturnas",
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  return (
    <ImageBackground
      source={foodBgImage}
      style={styles.container}
      resizeMode="cover"
    >
      {/* 🌌 Overlay con degradado espacial profundo continuo */}
      <LinearGradient 
        colors={['rgba(11, 17, 30, 0.92)', 'rgba(15, 23, 42, 0.85)', 'rgba(5, 8, 15, 0.80)']}
        style={StyleSheet.absoluteFill}
      />

      {/* ✨ Estrellas titilantes de fondo */}
      {starList.map((star) => (
        <StarParticle key={star.id} x={star.x} y={star.y} size={star.size} delay={star.delay} />
      ))}

      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + Spacing.lg,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <View style={styles.backButtonCircle}>
                <Feather name="arrow-left" size={24} color="#00f2fe" />
              </View>
            </Pressable>
            <ThemedText type="hero" style={styles.title}>
              Crear cuenta
            </ThemedText>
            <ThemedText type="body" style={styles.subtitle}>
              Registra tu correo, teléfono y contraseña galáctica
            </ThemedText>
          </View>

          {/* Tarjeta translúcida Cristal Esmerilado */}
          <BlurView intensity={35} tint="dark" style={[styles.formCard, Shadows.lg]}>
            <Input
              label="Nombre completo"
              placeholder="Tu nombre"
              leftIcon="user"
              value={name}
              onChangeText={setName}
              error={errors.name}
              autoCapitalize="words"
              testID="input-name"
            />

            <Input
              label="Correo electrónico (opcional)"
              placeholder="tu@email.com"
              leftIcon="mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
              }}
              error={errors.email}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              testID="input-email"
            />

            <View style={styles.inputWrapper}>
              <ThemedText type="small" style={styles.inputLabel}>
                Contraseña
              </ThemedText>
              <View
                style={[
                  styles.inputBox,
                  errors.password ? styles.inputBoxError : null,
                ]}
              >
                <Feather
                  name="lock"
                  size={18}
                  color="#00f2fe"
                  style={styles.inputBoxIcon}
                />
                <TextInput
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: "" }));
                  }}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#64748b"
                  style={styles.textInput}
                  selectionColor="#00f2fe"
                  testID="input-password"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)}>
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={18}
                    color="#94a3b8"
                  />
                </Pressable>
              </View>
              {errors.password ? (
                <ThemedText type="caption" style={styles.inputError}>
                  {errors.password}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.inputWrapper}>
              <ThemedText type="small" style={styles.inputLabel}>
                Confirmar contraseña
              </ThemedText>
              <View
                style={[
                  styles.inputBox,
                  errors.confirmPassword ? styles.inputBoxError : null,
                ]}
              >
                <Feather
                  name="lock"
                  size={18}
                  color="#00f2fe"
                  style={styles.inputBoxIcon}
                />
                <TextInput
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: "" }));
                  }}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#64748b"
                  style={styles.textInput}
                  selectionColor="#00f2fe"
                  testID="input-confirm-password"
                />
              </View>
              {errors.confirmPassword ? (
                <ThemedText type="caption" style={styles.inputError}>
                  {errors.confirmPassword}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.inputWrapper}>
              <ThemedText type="small" style={styles.inputLabel}>
                Número de teléfono
              </ThemedText>
              <View style={styles.phoneInputContainer}>
                <View style={styles.countryCode}>
                  <ThemedText type="body" style={styles.countryCodeText}>
                    +54
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.inputBox,
                    errors.phone ? styles.inputBoxError : null,
                  ]}
                >
                  <Feather
                    name="phone"
                    size={18}
                    color="#00f2fe"
                    style={styles.inputBoxIcon}
                  />
                  <TextInput
                    placeholder="11 23 9388 52"
                    value={formatPhoneDisplay(phone)}
                    onChangeText={handlePhoneChange}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    placeholderTextColor="#64748b"
                    style={styles.textInput}
                    selectionColor="#00f2fe"
                    maxLength={14}
                    testID="input-phone"
                  />
                </View>
              </View>
              {errors.phone ? (
                <ThemedText type="caption" style={styles.inputError}>
                  {errors.phone}
                </ThemedText>
              ) : null}
              <ThemedText type="caption" style={styles.phoneHint}>
                Te enviaremos un SMS para verificar tu número
              </ThemedText>
            </View>

            <View style={styles.inputWrapper}>
              <ThemedText type="small" style={styles.inputLabel}>
                Fecha de nacimiento (DD/MM/AAAA)
              </ThemedText>
              <View
                style={[
                  styles.inputBox,
                  errors.birthDate ? styles.inputBoxError : null,
                ]}
              >
                <Feather
                  name="calendar"
                  size={18}
                  color="#00f2fe"
                  style={styles.inputBoxIcon}
                />
                <TextInput
                  placeholder="01/01/2000"
                  value={formatDateDisplay(birthDate)}
                  onChangeText={handleDateChange}
                  keyboardType="number-pad"
                  placeholderTextColor="#64748b"
                  style={styles.textInput}
                  selectionColor="#00f2fe"
                  maxLength={10}
                  testID="input-birthdate"
                />
              </View>
              {errors.birthDate ? (
                <ThemedText type="caption" style={styles.inputError}>
                  {errors.birthDate}
                </ThemedText>
              ) : null}
              <ThemedText type="caption" style={styles.phoneHint}>
                Debes ser mayor de 18 años para usar AstroBar
              </ThemedText>
            </View>

            {role === "business_owner" ? (
              <>
                <ThemedText type="small" style={styles.inlineSectionTitle}>
                  Datos del negocio
                </ThemedText>
                <ThemedText type="caption" style={styles.inlineSectionNote}>
                  Solo lo esencial para empezar. Podrás completar más datos después.
                </ThemedText>

                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Nombre del negocio
                  </ThemedText>
                  <View
                    style={[
                      styles.inputBox,
                      errors.businessName ? styles.inputBoxError : null,
                    ]}
                  >
                    <Feather
                      name="briefcase"
                      size={18}
                      color="#00f2fe"
                      style={styles.inputBoxIcon}
                    />
                    <TextInput
                      placeholder="Ej: Astro Club San Telmo"
                      value={businessName}
                      onChangeText={(text) => {
                        setBusinessName(text);
                        if (errors.businessName) {
                          setErrors((prev) => ({ ...prev, businessName: "" }));
                        }
                      }}
                      placeholderTextColor="#64748b"
                      style={styles.textInput}
                      selectionColor="#00f2fe"
                    />
                  </View>
                  {errors.businessName ? (
                    <ThemedText type="caption" style={styles.inputError}>
                      {errors.businessName}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Tipo de negocio
                  </ThemedText>
                  <View style={styles.businessTypeRow}>
                    {BUSINESS_TYPES.map((type) => (
                      <Pressable
                        key={type.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setBusinessType(type.id);
                          if (errors.businessType) {
                            setErrors((prev) => ({ ...prev, businessType: "" }));
                          }
                        }}
                        style={[
                          styles.businessTypeChip,
                          businessType === type.id && styles.businessTypeChipActive,
                        ]}
                      >
                        <ThemedText
                          type="caption"
                          style={
                            businessType === type.id
                              ? styles.businessTypeChipTextActive
                              : styles.businessTypeChipText
                          }
                        >
                          {type.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  {errors.businessType ? (
                    <ThemedText type="caption" style={styles.inputError}>
                      {errors.businessType}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Dirección
                  </ThemedText>
                  <View
                    style={[
                      styles.inputBox,
                      errors.businessAddress ? styles.inputBoxError : null,
                    ]}
                  >
                    <Feather
                      name="map-pin"
                      size={18}
                      color="#00f2fe"
                      style={styles.inputBoxIcon}
                    />
                    <TextInput
                      placeholder="Calle y número"
                      value={businessAddress}
                      onChangeText={(text) => {
                        setBusinessAddress(text);
                        if (errors.businessAddress) {
                          setErrors((prev) => ({ ...prev, businessAddress: "" }));
                        }
                      }}
                      placeholderTextColor="#64748b"
                      style={styles.textInput}
                      selectionColor="#00f2fe"
                    />
                  </View>
                  {errors.businessAddress ? (
                    <ThemedText type="caption" style={styles.inputError}>
                      {errors.businessAddress}
                    </ThemedText>
                  ) : null}
                </View>

                <View style={styles.inputWrapper}>
                  <ThemedText type="small" style={styles.inputLabel}>
                    Teléfono del negocio (opcional)
                  </ThemedText>
                  <View style={styles.inputBox}>
                    <Feather
                      name="phone"
                      size={18}
                      color="#00f2fe"
                      style={styles.inputBoxIcon}
                    />
                    <TextInput
                      placeholder="Ej: 11 23 9388 52"
                      value={formatPhoneDisplay(businessPhone)}
                      onChangeText={(text) => setBusinessPhone(text.replace(/\D/g, "").slice(0, 10))}
                      keyboardType="phone-pad"
                      placeholderTextColor="#64748b"
                      style={styles.textInput}
                      selectionColor="#00f2fe"
                      maxLength={14}
                    />
                  </View>
                </View>
              </>
            ) : null}

            <Input
              label="Código de referido (opcional)"
              placeholder="Ej: ABC123"
              leftIcon="gift"
              value={referralCode}
              onChangeText={(text) => setReferralCode(text.toUpperCase())}
              autoCapitalize="characters"
              maxLength={10}
              testID="input-referral"
            />

            <ThemedText type="small" style={styles.roleLabel}>
              ¿Cómo quieres usar AstroBar?
            </ThemedText>
            
            {/* 🪐 CONTROL DE ROLES REESTRUCTURADO SIN VIOLETA Y CON CONTORNOS CIAN NEÓN */}
            <View style={styles.rolesContainer}>
              {ROLES.map((r) => {
                const isSelected = role === r.value;
                return (
                  <Pressable
                    key={r.value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRole(r.value);
                    }}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: isSelected ? "rgba(0, 242, 254, 0.12)" : "rgba(15, 23, 42, 0.6)",
                        borderColor: isSelected ? "#00f2fe" : "rgba(255, 255, 255, 0.15)",
                        borderWidth: isSelected ? 2 : 1.5,
                      },
                    ]}
                    testID={`role-${r.value}`}
                  >
                    <View
                      style={[
                        styles.roleIcon,
                        {
                          backgroundColor: isSelected ? "#00f2fe" : "rgba(255, 255, 255, 0.1)",
                        },
                      ]}
                    >
                      <Feather
                        name={r.icon}
                        size={20}
                        color={isSelected ? "#05080f" : "#94a3b8"}
                      />
                    </View>
                    <ThemedText
                      type="small"
                      style={{
                        fontWeight: "800",
                        textAlign: "center",
                        color: isSelected ? "#00f2fe" : "#cbd5e1",
                      }}
                    >
                      {r.label}
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{
                        color: "#94a3b8",
                        textAlign: "center",
                        fontSize: 10,
                        marginTop: 2,
                      }}
                    >
                      {r.description}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            {/* 🪐 BOTÓN DE REGISTRO MEJORADO CON PRESSABLE CIAN NEÓN PREMIUM */}
            <Pressable
              onPress={handleSignup}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.signupButtonNative,
                {
                  backgroundColor: pressed ? "rgba(0, 242, 254, 0.85)" : "#00f2fe",
                  opacity: isLoading ? 0.6 : 1,
                }
              ]}
              testID="button-signup"
            >
              {isLoading ? (
                <ActivityIndicator color="#05080f" size="small" />
              ) : (
                <ThemedText style={styles.signupButtonTextNative}>
                  Crear cuenta
                </ThemedText>
              )}
            </Pressable>

            <ThemedText type="caption" style={styles.termsText}>
              Al registrarte aceptas nuestros términos y condiciones
            </ThemedText>
          </BlurView>

          <ConfirmModal
            visible={showUserExistsModal}
            title="Cuenta ya registrada"
            message="Este correo o teléfono ya está registrado. Inicia sesión para continuar."
            confirmText="Ir a iniciar sesión"
            cancelText="Cerrar"
            onConfirm={() => {
              setShowUserExistsModal(false);
              navigation.navigate("Login");
            }}
            onCancel={() => setShowUserExistsModal(false)}
          />

          <Pressable onPress={handleShare} style={styles.shareButton}>
            <Feather name="share-2" size={18} color="#00f2fe" />
            <ThemedText type="small" style={styles.shareText}>
              Compartir AstroBar
            </ThemedText>
          </Pressable>

          <View style={styles.loginLink}>
            <ThemedText type="body" style={styles.loginText}>
              ¿Ya tienes cuenta?{" "}
            </ThemedText>
            <Pressable onPress={() => navigation.goBack()}>
              <ThemedText type="body" style={styles.loginLinkText}>
                Inicia sesión
              </ThemedText>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1 },
  star: { position: "absolute", backgroundColor: "#FFFFFF" },
  scrollContent: { paddingHorizontal: Spacing.xl },
  header: { marginBottom: Spacing.md },
  backButton: { marginBottom: Spacing.sm },
  backButtonCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.08)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  title: { color: "#FFFFFF", fontWeight: "900" },
  subtitle: { color: "#94a3b8", marginTop: 4, fontSize: 14 },
  formCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(15, 23, 42, 0.4)", overflow: "hidden" },
  inputWrapper: { marginBottom: Spacing.md },
  inputLabel: { color: "#cbd5e1", fontWeight: "600", marginBottom: 6, fontSize: 13 },
  phoneInputContainer: { flexDirection: "row", gap: Spacing.sm },
  countryCode: { backgroundColor: "rgba(15, 23, 42, 0.6)", borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", height: 48 },
  countryCodeText: { color: "#FFF", fontWeight: "700" },
  inputBox: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.6)", borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.15)", paddingHorizontal: Spacing.md, height: 48 },
  inputBoxError: { borderColor: AstroBarColors.error },
  inputBoxIcon: { marginRight: Spacing.xs },
  textInput: { flex: 1, height: "100%", fontSize: 15, color: "#FFF", fontWeight: "500" },
  inputError: { color: AstroBarColors.error, marginTop: Spacing.xs },
  phoneHint: { color: "#94a3b8", marginTop: Spacing.xs, fontSize: 11, fontWeight: "500" },
  roleLabel: { fontWeight: "700", marginBottom: Spacing.sm, color: "#cbd5e1", fontSize: 14 },
  rolesContainer: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.xl },
  roleCard: { flex: 1, padding: Spacing.md, borderRadius: BorderRadius.lg, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  roleIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xs },
  inlineSectionTitle: { fontWeight: "800", marginBottom: Spacing.xs, color: "#00f2fe", fontSize: 15, textTransform: "uppercase", letterSpacing: 1 },
  inlineSectionNote: { color: "#94a3b8", marginBottom: Spacing.sm, fontSize: 12, fontWeight: "500" },
  businessTypeRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.xs },
  businessTypeChip: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", backgroundColor: "rgba(15, 23, 42, 0.4)" },
  businessTypeChipActive: { borderColor: "#00f2fe", backgroundColor: "rgba(0, 242, 254, 0.15)" },
  businessTypeChipText: { color: "#cbd5e1", fontWeight: "600" },
  businessTypeChipTextActive: { color: "#00f2fe", fontWeight: "700" },
  
  // 🔮 ESTILOS DEL BOTÓN REGISTRARSE NATIVO PREMIUM
  signupButtonNative: {
    marginTop: Spacing.md,
    height: 50,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#00f2fe",
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 5
  },
  signupButtonTextNative: {
    color: '#05080f',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
    textAlign: 'center',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  termsText: { textAlign: "center", color: "#94a3b8", marginTop: Spacing.md, fontSize: 11, fontWeight: "500" },
  shareButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
  shareText: { color: "#00f2fe", fontWeight: "700", fontSize: 14 },
  loginLink: { flexDirection: "row", justifyContent: "center", marginTop: Spacing.sm },
  loginText: { color: "#94a3b8", fontWeight: "500" },
  loginLinkText: { color: "#00f2fe", fontWeight: "800", marginLeft: 4 },
});