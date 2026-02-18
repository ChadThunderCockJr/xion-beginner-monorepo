import VerificationScreen from "@/components/VerificationScreen";
import { Images } from "@/constants/images";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const { sessionId, apiUrl } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const session = Array.isArray(sessionId) ? sessionId[0] : sessionId;
  const api = Array.isArray(apiUrl) ? apiUrl[0] : apiUrl;

  // If we have session params (from deep link), show the verification screen
  if (session && api) {
    return (
      <View style={styles.container}>
        <VerificationScreen sessionId={session} apiUrl={api} />
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    try {
      // Parse the URL to extract sessionId and apiUrl
      const url = new URL(data);
      const parsedSessionId = url.searchParams.get("sessionId");
      const parsedApiUrl = url.searchParams.get("apiUrl");

      if (parsedSessionId && parsedApiUrl) {
        // Navigate with the parsed params
        router.push({
          pathname: "/",
          params: { sessionId: parsedSessionId, apiUrl: parsedApiUrl },
        });
      } else {
        Alert.alert("Invalid QR Code", "This QR code doesn't contain valid session data.");
        setScanned(false);
      }
    } catch (error) {
      Alert.alert("Invalid QR Code", "Could not parse the QR code. Please try again.");
      setScanned(false);
    }
  };

  // Camera permission not yet determined
  if (!permission) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  // Camera permission denied
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.welcomeContainer, { paddingTop: insets.top + 40 }]}>
        <Image
          source={Images.passportLogo}
          style={styles.logo}
        />
        <Text style={styles.title}>Paywall Passport</Text>
        <Text style={styles.subtitle}>
          Camera access is needed to scan QR codes for verification.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Ionicons name="camera" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.permissionButtonText}>Enable Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main screen with embedded camera
  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={[styles.headerSection, { paddingTop: insets.top + 20 }]}>
        <Image
          source={Images.passportLogo}
          style={styles.headerLogo}
        />
        <Text style={styles.title}>Paywall Passport</Text>
        <Text style={styles.subtitle}>
          Please scan the QR code to begin verification
        </Text>
      </View>

      {/* Camera Section */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ["qr"],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          {/* Scan overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <Text style={styles.scanHint}>Point at QR code</Text>
          </View>
        </CameraView>
      </View>

      {/* Reset button if scanned */}
      {scanned && (
        <View style={[styles.resetContainer, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.resetButton} onPress={() => setScanned(false)}>
            <Text style={styles.resetButtonText}>Tap to Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeContainer: {
    alignItems: "center",
    paddingHorizontal: 30,
    backgroundColor: "#fff",
  },
  headerSection: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  headerLogo: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginBottom: 12,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 20,
    borderRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
    color: "#111",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 24,
    backgroundColor: "#000",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  cameraContainer: {
    flex: 1,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#fff",
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    marginTop: 24,
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  resetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingTop: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  resetButton: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  resetButtonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "600",
  },
});
