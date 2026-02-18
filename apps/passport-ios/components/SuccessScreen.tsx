import { useRouter } from "expo-router";
import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { Images } from "@/constants/images";

// App color palette (original colors)
const COLORS = {
  primary: "#000000",
  background: "#F9FAFB",
  surface: "#FFFFFF",
  text: "#111111",
  textSecondary: "#6B7280",
  textTertiary: "#9CA3AF",
  border: "#E5E7EB",
  success: "#059669",
  successLight: "#ECFDF5",
};

export default function SuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleClose = () => {
    router.push("/");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerContent}>
          <Image
            source={Images.passportLogo}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Paywall Passport</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Success Animation Container */}
        <View style={styles.successContainer}>
          {/* Celebration Ring */}
          <View style={styles.celebrationRing}>
            <View style={styles.successIconCircle}>
              <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M20 6L9 17L4 12"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </View>
        </View>

        {/* Success Text */}
        <Text style={styles.successTitle}>You're Verified!</Text>
        <Text style={styles.successSubtitle}>
          Your TV is now set for reduced ads.
        </Text>
        <Text style={styles.successSubtitle}>
          You can close this page.
        </Text>

        {/* Verified Badge */}
        <View style={styles.badge}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={styles.badgeText}>21+ Verified</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.8}
        >
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  successContainer: {
    marginBottom: 32,
  },
  celebrationRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.successLight,
    alignItems: "center",
    justifyContent: "center",
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 17,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 24,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.successLight,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 50,
    marginTop: 32,
    gap: 8,
  },
  badgeText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.success,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  closeButton: {
    backgroundColor: COLORS.text,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
});
