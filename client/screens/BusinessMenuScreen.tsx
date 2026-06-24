import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { AstroBarColors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Image } from "expo-image";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description?: string;
  image?: string;
  isAvailable: boolean;
}

export default function BusinessMenuScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "Bebidas",
    price: "",
    description: "",
    image: ""
  });
  const [editProductImage, setEditProductImage] = useState("");
  const [limits, setLimits] = useState<any>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo seleccionar imagen');
    }
  };

  const uploadImage = async (uri: string) => {
    setIsUploadingImage(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        
        const apiResponse = await apiRequest('POST', '/api/upload/product-image', {
          image: base64data,
        });

        const data = await apiResponse.json();
        if (data.success) {
          setNewProduct({...newProduct, image: data.imageUrl});
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo subir imagen');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const categories = ["all", "Bebidas", "Comidas", "Postres", "Cafetería", "Combos", "Otros"];

  const getDefaultImage = (category: string) => {
    const images = {
      "Bebidas": "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=400&fit=crop",
      "Comidas": "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=400&fit=crop", 
      "Postres": "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop",
      "Cafetería": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=400&fit=crop",
      "Combos": "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=400&fit=crop",
      "Otros": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=400&fit=crop"
    };
    return images[category as keyof typeof images] || images["Otros"];
  };

  const loadProducts = async () => {
    try {
      const response = await apiRequest("GET", "/api/business/products");
      const data = await response.json();
      if (data.success) {
        setProducts(data.products || []);
      }
      
      const limitsResponse = await apiRequest("GET", "/api/business/limits");
      const limitsData = await limitsResponse.json();
      if (limitsData.success) {
        setLimits(limitsData.limits);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleDelete = (productId: string) => {
    Alert.alert(
      "Eliminar Producto",
      "¿Estás seguro de eliminar este producto?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await apiRequest("DELETE", `/api/business/products/${productId}`);
              loadProducts();
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          },
        },
      ]
    );
  };

  const toggleAvailability = async (productId: string, currentStatus: boolean) => {
    try {
      await apiRequest("PUT", `/api/business/products/${productId}`, { isAvailable: !currentStatus });
      loadProducts();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const filteredProducts = filter === "all" 
    ? products 
    : products.filter(p => p.category === filter);

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      style={styles.card}
      onPress={() => {
        setEditingProduct(item);
        setNewProduct({
          name: item.name,
          category: item.category,
          price: item.price.toString(),
          description: item.description || "",
          image: item.image || ""
        });
        setEditProductImage(item.image || "");
        setShowEditModal(true);
      }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.productImageContainer}>
          <Image
            source={{ uri: item.image || getDefaultImage(item.category) }}
            style={styles.productImage}
            contentFit="cover"
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.category}>{item.category}</Text>
        </View>
        <Text style={styles.price}>${item.price}</Text>
      </View>

      {item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: item.isAvailable ? "rgba(57, 255, 20, 0.15)" : "rgba(255, 76, 76, 0.12)", borderWidth: 1, borderColor: item.isAvailable ? "#39ff14" : "#ff4c4c" }]}
          onPress={() => toggleAvailability(item.id, item.isAvailable)}
        >
          <Feather name={item.isAvailable ? "check-circle" : "x-circle"} size={14} color={item.isAvailable ? "#39ff14" : "#ff4c4c"} />
          <Text style={[styles.actionText, { color: item.isAvailable ? "#39ff14" : "#ff4c4c" }]}>{item.isAvailable ? "Disponible" : "Pausado"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "rgba(255, 76, 76, 0.12)", borderWidth: 1, borderColor: "rgba(255, 76, 76, 0.3)" }]}
          onPress={() => handleDelete(item.id)}
        >
          <Feather name="trash-2" size={14} color="#ff4c4c" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00f2fe" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 🪐 CONTROL SUPERIOR REFACTORIZADO Y SANADO CON FEATHER PURO */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('BusinessPromotions')}
        >
          <Feather name="volume-2" size={18} color="#94a3b8" />
          <Text style={[styles.navButtonText, { color: '#94a3b8' }]}>Promociones</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.navButton, styles.navButtonActive]} onPress={() => {}}>
          <Feather name="book-open" size={18} color="#00f2fe" />
          <Text style={[styles.navButtonText, { color: '#00f2fe' }]}>Menú</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => navigation.navigate('PromotionTransactions')}
        >
          <Feather name="clock" size={18} color="#94a3b8" />
          <Text style={[styles.navButtonText, { color: '#94a3b8' }]}>Historial</Text>
        </TouchableOpacity>
      </View>

      {/* 📊 BARRA DE LÍMITES PREMIUM */}
      {limits && (
        <View style={styles.limitsContainer}>
          <View style={styles.limitItem}>
            <Text style={styles.limitLabel}>Productos En Carta</Text>
            <Text style={[styles.limitValue, { color: limits.products.percentage >= 90 ? "#ff4c4c" : "#FFF" }]}>
              {limits.products.current} / {limits.products.max}
            </Text>
            <View style={styles.limitBar}>
              <View 
                style={[
                  styles.limitProgress, 
                  { 
                    width: `${Math.min(limits.products.percentage, 100)}%`,
                    backgroundColor: limits.products.percentage >= 90 ? "#ff4c4c" : "#00f2fe"
                  }
                ]} 
              />
            </View>
          </View>
        </View>
      )}

      {/* 🌌 FILTROS HORIZONTALES CYBERPUNK */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = filter === item;
            return (
              <TouchableOpacity
                style={[
                  styles.filterBtn,
                  { backgroundColor: isSelected ? "#00f2fe" : "rgba(15, 23, 42, 0.55)", borderWidth: 1, borderColor: isSelected ? "#00f2fe" : "rgba(255,255,255,0.06)" },
                ]}
                onPress={() => setFilter(item)}
              >
                <Text style={[styles.filterText, { color: isSelected ? "#05080f" : "#cbd5e1" }]}>
                  {item === "all" ? "Todos" : item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00f2fe" />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={40} color="#64748b" />
            <Text style={styles.emptyText}>No hay productos en esta categoría</Text>
          </View>
        }
      />

      {/* FAB CONTAINER */}
      <TouchableOpacity
        style={[
          styles.fab, 
          { 
            backgroundColor: limits?.products.canAdd ? "#00f2fe" : "#334155",
            opacity: limits?.products.canAdd ? 1 : 0.5
          }
        ]}
        onPress={() => {
          if (limits?.products.canAdd) {
            setShowCreateModal(true);
          } else {
            Alert.alert(
              "Límite alcanzado", 
              "Has alcanzado el límite de 80 productos. Elimina algunos productos para agregar nuevos."
            );
          }
        }}
      >
        <Feather name="plus" size={22} color={limits?.products.canAdd ? "#05080f" : "#94a3b8"} />
      </TouchableOpacity>

      {/* 🪐 MODAL NUEVO PRODUCTO CYBERPUNK */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nuevo Insumo</Text>
            
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={handlePickImage}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#00f2fe" />
              ) : newProduct.image ? (
                <Image source={{ uri: newProduct.image }} style={styles.previewImage} contentFit="cover" />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Feather name="camera" size={26} color="#00f2fe" />
                  <Text style={[styles.inputLabel, { color: "#94a3b8", marginTop: Spacing.xs, fontWeight: '600' }]}>
                    Vincular fotografía promocional
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              placeholder="Nombre comercial (ej: Quilmes 1L)"
              placeholderTextColor="#64748b"
              value={newProduct.name}
              onChangeText={(text) => setNewProduct({...newProduct, name: text})}
            />
            
            <View style={[styles.input, { height: 'auto', paddingVertical: Spacing.md }]}>
              <Text style={[styles.inputLabel, { color: '#cbd5e1', fontWeight: '700', marginBottom: Spacing.sm }]}>Categoría asignada:</Text>
              <View style={styles.categoryButtons}>
                {categories.filter(c => c !== "all").map((category) => {
                  const isCatSelected = newProduct.category === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        { 
                          backgroundColor: isCatSelected ? "#00f2fe" : "rgba(5, 8, 15, 0.4)",
                          borderColor: isCatSelected ? "#00f2fe" : "rgba(255,255,255,0.08)"
                        }
                      ]}
                      onPress={() => setNewProduct({...newProduct, category})}
                    >
                      <Text style={[styles.categoryButtonText, { color: isCatSelected ? "#05080f" : "#cbd5e1" }]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Precio Regular de Carta ($)"
              placeholderTextColor="#64748b"
              value={newProduct.price}
              onChangeText={(text) => setNewProduct({...newProduct, price: text})}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.inputMultiline}
              placeholder="Detalle o descripción de los ingredientes..."
              placeholderTextColor="#64748b"
              value={newProduct.description}
              onChangeText={(text) => setNewProduct({...newProduct, description: text})}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewProduct({ name: "", category: "Bebidas", price: "", description: "", image: "" });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={async () => {
                  if (!newProduct.name || !newProduct.price) {
                    Alert.alert("Error", "Nombre y precio son obligatorios");
                    return;
                  }
                  try {
                    const productData = {
                      name: newProduct.name,
                      category: newProduct.category,
                      price: parseInt(newProduct.price),
                      description: newProduct.description,
                      image: newProduct.image || getDefaultImage(newProduct.category),
                      isAvailable: true
                    };
                    const response = await apiRequest("POST", "/api/business/products", productData);
                    const data = await response.json();
                    if (data.success) {
                      setShowCreateModal(false);
                      setNewProduct({ name: "", category: "Bebidas", price: "", description: "", image: "" });
                      loadProducts();
                      Alert.alert("Éxito", "Producto creado correctamente");
                    }
                  } catch (error: any) {
                    Alert.alert("Error", "No se pudo crear el producto");
                  }
                }}
              >
                <Text style={styles.createButtonText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🪐 MODAL EDITAR PRODUCTO CYBERPUNK */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Editar Insumo</Text>
            
            <TouchableOpacity
              style={styles.imagePickerButton}
              onPress={async () => {
                try {
                  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos');
                    return;
                  }
                  const result = await ImagePicker.launchImageLibraryAsync({
                    mediaTypes: ImagePicker.MediaTypeOptions.Images,
                    allowsEditing: true,
                    aspect: [1, 1],
                    quality: 0.5,
                  });
                  if (!result.canceled && result.assets[0]) {
                    setIsUploadingImage(true);
                    const response = await fetch(result.assets[0].uri);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const base64data = reader.result as string;
                      const apiResponse = await apiRequest('POST', '/api/upload/product-image', { image: base64data });
                      const data = await apiResponse.json();
                      if (data.success) {
                        setNewProduct({...newProduct, image: data.imageUrl});
                        setEditProductImage(data.imageUrl);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }
                      setIsUploadingImage(false);
                    };
                    reader.readAsDataURL(blob);
                  }
                } catch (error: any) {
                  Alert.alert('Error', 'No se pudo subir imagen');
                  setIsUploadingImage(false);
                }
              }}
              disabled={isUploadingImage}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#00f2fe" />
              ) : newProduct.image ? (
                <Image source={{ uri: newProduct.image }} style={styles.previewImage} contentFit="cover" />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Feather name="camera" size={26} color="#00f2fe" />
                  <Text style={[styles.inputLabel, { color: "#94a3b8", marginTop: Spacing.xs, fontWeight: '600' }]}>
                    Toca para cambiar foto
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TextInput
              style={styles.input}
              placeholder="Nombre del producto"
              placeholderTextColor="#64748b"
              value={newProduct.name}
              onChangeText={(text) => setNewProduct({...newProduct, name: text})}
            />
            
            <View style={[styles.input, { height: 'auto', paddingVertical: Spacing.md }]}>
              <Text style={[styles.inputLabel, { color: '#cbd5e1', fontWeight: '700', marginBottom: Spacing.sm }]}>Categoría:</Text>
              <View style={styles.categoryButtons}>
                {categories.filter(c => c !== "all").map((category) => {
                  const isCatSelected = newProduct.category === category;
                  return (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        { 
                          backgroundColor: isCatSelected ? "#00f2fe" : "rgba(5, 8, 15, 0.4)",
                          borderColor: isCatSelected ? "#00f2fe" : "rgba(255,255,255,0.08)"
                        }
                      ]}
                      onPress={() => setNewProduct({...newProduct, category})}
                    >
                      <Text style={[styles.categoryButtonText, { color: isCatSelected ? "#05080f" : "#cbd5e1" }]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            
            <TextInput
              style={styles.input}
              placeholder="Precio regular de carta ($)"
              placeholderTextColor="#64748b"
              value={newProduct.price}
              onChangeText={(text) => setNewProduct({...newProduct, price: text})}
              keyboardType="numeric"
            />
            
            <TextInput
              style={styles.inputMultiline}
              placeholder="Descripción (ingredientes, detalles...)"
              placeholderTextColor="#64748b"
              value={newProduct.description}
              onChangeText={(text) => setNewProduct({...newProduct, description: text})}
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setEditProductImage("");
                  setNewProduct({ name: "", category: "Bebidas", price: "", description: "", image: "" });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={async () => {
                  if (!newProduct.name || !newProduct.price || !editingProduct) {
                    Alert.alert("Error", "Nombre y precio son obligatorios");
                    return;
                  }
                  try {
                    const productData = {
                      name: newProduct.name,
                      category: newProduct.category,
                      price: parseInt(newProduct.price),
                      description: newProduct.description,
                      image: newProduct.image || editProductImage || getDefaultImage(newProduct.category),
                      isAvailable: true
                    };
                    const response = await apiRequest("PUT", `/api/business/products/${editingProduct.id}`, productData);
                    const data = await response.json();
                    if (data.success) {
                      setShowEditModal(false);
                      setEditingProduct(null);
                      setEditProductImage("");
                      setNewProduct({ name: "", category: "Bebidas", price: "", description: "", image: "" });
                      loadProducts();
                      Alert.alert("Éxito", "Producto actualizado correctamente");
                    }
                  } catch (error: any) {
                    Alert.alert("Error", "No se pudo actualizar el producto");
                  }
                }}
              >
                <Text style={styles.createButtonText}>Actualizar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05080f' },
  center: { justifyContent: "center", alignItems: "center" },
  topNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(11, 17, 30, 0.4)',
    paddingTop: 44,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  navButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  navButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#00f2fe',
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  filterContainer: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "800",
  },
  list: { padding: Spacing.md, paddingBottom: 90 },
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  name: { fontSize: 16, fontWeight: "900", color: '#FFF' },
  category: { fontSize: 12, marginTop: 2, color: '#94a3b8', fontWeight: '500' },
  price: { fontSize: 18, fontWeight: "900", color: '#00f2fe' },
  description: { fontSize: 13, marginBottom: Spacing.md, color: '#94a3b8', lineHeight: 18 },
  actions: { flexDirection: "row", gap: Spacing.sm },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    gap: 5,
  },
  actionText: { fontSize: 11, fontWeight: "800" },
  empty: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 80 },
  emptyText: { fontSize: 14, marginTop: Spacing.md, color: '#64748b', fontWeight: '600' },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.md,
    shadowColor: "#00f2fe",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 15, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: 20,
    backgroundColor: '#0b111e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modalTitle: { fontSize: 20, fontWeight: "900", marginBottom: 20, textAlign: "center", color: '#FFF' },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    marginBottom: 16,
    fontSize: 15,
    color: '#FFF',
    backgroundColor: "rgba(5, 8, 15, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  inputMultiline: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: 16,
    fontSize: 15,
    color: '#FFF',
    backgroundColor: "rgba(5, 8, 15, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    minHeight: 74,
    textAlignVertical: "top",
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalButton: { flex: 1, height: 44, borderRadius: BorderRadius.full, alignItems: "center", justifyContent: "center" },
  cancelButton: { backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  createButton: { backgroundColor: "#00f2fe" },
  cancelButtonText: { color: "#cbd5e1", fontWeight: "800", fontSize: 14 },
  createButtonText: { color: "#05080f", fontWeight: "900", fontSize: 14 },
  inputLabel: { fontSize: 13, fontWeight: '700' },
  categoryButtons: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  categoryButton: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: BorderRadius.full, borderWidth: 1 },
  categoryButtonText: { fontSize: 11, fontWeight: "800" },
  productImageContainer: { width: 44, height: 44, borderRadius: BorderRadius.sm, backgroundColor: "rgba(255,255,255,0.03)", justifyContent: "center", alignItems: "center", overflow: 'hidden' },
  productImage: { width: 44, height: 44 },
  limitsContainer: { padding: Spacing.md, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(15, 23, 42, 0.2)' },
  limitItem: { alignItems: "center" },
  limitLabel: { fontSize: 11, color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  limitValue: { fontSize: 15, fontWeight: "800", marginBottom: 6 },
  limitBar: { width: "100%", height: 5, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: BorderRadius.full, overflow: "hidden" },
  limitProgress: { height: "100%", borderRadius: BorderRadius.full },
  imagePickerButton: { padding: 16, borderRadius: BorderRadius.md, alignItems: "center", justifyContent: "center", minHeight: 100, marginBottom: 16, backgroundColor: "rgba(5, 8, 15, 0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderStyle: 'dashed' },
  previewImage: { width: "100%", height: 100, borderRadius: BorderRadius.sm },
});