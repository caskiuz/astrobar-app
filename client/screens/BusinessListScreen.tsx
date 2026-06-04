import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { BusinessCard } from "@/components/BusinessCard";
import { BusinessCardSkeleton } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { Business } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type BusinessListScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const TABS = [
  { id: "all", label: "Todos", icon: "grid" },
  { id: "bar", label: "Bares", icon: "coffee" },
  { id: "nightclub", label: "Discotecas", icon: "music" },
];

const FILTERS = [
  { id: "open", label: "Abiertos", icon: "clock" },
  { id: "flash", label: "Con Flash", icon: "zap" },
  { id: "promo", label: "Con Promos", icon: "percent" },
  { id: "rating", label: "Mejor valorados", icon: "star" },
];

export default function BusinessListScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BusinessListScreenNavigationProp>();
  const { theme } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const loadBusinesses = useCallback(async () => {
    try {
      const response = await apiRequest("GET", "/api/promotions");
      const data = await response.json();
      const rawPromotions = data.promotions || [];
      
      // Map promotions to Business format for display
      const businessList: Business[] = rawPromotions.map((p: any) => ({
        id: p.id,
        name: p.title,
        description: p.description || "",
        type: p.type === 'flash' ? 'flash' : 'bar',
        profileImage: p.image || "https://images.unsplash.com/photo-1514933651103-005eec06c04b",
        bannerImage: p.image || "https://images.unsplash.com/photo-1514933651103-005eec06c04b",
        rating: 4.5,
        reviewCount: 0,
        deliveryTime: p.type === 'flash' ? 'Flash' : 'Común',
        deliveryFee: p.promoPrice / 100,
        minimumOrder: p.originalPrice / 100,
        isOpen: p.isActive ?? false,
        openingHours: [],
        address: p.business?.address || p.businessName || "Buenos Aires",
        phone: "",
        categories: [p.type === 'flash' ? 'Flash' : 'Común'],
        acceptsCash: true,
        featured: p.type === 'flash',
      }));

      setBusinesses(businessList);
    } catch (error) {
      console.error("Error loading businesses:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadBusinesses();
    setIsRefreshing(false);
  };

  const toggleFilter = (filterId: string) => {
    Haptics.selectionAsync();
    setActiveFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((f) => f !== filterId)
        : [...prev, filterId]
    );
  };

  const clearFilters = () => {
    Haptics.selectionAsync();
    setSearchQuery("");
    setActiveFilters([]);
  };

  const filteredBusinesses = useCallback(() => {
    let filtered = [...businesses];

    // Tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter((b) => b.type === activeTab);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.description.toLowerCase().includes(query) ||
          b.categories.some((cat) => cat.toLowerCase().includes(query))
      );
    }

    // Active filters
    if (activeFilters.includes("open")) {
      filtered = filtered.filter((b) => b.isOpen);
    }
    if (activeFilters.includes("flash")) {
      // Filter bars with flash promotions (placeholder logic)
      filtered = filtered.filter((b) => b.featured);
    }
    if (activeFilters.includes("promo")) {
      // Filter bars with active promotions (placeholder logic)
      filtered = filtered.filter((b) => b.featured);
    }
    if (activeFilters.includes("rating")) {
      filtered = filtered.sort((a, b) => b.rating - a.rating);
    }

    return filtered;
  }, [businesses, activeTab, searchQuery, activeFilters]);

  const hasActiveFilters = searchQuery.trim() || activeFilters.length > 0;
  const results = filteredBusinesses();

  return (
    <LinearGradient
      colors={[theme.gradientStart || "#FFFFFF", theme.gradientEnd || "#F5F5F5"]}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <BusinessCard
            business={item}
            onPress={() =>
              navigation.navigate("BusinessDetail", { businessId: item.id })
            }
          />
        )}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Pressable
                onPress={() => navigation.goBack()}
                style={({ pressed }) => [
                  styles.backButton,
                  { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 },
                  Shadows.sm,
                ]}
              >
                <Feather name="arrow-left" size={24} color={theme.text} />
              </Pressable>
              <View style={styles.headerTextContainer}>
                <ThemedText type="h2">Explorar Bares</ThemedText>
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  {results.length} {results.length === 1 ? "bar" : "bares"}
                </ThemedText>
              </View>
            </View>

            {/* Search Bar */}
            <View
              style={[
                styles.searchContainer,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              <Feather name="search" size={20} color={theme.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Buscar bares, bebidas..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={20} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveTab(tab.id);
                  }}
                  style={({ pressed }) => [
                    styles.tab,
                    activeTab === tab.id
                      ? { backgroundColor: AstroBarColors.primary }
                      : { backgroundColor: theme.card },
                    { opacity: pressed ? 0.8 : 1 },
                    Shadows.sm,
                  ]}
                >
                  <Feather
                    name={tab.icon as any}
                    size={18}
                    color={activeTab === tab.id ? "#FFFFFF" : theme.text}
                  />
                  <ThemedText
                    type="small"
                    style={[
                      styles.tabText,
                      { color: activeTab === tab.id ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {tab.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Filters */}
            <View style={styles.filtersContainer}>
              {hasActiveFilters ? (
                <Pressable
                  onPress={clearFilters}
                  style={({ pressed }) => [
                    styles.filterChip,
                    {
                      backgroundColor: theme.card,
                      borderWidth: 1,
                      borderColor: AstroBarColors.error,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Feather name="x" size={14} color={AstroBarColors.error} />
                  <ThemedText
                    type="caption"
                    style={{ color: AstroBarColors.error, marginLeft: 4 }}
                  >
                    Limpiar
                  </ThemedText>
                </Pressable>
              ) : null}
              {FILTERS.map((filter) => (
                <Pressable
                  key={filter.id}
                  onPress={() => toggleFilter(filter.id)}
                  style={({ pressed }) => [
                    styles.filterChip,
                    activeFilters.includes(filter.id)
                      ? { backgroundColor: AstroBarColors.primaryLight, borderWidth: 1, borderColor: AstroBarColors.primary }
                      : { backgroundColor: theme.card },
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather
                    name={filter.icon as any}
                    size={14}
                    color={
                      activeFilters.includes(filter.id)
                        ? AstroBarColors.primary
                        : theme.textSecondary
                    }
                  />
                  <ThemedText
                    type="caption"
                    style={{
                      color: activeFilters.includes(filter.id)
                        ? AstroBarColors.primary
                        : theme.text,
                      marginLeft: 4,
                      fontWeight: activeFilters.includes(filter.id) ? "600" : "400",
                    }}
                  >
                    {filter.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Results Header */}
            {!isLoading && results.length > 0 ? (
              <View style={styles.resultsHeader}>
                <ThemedText type="h4">
                  {activeTab === "all"
                    ? "Todos los bares"
                    : activeTab === "bar"
                    ? "Bares"
                    : "Discotecas"}
                </ThemedText>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <>
              <BusinessCardSkeleton />
              <BusinessCardSkeleton />
              <BusinessCardSkeleton />
            </>
          ) : (
            <View style={styles.emptyState}>
              <View
                style={[
                  styles.emptyIcon,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="search" size={40} color={theme.textSecondary} />
              </View>
              <ThemedText type="h3" style={styles.emptyTitle}>
                Sin resultados
              </ThemedText>
              <ThemedText
                type="body"
                style={[styles.emptyText, { color: theme.textSecondary }]}
              >
                No encontramos bares con esos filtros.{"\n"}Intenta con otra
                busqueda.
              </ThemedText>
              {hasActiveFilters ? (
                <Pressable
                  onPress={clearFilters}
                  style={[
                    styles.emptyButton,
                    { backgroundColor: AstroBarColors.primary },
                  ]}
                >
                  <Feather name="x" size={16} color="#FFFFFF" />
                  <ThemedText
                    type="body"
                    style={{
                      color: "#FFFFFF",
                      fontWeight: "600",
                      marginLeft: Spacing.xs,
                    }}
                  >
                    Limpiar filtros
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          )
        }
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={AstroBarColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  headerTextContainer: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  tabsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  tabText: {
    fontWeight: "600",
  },
  filtersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  resultsHeader: {
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["4xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
});


