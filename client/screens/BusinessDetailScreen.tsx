import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/Badge";
import { CartButton } from "@/components/CartButton";
import { ProductCardSkeleton } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { Business, Product } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type BusinessDetailRouteProp = RouteProp<RootStackParamList, "BusinessDetail">;
type BusinessDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "BusinessDetail"
>;

export default function BusinessDetailScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<BusinessDetailRouteProp>();
  const navigation = useNavigation<BusinessDetailNavigationProp>();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { businessId } = route.params;
  const [isLoading, setIsLoading] = useState(true);
  const [business, setBusiness] = useState<Business | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [futurePromotions, setFuturePromotions] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { apiRequest } = await import('@/lib/query-client');
        const response = await apiRequest('GET', `/api/businesses/${businessId}`);
        const data = await response.json();
        
        if (data.success && data.business) {
          // Adapt backend data to frontend format
          const adaptedBusiness: Business = {
            id: data.business.id,
            name: data.business.name,
            description: data.business.description || '',
            type: data.business.type || 'restaurant',
            profileImage: data.business.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
            bannerImage: data.business.coverImage || data.business.image || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
            rating: (data.business.rating || 0) / 100,
            reviewCount: data.business.totalRatings || 0,
            deliveryTime: data.business.deliveryTime || '30-45 min',
            deliveryFee: (data.business.deliveryFee || 2500) / 100,
            minimumOrder: (data.business.minOrder || 5000) / 100,
            isOpen: data.business.isOpen || false,
            openingHours: [],
            // ✅ CORRECCIÓN 1: Saneamos el string ortográfico roto por defecto
            address: data.business.address || 'Buenos Aires, Argentina',
            phone: data.business.phone || '',
            categories: data.business.categories ? data.business.categories.split(',') : [],
            acceptsCash: true,
            featured: data.business.isFeatured || false,
          };
          
          const adaptedProducts: Product[] = (data.business.products || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: (p.price || 0) / 100,
            image: p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400',
            category: p.category || 'General',
            isAvailable: p.isAvailable === true || p.isAvailable === 1,
            available: p.isAvailable === true || p.isAvailable === 1,
            businessId: p.businessId,
          }));
          
          setBusiness(adaptedBusiness);
          setProducts(adaptedProducts);
        } else {
          setBusiness(null);
          setProducts([]);
        }

        // Load promotions
        try {
          const promosResponse = await apiRequest('GET', `/api/promotions?businessId=${businessId}`);
          const promosData = await promosResponse.json();
          if (promosData.success) {
            setPromotions(promosData.promotions || []);
          }
        } catch (error) {
          console.error('Error loading promotions:', error);
          setPromotions([]);
        }

        // Load future promotions
        try {
          const futurePromosResponse = await apiRequest('GET', `/api/business/${businessId}/future-promotions`);
          const futurePromosData = await futurePromosResponse.json();
          if (futurePromosData.success) {
            setFuturePromotions(futurePromosData.promotions || []);
          }
        } catch (error) {
          console.error('Error loading future promotions:', error);
          setFuturePromotions([]);
        }
      } catch (error) {
        console.error('Error loading business:', error);
        setBusiness(null);
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [businessId]);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category))];
    return cats;
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return products;
    return products.filter((p) => p.category === selectedCategory);
  }, [products, selectedCategory]);

  const handleCall = () => {
    if (business?.phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(`tel:${business.phone}`);
    }
  };

  const handleWhatsApp = () => {
    if (business?.phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const phone = business.phone.replace(/\D/g, "");
      Linking.openURL(`https://wa.me/${phone}`);
    }
  };

  if (!business && !isLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.notFound}>
          <ThemedText type="h2">Negocio no encontrado</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bannerContainer}>
          {business ? (
            <Image
              source={{ uri: business.bannerImage }}
              style={styles.banner}
              contentFit="cover"
            />
          ) : (
            <View
              style={[styles.banner, { backgroundColor: theme.skeleton }]}
            />
          )}
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: theme.card }]}
          >
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
        </View>

        {business ? (
          <>
            <View style={styles.profileSection}>
              <View style={styles.profileImageContainer}>
                <Image
                  source={{ uri: business.profileImage }}
                  style={styles.profileImage}
                  contentFit="cover"
                />
              </View>
              <View style={styles.businessInfo}>
                <ThemedText type="h2">{business.name}</ThemedText>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={16} color={AstroBarColors.warning} />
                  <ThemedText type="body" style={styles.rating}>
                    {business.rating}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    ({business.reviewCount} reseñas)
                  </ThemedText>
                </View>
                <View style={styles.badgeRow}>
                  <Badge
                    text={business.isOpen ? "Abierto" : "Cerrado"}
                    variant={business.isOpen ? "success" : "error"}
                  />
                  <Badge
                    text={
                      business.type === "market" ? "Mercado" : "Restaurante"
                    }
                    variant="secondary"
                  />
                </View>
              </View>
            </View>

            <View
              style={[
                styles.infoCard,
                { backgroundColor: theme.card },
                Shadows.sm,
              ]}
            >
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                {business.description}
              </ThemedText>
              <View style={styles.infoRow}>
                <Feather name="clock" size={16} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}
                >
                  {business.deliveryTime}
                </ThemedText>
                <View style={styles.dividerDot} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Envio ${business.deliveryFee}
                </ThemedText>
                <View style={styles.dividerDot} />
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  Min. ${business.minimumOrder}
                </ThemedText>
              </View>
              <View style={styles.contactRow}>
                <Pressable
                  onPress={handleCall}
                  style={[
                    styles.contactButton,
                    { backgroundColor: theme.backgroundSecondary },
                  ]}
                >
                  <Feather name="phone" size={18} color={AstroBarColors.primary} />
                  <ThemedText
                    type="small"
                    style={{
                      color: AstroBarColors.primary,
                      marginLeft: Spacing.xs,
                    }}
                  >
                    Llamar
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleWhatsApp}
                  style={[styles.contactButton, { backgroundColor: "#25D366" }]}
                >
                  <Feather name="message-circle" size={18} color="#FFFFFF" />
                  <ThemedText
                    type="small"
                    style={{ color: "#FFFFFF", marginLeft: Spacing.xs }}
                  >
                    WhatsApp
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsContainer}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate('ActivePromotions' as any, { businessId: business.id });
                }}
                style={[
                  styles.menuButton,
                  { backgroundColor: '#FFD700' },
                  Shadows.md,
                ]}
              >
                <Feather name="zap" size={20} color="#000000" />
                <ThemedText style={[styles.menuButtonText, { color: '#000000' }]}>
                  Ver Promociones
                </ThemedText>
                <Feather name="chevron-right" size={20} color="#000000" />
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate('BarMenu' as any, { businessId: business.id });
                }}
                style={[
                  styles.menuButton,
                  { backgroundColor: AstroBarColors.primary },
                  Shadows.md,
                ]}
              >
                <Feather name="book-open" size={20} color="#FFFFFF" />
                <ThemedText style={styles.menuButtonText}>
                  Ver Menú Completo
                </ThemedText>
                <Feather name="chevron-right" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
      <CartButton onPress={() => navigation.navigate("OrderCart")} />
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing["6xl"] + Spacing["3xl"],
  },
  notFound: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bannerContainer: {
    position: "relative",
  },
  banner: {
    width: "100%",
    height: 200,
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  profileSection: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginTop: -40,
    marginBottom: Spacing.lg,
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    overflow: "hidden",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  businessInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    marginTop: Spacing["3xl"],
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    gap: 4,
  },
  rating: {
    fontWeight: "600",
    marginRight: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  infoCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    flexWrap: "wrap",
  },
  dividerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#9E9E9E",
    marginHorizontal: Spacing.sm,
  },
  contactRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  contactButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  categoriesScroll: {
    marginBottom: Spacing.lg,
  },
  categoriesContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  productsSection: {
    paddingHorizontal: Spacing.lg,
  },
  productsSectionTitle: {
    marginBottom: Spacing.md,
  },
  // ✅ CORRECCIÓN 2: Reestructuración simétrica y balanceada para botones de alta gama
  menuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    height: 56, // Forzamos altura estricta para el centrado vertical nativo
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
  },
  menuButtonText: {
    fontWeight: '800', // Un toque más de peso visual a la tipografía
    fontSize: 15,
    flex: 1,
    textAlign: 'center',
    includeFontPadding: false, // Remueve el padding fantasma superior de Android 🚀
    textAlignVertical: 'center',
  },
  actionButtonsContainer: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  promotionsSection: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  promotionsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  promoCard: {
    width: 200,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    position: 'relative',
  },
  promoCardFlash: {
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  flashBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  flashBadgeText: {
    color: '#000000',
    fontWeight: '800',
    fontSize: 10,
  },
  discountBadge: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  discountText: {
    color: AstroBarColors.primary,
    fontSize: 32,
    fontWeight: '800',
  },
  discountLabel: {
    color: AstroBarColors.primary,
    fontWeight: '700',
  },
  promoTitle: {
    fontWeight: '600',
    marginBottom: Spacing.sm,
    minHeight: 40,
  },
  promoPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  originalPrice: {
    textDecorationLine: 'line-through',
    color: '#999999',
  },
  promoPrice: {
    color: '#4CAF50',
    fontWeight: '800',
  },
  promoStock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  promoButton: {
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  promoButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  futureBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AstroBarColors.primary,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  futureBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 9,
  },
  futureDate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});