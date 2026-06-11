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
import { LinearGradient } from "expo-linear-gradient"; // 🪐 Gradientes estelares para los botones

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
        const response = await apiRequest('GET', `/api/businesses/${businessId}`);
        const data = await response.json();
        
        if (data.success && data.business) {
          // Sanitizamos la descripción directo desde la carga para corregir la ortografía rota del backend
          let rawDesc = data.business.description || '';
          if (rawDesc.toLowerCase().includes('amburgueza')) {
            rawDesc = rawDesc.replace(/amburgueza/i, 'Hamburguesas y Combos Premium');
          }

          const adaptedBusiness: Business = {
            id: data.business.id,
            name: data.business.name,
            description: rawDesc,
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
    return [...new Set(products.map((p) => p.category))];
  }, [products]);

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
    <View style={[styles.container, { backgroundColor: '#05080f' }]}>
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
            <View style={[styles.banner, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
          )}
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Feather name="arrow-left" size={22} color="#00f2fe" />
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
                <ThemedText type="h2" style={styles.businessNameText}>{business.name}</ThemedText>
                <View style={styles.ratingRow}>
                  <Feather name="star" size={14} color="#ffd700" />
                  <ThemedText type="body" style={styles.rating}>
                    {business.rating}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: '#64748b', fontWeight: '600' }}>
                    ({business.reviewCount} reseñas)
                  </ThemedText>
                </View>
                <View style={styles.badgeRow}>
                  <Badge
                    text={business.isOpen ? "Abierto" : "Cerrado"}
                    variant={business.isOpen ? "success" : "error"}
                  />
                  <Badge
                    text={business.type === "market" ? "⚡ Mercado" : "🪐 Bar & Resto"}
                    variant="secondary"
                  />
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <ThemedText type="body" style={styles.descriptionText}>
                {business.description}
              </ThemedText>
              <View style={styles.infoRow}>
                <Feather name="clock" size={14} color="#64748b" />
                <ThemedText type="small" style={styles.infoCardMetaText}>
                  {business.deliveryTime}
                </ThemedText>
                <View style={styles.dividerDot} />
                <ThemedText type="small" style={styles.infoCardMetaText}>
                  Envío ${business.deliveryFee}
                </ThemedText>
                <View style={styles.dividerDot} />
                <ThemedText type="small" style={styles.infoCardMetaText}>
                  Mín. ${business.minimumOrder}
                </ThemedText>
              </View>
              
              <View style={styles.contactRow}>
                <Pressable onPress={handleCall} style={styles.contactButtonCall}>
                  <Feather name="phone" size={16} color="#00f2fe" />
                  <ThemedText type="small" style={styles.contactButtonCallText}>Llamar</ThemedText>
                </Pressable>
                
                <Pressable onPress={handleWhatsApp} style={styles.contactButtonWA}>
                  <Feather name="message-circle" size={16} color="#FFF" />
                  <ThemedText type="small" style={styles.contactButtonWAText}>WhatsApp</ThemedText>
                </Pressable>
              </View>
            </View>

            {/* 🌌 CONTENEDOR DE BOTONES CON DISEÑO PREMIUM NEÓN MULTICAPA */}
            <View style={styles.actionButtonsContainer}>
              
              {/* ⚡ BOTÓN RADIANTE: VER PROMOCIONES (AMARILLO ELÉCTRICO) */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate('ActivePromotions' as any, { businessId: business.id });
                }}
                style={({ pressed }) => [styles.buttonWrapper, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={['rgba(255, 215, 0, 0.25)', 'rgba(255, 140, 0, 0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.menuButtonCyber, { borderColor: 'rgba(255, 215, 0, 0.5)' }]}
                >
                  <Feather name="zap" size={18} color="#FFD700" style={styles.buttonIconLeft} />
                  <ThemedText style={[styles.menuButtonTextCyber, { color: '#FFD700' }]}>
                    Ver Promociones
                  </ThemedText>
                  <Feather name="chevron-right" size={18} color="#FFD700" />
                </LinearGradient>
              </Pressable>

              {/* 🪐 BOTÓN ULTRA: VER MENÚ COMPLETO (CIAN / PÚRPURA DEEP SPACE) */}
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  navigation.navigate('BarMenu' as any, { businessId: business.id });
                }}
                style={({ pressed }) => [styles.buttonWrapper, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={['rgba(0, 242, 254, 0.2)', 'rgba(168, 85, 247, 0.08)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.menuButtonCyber, { borderColor: 'rgba(0, 242, 254, 0.45)' }]}
                >
                  <Feather name="book-open" size={18} color="#00f2fe" style={styles.buttonIconLeft} />
                  <ThemedText style={[styles.menuButtonTextCyber, { color: '#00f2fe' }]}>
                    Ver Menú Completo
                  </ThemedText>
                  <Feather name="chevron-right" size={18} color="#00f2fe" />
                </LinearGradient>
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
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: Spacing["6xl"] + Spacing["3xl"] },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  bannerContainer: { position: "relative" },
  banner: { width: "100%", height: 200 },
  backButton: {
    position: "absolute",
    top: 50,
    left: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(5, 8, 15, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)'
  },
  profileSection: { flexDirection: "row", paddingHorizontal: Spacing.lg, marginTop: -40, marginBottom: Spacing.md },
  profileImageContainer: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2.5,
    borderColor: "#00f2fe",
    overflow: "hidden",
    backgroundColor: '#05080f',
    ...Shadows.md,
    shadowColor: '#00f2fe'
  },
  profileImage: { width: "100%", height: "100%" },
  businessInfo: { flex: 1, marginLeft: Spacing.md, marginTop: Spacing["4xl"] },
  businessNameText: { color: '#FFF', fontWeight: '900', textShadowColor: 'rgba(0, 242, 254, 0.25)', textShadowRadius: 6 },
  ratingRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  rating: { fontWeight: "800", marginRight: 4, color: '#FFF', fontSize: 14 },
  badgeRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  
  infoCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  descriptionText: { color: '#cbd5e1', fontWeight: '500', lineHeight: 19 },
  infoRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.md, flexWrap: "wrap" },
  infoCardMetaText: { color: '#94a3b8', marginLeft: Spacing.sm, fontWeight: '600' },
  dividerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0, 242, 254, 0.4)', marginHorizontal: Spacing.sm },
  
  contactRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  contactButtonCall: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.25)'
  },
  contactButtonCallText: { color: "#00f2fe", marginLeft: Spacing.xs, fontWeight: '700' },
  contactButtonWA: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 42,
    borderRadius: BorderRadius.md,
    backgroundColor: "#128C7E",
    borderWidth: 1,
    borderColor: '#25D366'
  },
  contactButtonWAText: { color: "#FFFFFF", marginLeft: Spacing.xs, fontWeight: '700' },

  // 🪐 REDISEÑO ESTRUCTURAL: ALINEACIÓN MILIMÉTRICA Y REFLEJO NEÓN PREMIUM
  actionButtonsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  buttonWrapper: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.md,
  },
  menuButtonCyber: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 58,                  // Altura estricta para fijar centro exacto
    borderWidth: 1.5,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    backgroundColor: 'rgba(11, 17, 30, 0.6)',
  },
  buttonIconLeft: {
    marginRight: 2,
  },
  menuButtonTextCyber: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    fontWeight: '900',           // Tipografía pesada cyberpunk de impacto
    fontSize: 15,
    letterSpacing: 0.6,
    flex: 1,
    textAlign: 'center',
    includeFontPadding: false,   // Clave fundamental: limpia el desvío vertical en Android 🚀
    textAlignVertical: 'center', // Amarra el texto al centro exacto del eje Y
  },
});