import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LandingPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [aptSuite, setAptSuite] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsLoading(false);

    // Navigate to verification screen
    router.push("/verification");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.logoContainer, { paddingTop: insets.top + 20 }]}>
        <Image
          source={require("@/assets/images/ftl-logo-header.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <Text style={styles.heading}>Instant Decision</Text>

          <Text style={styles.description}>
            Enter some basic homeowner information below and verify your age
            for an instant decision!
          </Text>

          <Text style={styles.processingText}>
            Requests are processed 24/7!
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Homeowner&apos;s name:</Text>
            <View style={styles.nameRow}>
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="First Name"
                placeholderTextColor="#9CA3AF"
                value={firstName}
                onChangeText={setFirstName}
              />
              <TextInput
                style={[styles.input, styles.nameInput]}
                placeholder="Last Name"
                placeholderTextColor="#9CA3AF"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Installation Address:</Text>
            <TextInput
              style={styles.input}
              placeholder="Address"
              placeholderTextColor="#9CA3AF"
              value={address}
              onChangeText={setAddress}
            />
            <TextInput
              style={styles.input}
              placeholder="Apt, Suite"
              placeholderTextColor="#9CA3AF"
              value={aptSuite}
              onChangeText={setAptSuite}
            />
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, styles.cityInput]}
                placeholder="City"
                placeholderTextColor="#9CA3AF"
                value={city}
                onChangeText={setCity}
              />
              <TextInput
                style={[styles.input, styles.stateInput]}
                placeholder="State"
                placeholderTextColor="#9CA3AF"
                value={state}
                onChangeText={setState}
              />
              <TextInput
                style={[styles.input, styles.zipInput]}
                placeholder="Zip Code"
                placeholderTextColor="#9CA3AF"
                value={zipCode}
                onChangeText={setZipCode}
                keyboardType="numeric"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.continueButton]}
            onPress={handleContinue}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={[styles.continueButtonText]}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  logoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "flex-start",
  },
  logo: {
    width: 120,
    height: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: "#ffffff",
  },
  heading: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
    marginTop: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#6B7280",
    marginBottom: 8,
    textAlign: "center",
  },
  processingText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#007940",
    marginBottom: 24,
    fontWeight: "500",
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: "#000000",
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
  },
  addressRow: {
    flexDirection: "row",
    gap: 12,
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    fontSize: 16,
    color: "#000000",
    marginBottom: 12,
  },
  nameInput: {
    flex: 1,
  },
  cityInput: {
    flex: 2,
  },
  stateInput: {
    flex: 1,
  },
  zipInput: {
    flex: 1.5,
  },
  continueButton: {
    width: "100%",
    backgroundColor: "#007940",
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    minHeight: 56,
  },
  continueButtonDisabled: {
    backgroundColor: "#C8E6C9",
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  continueButtonTextDisabled: {
    color: "#4CAF50",
  },
});
