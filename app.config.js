export default {
  expo: {
    name: "AstroBar",
    slug: "astrobar-v2",
    version: "1.0.0",
    orientation: "portrait",
    /* 🚀 CAMBIO 1: Cambiado a icon.png */
    icon: "./assets/icon.png",
    scheme: "astrobar",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.astrobar.app",
      infoPlist: {
        "NSLocationWhenInUseUsageDescription": "Necesitamos tu ubicación para mostrarte bares cercanos y promociones disponibles."
      }
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#8B5CF6",
        /* 🚀 CAMBIO 2: Cambiado a icon.png */
        foregroundImage: "./assets/icon.png"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.astrobar.app",
      config: {
        googleMaps: {
          apiKey: "AIzaSyDLejpcrNJNHzQIduWuot5QAoepitVk2zY"
        }
      }
    },
    web: {
      output: "single",
      /* 🚀 CAMBIO 3: Cambiado a icon.png */
      favicon: "./assets/icon.png"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          /* 🚀 CAMBIO 4: Cambiado a icon.png para la pantalla de carga */
          "image": "./assets/icon.png",
          "resizeMode": "contain",
          "backgroundColor": "#0c0d14"
        }
      ],
      "expo-web-browser",
      "expo-secure-store",
      "@react-native-community/datetimepicker",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Necesitamos tu ubicación para mostrarte bares cercanos y calcular rutas."
        }
      ]
    ],
    experiments: {
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: "f17c46e5-f38a-4915-b035-c641e2c3aa0d"
      },
      EXPO_PUBLIC_BACKEND_URL: "https://astrobar-app-production-4821.up.railway.app"
    }
  }
};