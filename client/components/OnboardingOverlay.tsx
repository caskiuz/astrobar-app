import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const ONBOARDING_KEY = "@AstroBar_onboarding_completed";

interface OnboardingSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  points?: string[];
}

// Unificamos la data adaptando las cadenas de texto crudas a filas independientes para evitar colisiones
const slides: OnboardingSlide[] = [
  {
    id: 1,
    title: "AstroBar",
    subtitle: "Tu app de entregas local",
    description:
      "Descubre las mejores promociones nocturnas en bares de Buenos Aires. Promos flash y ofertas exclusivas.",
    icon: "heart",
    iconColor: "#ff4757",
  },
  {
    id: 2,
    title: "AstroBar",
    subtitle: 'En Nahuatl significa "vivir"',
    description:
      '"Vivir es conectar"\n\nConectamos a la comunidad entera con los mejores sabores nocturnos y locales que amamos.',
    icon: "compass",
    iconColor: "#00f2fe",
  },
  {
    id: 3,
    title: "Cómo usar AstroBar",
    subtitle: "Es muy fácil",
    description: "Sigue estos pasos rápidos para empezar a disfrutar:",
    icon: "check-circle",
    iconColor: "#39ff14",
    points: [
      "1. Explora bares y promociones",
      "2. Agrega productos al carrito",
      "3. Paga con tarjeta o efectivo",
      "4. Recibe directo en tu puerta",
    ],
  },
];

// Componente para animar de fondo la constelación de estrellas de AstroBar
function StarFieldEffect({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const opacity = useSharedValue(0.1);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(0.85, { duration: 1200 + Math.random() * 1000 }), -1, true)
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

interface OnboardingOverlayProps {
  onComplete: () => void;
}

function SlideContent({
  slide,
  isActive,
}: {
  slide: OnboardingSlide;
  isActive: boolean;
}) {
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      scale.value = withSpring(1, { damping: 14, stiffness: 140 });
      opacity.value = withTiming(1, { duration: 350 });
    } else {
      scale.value = 0.92;
      opacity.value = 0;
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.slideContainer, { paddingTop: insets.top + Spacing.md }]}>
      <Animated.View style={[styles.slideContent, animatedStyle]}>
        
        {/* Tarjeta Cristal Tecnológica Flotante */}
        <BlurView intensity={30} tint="dark" style={styles.glassCard}>
          
          {/* Contenedor circular con aura neón */}
          <View style={[styles.iconContainer, { shadowColor: slide.iconColor, borderColor: slide.iconColor + "40" }]}>
            <Feather name={slide.icon} size={42} color={slide.iconColor} />
          </View>

          <ThemedText type="h1" style={styles.title}>
            {slide.title}
          </ThemedText>

          <ThemedText type="h4" style={styles.subtitle}>
            {slide.subtitle}
          </ThemedText>

          <View style={[styles.divider, { backgroundColor: slide.iconColor + "60", shadowColor: slide.iconColor }]} />

          <ThemedText type="body" style={styles.description}>
            {slide.description}
          </ThemedText>

          {/* Renderizado limpio de pasos para evitar superposición en el slide final */}
          {slide.points && (
            <View style={styles.pointsWrapper}>
              {slide.points.map((item, idx) => (
                <View key={idx} style={styles.pointRow}>
                  <ThemedText style={styles.pointText}>{item}</ThemedText>
                </View>
              ))}
            </View>
          )}
        </BlurView>

      </Animated.View>
    </View>
  );
}

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [stars, setStars] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const generated = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 2.5 + 1,
      delay: Math.random() * 1800,
    }));
    setStars(generated);
  }, []);

  const handleNext = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      onComplete();
    }
  };

  const handleSkip = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };

  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={styles.overlay}
    >
      {/* Fondo espacial unificado continuo */}
      <LinearGradient colors={["#0b111e", "#05080f"]} style={StyleSheet.absoluteFillObject} />
      
      {/* Capa de estrellas espaciales parpadeando */}
      {stars.map((s) => (
        <StarFieldEffect key={s.id} x={s.x} y={s.y} size={s.size} delay={s.delay} />
      ))}

      {/* Contenido interactivo */}
      <Pressable style={styles.touchArea} onPress={handleNext}>
        <SlideContent slide={slides[currentSlide]} isActive={true} />
      </Pressable>

      {/* Footer estilizado sin superposiciones y adaptado a safe area */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.pagination}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === currentSlide && styles.dotActive]}
            />
          ))}
        </View>

        <View style={styles.buttons}>
          {!isLastSlide ? (
            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <ThemedText type="body" style={styles.skipText}>
                Saltar
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.skipButtonPlaceholder} />
          )}

          <Pressable
            onPress={handleNext}
            style={[
              styles.nextButton,
              { backgroundColor: isLastSlide ? "#39ff14" : AstroBarColors.primary }
            ]}
          >
            <ThemedText type="body" style={[styles.nextText, { color: isLastSlide ? "#05080f" : "#FFFFFF" }]}>
              {isLastSlide ? "Comenzar" : "Siguiente"}
            </ThemedText>
            <Feather
              name={isLastSlide ? "check" : "arrow-right"}
              size={16}
              color={isLastSlide ? "#05080f" : "#FFFFFF"}
            />
          </Pressable>
        </View>

        <ThemedText type="small" style={styles.tapHint}>
          Toca la pantalla para continuar
        </ThemedText>
      </View>
    </Animated.View>
  );
}

