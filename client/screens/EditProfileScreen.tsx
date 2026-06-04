import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { Spacing, BorderRadius, AstroBarColors, Shadows } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { resolveProfileImageUrl } from "@/lib/imageUtils";

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [email, setEmail] = useState(user?.email || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; email?: string }>({});

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Editar perfil",
    });
  }, [navigation]);

  const validateForm = () => {
    const newErrors: { name?: string; phone?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = "El nombre es requerido";
    } else if (name.trim().length < 2) {
      newErrors.name = "El nombre debe tener al menos 2 caracteres";
    }

    if (!phone.trim()) {
      newErrors.phone = "El telefono es requerido";
    } else if (phone.trim().length < 10) {
      newErrors.phone = "Ingresa un numero de telefono valido";
    }

    if (email.trim() && !email.includes("@")) {
      newErrors.email = "Ingresa un correo valido";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm() || !user?.id) return;

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const response = await apiRequest("PUT", `/api/users/${user.id}`, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
      });

      const data = await response.json();

      if (data.user) {
        await updateUser({
          name: data.user.name,
          phone: data.user.phone,
          email: data.user.email,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Perfil actualizado correctamente", "success");
        navigation.goBack();
      } else {
        throw new Error(data.error || "Error al actualizar perfil");
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(error.message || "No se pudo actualizar el perfil", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('Se necesita permiso para acceder a las fotos', 'error');
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
      showToast('Error al seleccionar imagen', 'error');
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
        
        const apiResponse = await apiRequest('POST', '/api/user/profile-image', {
          image: base64data,
        });

        const data = await apiResponse.json();
        if (data.success) {
          await updateUser({ profileImage: data.profileImage });
          showToast('Foto actualizada', 'success');
          // Force re-render
          navigation.goBack();
        }
      };
      
      reader.readAsDataURL(blob);
    } catch (error: any) {
      showToast('Error al subir imagen', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.avatarSection,
            { backgroundColor: theme.card },
            Shadows.md,
          ]}
        >
          <Pressable onPress={handlePickImage} disabled={isUploadingImage}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: AstroBarColors.primary + "20" },
              ]}
            >
              {isUploadingImage ? (
                <ActivityIndicator size="large" color={AstroBarColors.primary} />
              ) : user?.profileImage ? (
                <Image
                  source={{ uri: resolveProfileImageUrl(user.profileImage) }}
                  style={styles.avatarImage}
                  contentFit="cover"
                />
              ) : (
                <Feather name="user" size={40} color={AstroBarColors.primary} />
              )}
            </View>
            <View style={[styles.cameraButton, { backgroundColor: AstroBarColors.primary }]}>
              <Feather name="camera" size={16} color="#fff" />
            </View>
          </Pressable>
          <ThemedText
            type="caption"
            style={{ color: theme.textSecondary, marginTop: Spacing.sm }}
          >
            Toca para cambiar foto
          </ThemedText>
        </View>

        <View
          style={[
            styles.formSection,
            { backgroundColor: theme.card },
            Shadows.sm,
          ]}
        >
          <Input
            label="Nombre completo"
            leftIcon="user"
            value={name}
            onChangeText={setName}
            error={errors.name}
            placeholder="Tu nombre"
            autoCapitalize="words"
            autoCorrect={false}
          />

          <Input
            label="Telefono"
            leftIcon="phone"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            placeholder="+54 xxx xxx xxxx"
            keyboardType="phone-pad"
            autoCorrect={false}
          />

          <Input
            label="Correo electronico (opcional)"
            leftIcon="mail"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="tucorreo@ejemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View
          style={[
            styles.infoBox,
            { backgroundColor: theme.backgroundSecondary },
          ]}
        >
          <Feather name="info" size={20} color={AstroBarColors.primary} />
          <ThemedText
            type="caption"
            style={{
              flex: 1,
              color: theme.textSecondary,
              marginLeft: Spacing.sm,
            }}
          >
            El telefono es tu identificador principal. El correo es opcional
            para recibir recibos y notificaciones.
          </ThemedText>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + Spacing.lg,
            backgroundColor: theme.backgroundDefault,
          },
        ]}
      >
        <Button
          onPress={handleSave}
          disabled={isSaving}
          loading={isSaving}
          style={styles.saveButton}
        >
          Guardar cambios
        </Button>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  avatarSection: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  formSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  emailContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  saveButton: {
    width: "100%",
  },
});
