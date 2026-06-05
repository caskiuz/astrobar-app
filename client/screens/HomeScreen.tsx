import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  TextInput,
  ImageBackground,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useBottomTabBarHeight,
  BottomTabNavigationProp,
} from "@react-navigation/bottom-tabs";
import {
  useNavigation,
  CompositeNavigationProp,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import Animated, {
  FadeInDown,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { BusinessCard } from "@/components/BusinessCard";
import { BusinessCardSkeleton } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useApp } from "@/contexts/AppContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { Business } from "@/types";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MainTabParamList } from "@/navigation/MainTabNavigator";

// 🪐 RUTA RELATIVA REAL CALCULADA DESDE CLIENT/SCREENS/
import astrobarBgImage from "../../assets/astrobarfondo.jpeg";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "HomeTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

const filters = [
  { id: "cercano", name: "Cercano", icon: "map-pin" },
  { id: "flash", name: "Flash", icon: "zap" },
  { id: "popular", name: "Popular", icon: "star" },
];

// 🌌 COMPONENTE INTERNO: Constelación de estrellas fluidas en vivo para el fondo
function HomeStarParticle({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  const opacity = useSharedValue(0.15);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(0.8, { duration: 1200 + Math.random() * 1000 }), -1, true)
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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { settings } = useApp();
  const showCarnivalBanner = false;

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [featuredBusinesses, setFeaturedBusinesses] = useState<Business[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [starList, setStarList] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);

  useEffect(() => {
    // Generación del mapa estelar galáctico
    const generated = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      y: Math.random() * SCREEN_HEIGHT,
      size: Math.random() * 2.5 + 1,
      delay: Math.random() * 1800,
    }));
    setStarList(generated);
  }, []);

  const loadData = useCallback(async () => {
    try {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (locError) {}

      const response = await apiRequest('GET', '/api/public/businesses');
      const data = await response.json();
      const rawBusinesses = data.businesses || [];
      
      const businessList: Business[] = rawBusinesses.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description || '',
        type: b.type || 'restaurant',
        profileImage: b.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
        bannerImage: b.cover_image || b.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
        rating: (b.rating || 0) / 100,
        reviewCount: b.total_ratings || 0,
        deliveryTime: b.delivery_time || '30-45 min',
        deliveryFee: (b.delivery_fee || 2500) / 100,
        minimumOrder: (b.min_order || 5000) / 100,
        isOpen: b.isOpen ?? b.is_open ?? false,
        openingHours: [],
        address: b.address || 'Buenos Aires, Argentina',
        phone: b.phone || '',
        categories: b.categories ? b.categories.split(',') : [],
        acceptsCash: true,
        featured: b.is_featured || false,
      }));
      
      setBusinesses(businessList);
      setFeaturedBusinesses(businessList.filter((b) => b.featured));
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const filterBusinesses = useCallback(
    (businessList: Business[]) => {
      let filtered = [...businessList];

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(
          (b) =>
            b.name.toLowerCase().includes(query) ||
            b.description.toLowerCase().includes(query) ||
            b.categories.some((cat) => cat.toLowerCase().includes(query)),
        );
      }

      if (activeCategory) {
        const categoryMap: Record<string, string[]> = {
          flash: ["flash", "promocion"],
          bar: ["bar"],
          nightclub: ["discoteca", "nightclub"],
          pub: ["pub"],
          lounge: ["lounge"],
          promo: ["promocion", "oferta"],
        };
        const matchCategories = categoryMap[activeCategory] || [activeCategory];
        filtered = filtered.filter((b) =>
          b.categories.some((cat) =>
            matchCategories.some((match) => cat.toLowerCase().includes(match)),
          ),
        );
      }

      if (activeFilter) {
        switch (activeFilter) {
          case "cercano":
            break;
          case "flash":
            filtered = filtered.filter((b) => b.featured);
            break;
          case "popular":
            filtered = filtered.filter((b) => b.rating >= 4.5);
            break;
        }
      }

      return filtered;
    },
    [searchQuery, activeCategory, activeFilter],
  );

  const filteredBusinesses = filterBusinesses(businesses);
  const bars = filteredBusinesses;
  const hasActiveFilters = searchQuery.trim() || activeCategory || activeFilter;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getDistanceText = (business: Business) => {
    if (!userLocation || !business.latitude || !business.longitude) return null;
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      business.latitude,
      business.longitude
    );
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  return (
    <ImageBackground source={astrobarBgImage} style={styles.container} resizeMode="cover">
      {/* 🌌 Degradado espacial profundo continuo en lugar del negro plano */}
      <LinearGradient
        colors={['rgba(5, 8, 15, 0.94)', 'rgba(11, 17, 30, 0.88)', 'rgba(15, 23, 42, 0.82)']}
        style={StyleSheet.absoluteFill}
      />

      {/* ✨ Estrellas dinámicas en el firmamento */}
      {starList.map((star) => (
        <HomeStarParticle key={star.id} x={star.x} y={star.y} size={star.size} delay={star.delay} />
      ))}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.sm,
            paddingBottom: tabBarHeight + Spacing["4xl"] + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#00f2fe"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Banner Header Premium */}
        <Animated.View
          entering={FadeInDown.delay(50).springify()}
          style={[styles.bannerContainer, Shadows.lg]}
        >
          <Image
            source={require("../../assets/astrobarbanner.jpg")}
            style={styles.bannerImage}
            contentFit="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(5, 8, 15, 0.9)']}
            style={styles.bannerOverlay}
          >
            <ThemedText type="h1" style={styles.bannerTitle}>
              AstroBar
            </ThemedText>
            <ThemedText type="body" style={styles.bannerSubtitle}>
              Promociones Nocturnas • Buenos Aires
            </ThemedText>
          </LinearGradient>
        </Animated.View>

        {/* Question Header */}
        <Animated.View
          entering={FadeInDown.delay(100).springify()}
          style={styles.questionContainer}
        >
          <ThemedText type="h1" style={styles.questionText}>
            ¿Qué bar visitarás esta noche?
          </ThemedText>
        </Animated.View>

        {/* Quick Access Icons */}
        <Animated.View
          entering={FadeInRight.delay(150).springify()}
          style={styles.quickAccessContainer}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickAccessScroll}
          >
            {[
              { id: "flash", icon: "zap", label: "Flash", color: "#FFD700" },
              { id: "bar", icon: "coffee", label: "Bares", color: "#00f2fe" },
              { id: "nightclub", icon: "music", label: "Discotecas", color: "#9C27B0" },
              { id: "pub", icon: "coffee", label: "Pubs", color: "#FF5722" },
              { id: "lounge", icon: "moon", label: "Lounges", color: "#3F51B5" },
              { id: "promo", icon: "gift", label: "Promos", color: "#00BCD4" },
            ].map((item) => {
              const isActive = activeCategory === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveCategory(isActive ? null : item.id);
                  }}
                  style={({ pressed }) => [
                    styles.quickAccessItem,
                    {
                      opacity: pressed ? 0.8 : 1,
                      transform: [{ scale: pressed ? 0.95 : 1 }],
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.quickAccessIcon,
                      {
                        backgroundColor: isActive
                          ? item.color
                          : "rgba(255, 255, 255, 0.05)",
                        borderWidth: 1,
                        borderColor: isActive ? item.color : "rgba(255, 255, 255, 0.1)",
                      },
                    ]}
                  >
                    <Feather
                      name={item.icon as any}
                      size={22}
                      color={isActive ? "#05080f" : item.color}
                    />
                  </View>
                  <ThemedText
                    type="caption"
                    style={[
                      styles.quickAccessLabel,
                      { color: isActive ? item.color : "#94a3b8" },
                      isActive && { fontWeight: "700" },
                    ]}
                  >
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* Search Bar - Convertido en un contenedor tipo Cristal Esmerilado */}
        <BlurView intensity={25} tint="dark" style={[styles.searchContainer, Shadows.sm]}>
          <Feather name="search" size={20} color="#00f2fe" />
          <TextInput
            style={[styles.searchInput, { color: "#FFFFFF" }]}
            placeholder="Buscar bar o promoción..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </BlurView>

        {/* Quick Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {hasActiveFilters ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSearchQuery("");
                setActiveCategory(null);
                setActiveFilter(null);
              }}
              style={({ pressed }) => [
                styles.filterChip,
                {
                  backgroundColor: "rgba(244, 67, 54, 0.15)",
                  borderWidth: 1,
                  borderColor: "#F44336",
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Feather name="x" size={14} color="#F44336" />
              <ThemedText type="small" style={[styles.filterText, { color: "#F44336" }]}>
                Limpiar
              </ThemedText>
            </Pressable>
          ) : null}
          {filters.map((filter) => {
            const isFilterActive = activeFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveFilter(isFilterActive ? null : filter.id);
                }}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isFilterActive ? "#00f2fe" : "rgba(255, 255, 255, 0.05)",
                    borderWidth: 1,
                    borderColor: isFilterActive ? "#00f2fe" : "rgba(255, 255, 255, 0.1)",
                    opacity: pressed ? 0.8 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                  },
                ]}
              >
                <Feather
                  name={filter.icon as any}
                  size={14}
                  color={isFilterActive ? "#05080f" : "#00f2fe"}
                />
                <ThemedText
                  type="small"
                  style={[
                    styles.filterText,
                    { color: isFilterActive ? "#05080f" : "#cbd5e1" },
                  ]}
                >
                  {filter.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {isLoading ? (
          <View style={styles.section}>
            <ThemedText type="h3" style={styles.sectionTitle}>
              Bares populares
            </ThemedText>
            {[1, 2].map((i) => (
              <BusinessCardSkeleton key={i} />
            ))}
          </View>
        ) : hasActiveFilters && filteredBusinesses.length === 0 ? (
          <BlurView intensity={15} tint="dark" style={styles.emptyStateContainer}>
            <View style={styles.emptyStateIcon}>
              <Feather name="search" size={40} color="#64748b" />
            </View>
            <ThemedText type="h3" style={styles.emptyStateTitle}>
              Sin resultados
            </ThemedText>
            <ThemedText type="body" style={[styles.emptyStateText, { color: "#94a3b8" }]}>
              No encontramos negocios con esos filtros.{"\n"}Intenta con otra búsqueda o categoría.
            </ThemedText>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setSearchQuery("");
                setActiveCategory(null);
                setActiveFilter(null);
              }}
              style={[styles.emptyStateClearButton, { backgroundColor: AstroBarColors.primary }]}
            >
              <Feather name="x" size={16} color="#FFFFFF" />
              <ThemedText type="body" style={{ color: "#FFFFFF", fontWeight: "600", marginLeft: Spacing.xs }}>
                Limpiar filtros
              </ThemedText>
            </Pressable>
          </BlurView>
        ) : (
          <>
            {/* Tarjeta Destacada Popular */}
            {!hasActiveFilters && featuredBusinesses.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="h3" style={styles.sectionTitle}>
                  AstroBares populares
                </ThemedText>
                <Pressable
                  onPress={() =>
                    navigation.navigate("BusinessDetail", {
                      businessId: featuredBusinesses[0].id,
                    })
                  }
                  style={({ pressed }) => [
                    styles.featuredCard,
                    {
                      backgroundColor: "rgba(15, 23, 42, 0.45)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.08)",
                      opacity: pressed ? 0.9 : 1,
                    },
                    Shadows.md,
                  ]}
                >
                  <Image
                    source={{ uri: featuredBusinesses[0].bannerImage }}
                    style={styles.featuredImage}
                    contentFit="cover"
                  />
                  <View style={styles.popularBadge}>
                    <ThemedText type="caption" style={styles.popularBadgeText}>
                      POPULAR
                    </ThemedText>
                  </View>
                  <View style={styles.featuredInfo}>
                    <ThemedText type="h4" style={{ color: "#FFFFFF" }}>
                      {featuredBusinesses[0].name}
                    </ThemedText>
                    <View style={styles.featuredMeta}>
                      <View style={styles.metaItem}>
                        <Feather name="map-pin" size={12} color="#94a3b8" />
                        <ThemedText type="small" style={{ color: "#94a3b8", marginLeft: 4 }}>
                          {featuredBusinesses[0].address || 'Buenos Aires'}
                        </ThemedText>
                      </View>
                      <View style={styles.metaItem}>
                        <Feather name="star" size={12} color="#FFB800" />
                        <ThemedText type="small" style={{ marginLeft: 4, color: "#FFFFFF" }}>
                          {featuredBusinesses[0].rating}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </View>
            ) : null}

            {/* Cuadrícula de Bares Populares */}
            <View style={styles.gridSection}>
              {bars.slice(0, 4).map((business) => (
                <View key={business.id} style={styles.gridCard}>
                  <Pressable
                    onPress={() =>
                      navigation.navigate("BusinessDetail", {
                        businessId: business.id,
                      })
                    }
                    style={({ pressed }) => [
                      styles.gridCardInner,
                      {
                        backgroundColor: "rgba(15, 23, 42, 0.45)",
                        borderWidth: 1,
                        borderColor: "rgba(255, 255, 255, 0.08)",
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: business.bannerImage }}
                      style={styles.gridImage}
                      contentFit="cover"
                    />
                    <View style={styles.gridInfo}>
                      <ThemedText type="small" style={[styles.gridName, { color: "#FFFFFF" }]} numberOfLines={1}>
                        {business.name}
                      </ThemedText>
                      <View style={styles.gridMeta}>
                        <View style={styles.ratingSmall}>
                          <ThemedText type="caption" style={{ color: "#FFF" }}>
                            {business.rating}
                          </ThemedText>
                          <Feather name="star" size={10} color="#FFB800" style={{ marginLeft: 2 }} />
                        </View>
                      </View>
                      {getDistanceText(business) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Feather name="map-pin" size={10} color="#94a3b8" />
                          <ThemedText type="caption" style={{ color: "#94a3b8", marginLeft: 2 }}>
                            {getDistanceText(business)}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Mapa de Bares - Botón Principal */}
            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.section}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate("Map");
                }}
                style={({ pressed }) => [
                  styles.mapBanner,
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                  Shadows.md,
                ]}
              >
                <LinearGradient
                  colors={["#4a148c", "#6a1b9a", "#8e24aa"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.marketsGradient}
                >
                  <View style={styles.marketsContent}>
                    <View style={styles.marketsIconContainer}>
                      <Feather name="map" size={32} color="#FFFFFF" />
                    </View>
                    <View style={styles.marketsTextContainer}>
                      <ThemedText type="h3" style={styles.marketsTitle}>
                        Ver Mapa de Bares
                      </ThemedText>
                      <View style={styles.marketsCTA}>
                        <ThemedText type="small" style={styles.marketsSubtitle}>
                          Encuentra bares cercanos con promociones
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.marketsArrow}>
                      <Feather name="chevron-right" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Promociones Flash - Botón Secundario */}
            <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.section}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate("PromotionsList");
                }}
                style={({ pressed }) => [
                  styles.marketsBanner,
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                  Shadows.md,
                ]}
              >
                <LinearGradient
                  colors={["#ff8f00", "#ffb300", "#ffd700"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.marketsGradient}
                >
                  <View style={styles.marketsContent}>
                    <View style={styles.marketsIconContainer}>
                      <Feather name="zap" size={32} color="#FFFFFF" />
                    </View>
                    <View style={styles.marketsTextContainer}>
                      <ThemedText type="h3" style={styles.marketsTitle}>
                        Promociones Flash
                      </ThemedText>
                      <View style={styles.marketsCTA}>
                        <ThemedText type="small" style={styles.marketsSubtitle}>
                          Ofertas por tiempo limitado
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.marketsArrow}>
                      <Feather name="chevron-right" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Promociones Comunes - Botón Terciario */}
            <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.section}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate("CommonPromotions");
                }}
                style={({ pressed }) => [
                  styles.marketsBanner,
                  { transform: [{ scale: pressed ? 0.98 : 1 }] },
                  Shadows.md,
                ]}
              >
                <LinearGradient
                  colors={["#1b5e20", "#2e7d32", "#4caf50"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.marketsGradient}
                >
                  <View style={styles.marketsContent}>
                    <View style={styles.marketsIconContainer}>
                      <Feather name="gift" size={32} color="#FFFFFF" />
                    </View>
                    <View style={styles.marketsTextContainer}>
                      <ThemedText type="h3" style={styles.marketsTitle}>
                        Promociones Comunes
                      </ThemedText>
                      <View style={styles.marketsCTA}>
                        <ThemedText type="small" style={styles.marketsSubtitle}>
                          Ofertas programadas y especiales
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.marketsArrow}>
                      <Feather name="chevron-right" size={24} color="#FFFFFF" />
                    </View>
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>

            {/* Resultados Filtrados */}
            {hasActiveFilters && filteredBusinesses.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText type="h3" style={[styles.sectionTitle, { color: "#FFF" }]}>
                    Resultados ({filteredBusinesses.length})
                  </ThemedText>
                  <Feather name="filter" size={20} color="#00f2fe" />
                </View>
                {filteredBusinesses.map((business) => (
                  <BusinessCard
                    key={business.id}
                    business={business}
                    onPress={() =>
                      navigation.navigate("BusinessDetail", {
                        businessId: business.id,
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  star: { position: "absolute", backgroundColor: "#FFFFFF" },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },
  bannerContainer: { marginBottom: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', height: 200 },
  bannerImage: { width: '100%', height: '100%' },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', padding: Spacing.lg },
  bannerTitle: { color: '#FFFFFF', fontSize: 32, fontWeight: '800' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: Spacing.xs },
  questionContainer: { marginBottom: Spacing.lg },
  questionText: { fontSize: 26, color: "#FFFFFF", fontWeight: "800" },
  quickAccessContainer: { marginBottom: Spacing.md },
  quickAccessScroll: { paddingHorizontal: Spacing.xs, gap: Spacing.md },
  quickAccessItem: { alignItems: "center", width: 70 },
  quickAccessIcon: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center", marginBottom: Spacing.xs },
  quickAccessLabel: { textAlign: "center", fontWeight: "600", fontSize: 12 },
  searchContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(15, 23, 42, 0.45)", overflow: "hidden" },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: 16, paddingVertical: Spacing.xs },
  filtersContainer: { marginBottom: Spacing.lg },
  filtersContent: { paddingRight: Spacing.lg, gap: Spacing.sm, flexDirection: "row" },
  filterChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: Spacing.xs },
  filterText: { fontWeight: "700" },
  section: { marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  sectionTitle: { marginBottom: Spacing.md, color: "#FFFFFF", fontWeight: "800" },
  featuredCard: { borderRadius: BorderRadius.lg, overflow: "hidden" },
  featuredImage: { width: "100%", height: 180 },
  popularBadge: { position: "absolute", top: Spacing.md, right: Spacing.md, backgroundColor: '#00f2fe', paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  popularBadgeText: { color: "#05080f", fontWeight: "800", fontSize: 10 },
  featuredInfo: { padding: Spacing.md },
  featuredMeta: { flexDirection: "row", alignItems: "center", marginTop: Spacing.sm, gap: Spacing.lg },
  metaItem: { flexDirection: "row", alignItems: "center" },
  gridSection: { flexDirection: "row", flexWrap: "wrap", marginBottom: Spacing.xl, marginHorizontal: -Spacing.xs },
  gridCard: { width: "50%", paddingHorizontal: Spacing.xs, marginBottom: Spacing.md },
  gridCardInner: { borderRadius: BorderRadius.lg, overflow: "hidden" },
  gridImage: { width: "100%", height: 100 },
  gridInfo: { padding: Spacing.sm },
  gridName: { fontWeight: "700", marginBottom: Spacing.xs },
  gridMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mapBanner: { borderRadius: BorderRadius.lg, overflow: "hidden" },
  ratingSmall: { flexDirection: "row", alignItems: "center" },
  marketsBanner: { borderRadius: BorderRadius.lg, overflow: "hidden" },
  marketsContent: { flexDirection: "row", alignItems: "center" },
  marketsIconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255, 255, 255, 0.2)", justifyContent: "center", alignItems: "center", marginRight: Spacing.md },
  marketsTextContainer: { flex: 1 },
  marketsTitle: { color: "#FFFFFF", marginBottom: Spacing.xs, fontWeight: "800" },
  marketsSubtitle: { color: "rgba(255, 255, 255, 0.85)", fontWeight: "500" },
  marketsGradient: { borderRadius: BorderRadius.xl, overflow: "hidden", padding: Spacing.lg },
  marketsCTA: { flexDirection: "row", alignItems: "center" },
  marketsArrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255, 255, 255, 0.2)", justifyContent: "center", alignItems: "center" },
  emptyStateContainer: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing["4xl"], paddingHorizontal: Spacing.xl, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  emptyStateIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: Spacing.lg, backgroundColor: "rgba(255,255,255,0.05)" },
  emptyStateTitle: { textAlign: "center", marginBottom: Spacing.sm, color: "#FFF", fontWeight: "800" },
  emptyStateText: { textAlign: "center", lineHeight: 22, marginBottom: Spacing.xl },
  emptyStateClearButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.full },
});