export async function checkOnboardingCompleted(): Promise<boolean> {
  try {
    const completed = await AsyncStorage.getItem(ONBOARDING_KEY);
    return completed === "true";
  } catch {
    return false;
  }
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  touchArea: { flex: 1 },
  star: { position: "absolute", backgroundColor: "#FFFFFF" },
  slideContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing.xl },
  slideContent: { width: "100%", maxWidth: 350 },
  glassCard: { width: "100%", borderRadius: BorderRadius.xl, padding: Spacing.xl, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", alignItems: "center", overflow: "hidden", backgroundColor: "rgba(15, 23, 42, 0.2)" },
  iconContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "center", alignItems: "center", marginBottom: Spacing.md, borderWidth: 1, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "950", textAlign: "center", letterSpacing: 0.5 },
  subtitle: { color: "#94a3b8", textAlign: "center", marginTop: 4, fontWeight: "600", fontSize: 14 },
  divider: { width: 45, height: 2, borderRadius: 1, marginVertical: Spacing.md, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 3 },
  description: { color: "#cbd5e1", textAlign: "center", lineHeight: 21, fontSize: 14, fontWeight: "500" },
  
  // Estilos de la lista de puntos del paso 3 para blindarlo de colisiones
  pointsWrapper: { width: "100%", marginTop: Spacing.md, gap: 6 },
  pointRow: { width: "100%", paddingVertical: 6, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, backgroundColor: "rgba(255, 255, 255, 0.03)" },
  pointText: { color: "#e2e8f0", fontSize: 13, fontWeight: "600", textAlign: "left" },

  footer: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.xl, paddingTop: Spacing.md, backgroundColor: "transparent" },
  pagination: { flexDirection: "row", justifyContent: "center", marginBottom: Spacing.md },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "rgba(255, 255, 255, 0.2)", marginHorizontal: 4 },
  dotActive: { backgroundColor: "#00f2fe", width: 18 },
  buttons: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" },
  skipButton: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm, backgroundColor: "rgba(255,255,255,0.05)" },
  skipButtonPlaceholder: { width: 60 },
  skipText: { color: "#94a3b8", fontWeight: "700", fontSize: 13 },
  nextButton: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.md, gap: 6, ...Shadows.sm },
  nextText: { fontWeight: "800", fontSize: 14 },
  tapHint: { color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: Spacing.sm, fontWeight: '500', fontSize: 12 },
});