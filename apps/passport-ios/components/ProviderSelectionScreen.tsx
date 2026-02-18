import React from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ScrollView,
    Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// iOS System Colors
const IOS = {
    systemBackground: "#FFFFFF",
    secondarySystemBackground: "#F2F2F7",
    label: "#000000",
    secondaryLabel: "rgba(60, 60, 67, 0.6)",
    tertiaryLabel: "rgba(60, 60, 67, 0.3)",
    blue: "#007AFF",
    separator: "rgba(60, 60, 67, 0.12)",
    systemGray5: "#E5E5EA",
};

interface Provider {
    id: string;
    name: string;
    description: string;
    icon: string;
}

const providers: Provider[] = [
    {
        id: "apple_wallet",
        name: "ID in Wallet",
        description: "Use your driver's license or state ID",
        icon: "wallet",
    },
    {
        id: "government_id",
        name: "Government ID",
        description: "Scan your physical ID document",
        icon: "card",
    },
    {
        id: "financial",
        name: "Bank Verification",
        description: "Verify through your bank account",
        icon: "business",
    },
];

interface ProviderSelectionScreenProps {
    onSelectProvider: (providerId: string) => void;
    onBack: () => void;
}

export default function ProviderSelectionScreen({
    onSelectProvider,
    onBack,
}: ProviderSelectionScreenProps) {
    const insets = useSafeAreaInsets();

    const handleSelectProvider = (providerId: string) => {
        if (providerId === "apple_wallet") {
            onSelectProvider(providerId);
        } else {
            // Show alert for other providers (they're not implemented yet, but we don't say "coming soon")
            Alert.alert(
                "Verification Unavailable",
                "This verification method is not available on your device. Please use ID in Wallet instead.",
                [{ text: "OK", style: "default" }]
            );
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={28} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Paywall Passport</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.shieldIcon}>
                        <Ionicons name="shield-checkmark" size={48} color="#000" />
                    </View>
                    <Text style={styles.heroTitle}>Age Verification</Text>
                    <Text style={styles.heroSubtitle}>
                        Choose how you'd like to verify you're over 21
                    </Text>
                </View>

                {/* Provider List */}
                <View style={styles.providerList}>
                    {providers.map((provider, index) => (
                        <TouchableOpacity
                            key={provider.id}
                            style={[
                                styles.providerCard,
                                index === 0 && styles.providerCardFirst,
                            ]}
                            onPress={() => handleSelectProvider(provider.id)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.providerIcon}>
                                <Ionicons
                                    name={provider.icon as any}
                                    size={24}
                                    color="#000"
                                />
                            </View>
                            <View style={styles.providerInfo}>
                                <Text style={styles.providerName}>{provider.name}</Text>
                                <Text style={styles.providerDescription}>
                                    {provider.description}
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={20}
                                color={IOS.tertiaryLabel}
                            />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Privacy Note */}
                <View style={styles.privacySection}>
                    <Ionicons name="lock-closed" size={16} color={IOS.secondaryLabel} />
                    <Text style={styles.privacyText}>
                        Your personal information is never shared.{"\n"}
                        Only your age verification status is transmitted.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: IOS.secondarySystemBackground,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 8,
        paddingVertical: 12,
        backgroundColor: IOS.secondarySystemBackground,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: "600",
        color: IOS.label,
        letterSpacing: -0.41,
    },
    headerSpacer: {
        width: 44,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: "center",
        paddingTop: 20,
        paddingBottom: 32,
    },
    shieldIcon: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: "rgba(0, 0, 0, 0.08)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 20,
    },
    heroTitle: {
        fontSize: 28,
        fontWeight: "700",
        color: IOS.label,
        marginBottom: 8,
        letterSpacing: 0.36,
    },
    heroSubtitle: {
        fontSize: 15,
        color: IOS.secondaryLabel,
        textAlign: "center",
        letterSpacing: -0.24,
    },
    providerList: {
        backgroundColor: IOS.systemBackground,
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 24,
    },
    providerCard: {
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        backgroundColor: IOS.systemBackground,
        borderTopWidth: 1,
        borderTopColor: IOS.separator,
    },
    providerCardFirst: {
        borderTopWidth: 0,
    },
    providerIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: "rgba(0, 0, 0, 0.06)",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 14,
    },
    providerInfo: {
        flex: 1,
    },
    providerName: {
        fontSize: 17,
        fontWeight: "400",
        color: IOS.label,
        marginBottom: 2,
        letterSpacing: -0.41,
    },
    providerDescription: {
        fontSize: 13,
        color: IOS.secondaryLabel,
        letterSpacing: -0.08,
    },
    privacySection: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
        paddingHorizontal: 4,
    },
    privacyText: {
        flex: 1,
        fontSize: 13,
        color: IOS.secondaryLabel,
        lineHeight: 18,
        letterSpacing: -0.08,
    },
});
