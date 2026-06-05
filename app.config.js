export default {
  expo: {
    name: "AstroBar",
    slug: "astrobar-v2",
    version: "1.0.0",
    orientation: "portrait",
    /* 🪐 LOGO PRINCIPAL DE LA APP */
    icon: "./assets/astrobarlogo.jpg",
    scheme: "astrobar",
    userInterfaceStyle: "dark", // Forzamos modo oscuro nativo desde el arranque
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
        /* 🌌 CORRECCIÓN 1: Eliminamos el violeta #8B5CF6 y ponemos el color espacial oscuro */
        backgroundColor: "#05080f",
        /* 🪐 CORRECCIÓN 2: El ícono del teléfono pasa a ser el logo oficial del bar */
        foregroundImage: "./assets/astrobarlogo.jpg"
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
      favicon: "./assets/astrobarlogo.jpg"
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          /* 🪐 CORRECCIÓN 3: Reemplazamos icon.png por el logo oficial en el Splash nativo */
          "image": "./assets/astrobarlogo.jpg",
          "resizeMode": "contain",
          /* 🌌 CORRECCIÓN 4: Fondo unificado con el color exacto con el que arranca nuestra animación */
          "backgroundColor": "#05080f"
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
        /* 🪐 INYECTAMOS EL NUEVO ID DE TU CUENTA NUEVA */
        projectId: "c2677a12-3825-42c7-a798-5d90bcc4af6b"
      },
      EXPO_PUBLIC_BACKEND_URL: "https://astrobar-app-production-4821.up.railway.app"
    }
  }
};