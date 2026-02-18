import React, { useState, useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Images } from "@/constants/images";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// iOS System Colors
const IOS = {
    systemBackground: "#FFFFFF",
    label: "#000000",
    secondaryLabel: "rgba(60, 60, 67, 0.6)",
    blue: "#007AFF",
    green: "#34C759",
    separator: "rgba(60, 60, 67, 0.12)",
    systemGray5: "#E5E5EA",
};

type FlowStep = "sheet" | "confirming" | "complete";

interface AppleWalletMockFlowProps {
    sessionId?: string;
    apiUrl?: string;
    onComplete: () => void;
    onCancel: () => void;
}

export default function AppleWalletMockFlow({
    sessionId,
    apiUrl,
    onComplete,
    onCancel,
}: AppleWalletMockFlowProps) {
    const insets = useSafeAreaInsets();
    const [step, setStep] = useState<FlowStep>("sheet");
    const [isLoading, setIsLoading] = useState(false);
    const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (step === "sheet") {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    tension: 65,
                    friction: 11,
                    useNativeDriver: true,
                }),
            ]).start();
        }
    }, [step]);

    const handleConfirm = async () => {
        setIsLoading(true);

        // Report verification to backend
        if (sessionId && apiUrl) {
            try {
                const proofData = {
                    provider: "apple_wallet",
                    timestamp: Date.now(),
                    proofType: "wallet_verification",
                    isVerified21Plus: true,
                };

                const url = `${apiUrl}/api/session-verify`;
                console.log("Reporting verification to:", url);

                const response = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sessionId, proofData }),
                });

                if (response.ok) {
                    console.log("Verification reported successfully");
                } else {
                    console.error("Verification report failed:", await response.text());
                }
            } catch (err) {
                console.error("Error reporting to backend:", err);
            }
        }

        // Wait a couple seconds then complete
        setTimeout(() => {
            setStep("complete");
            onComplete();
        }, 2000);
    };

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: SCREEN_HEIGHT,
                duration: 250,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onCancel();
        });
    };

    // License Card Component
    const LicenseCard = () => (
        <View style={styles.licenseCard}>
            <View style={styles.licenseCardInner}>
                <View style={styles.licenseGradient}>
                    <View style={styles.licenseHeader}>
                        <Text style={styles.licenseState}>DRIVER LICENSE</Text>
                    </View>
                    <View style={styles.licenseBody}>
                        <View style={styles.licensePhoto}>
                            <Ionicons name="person" size={24} color="#666" />
                        </View>
                        <View style={styles.licenseInfo}>
                            <View style={styles.licenseLine} />
                            <View style={[styles.licenseLine, { width: 50 }]} />
                            <View style={[styles.licenseLine, { width: 70 }]} />
                        </View>
                    </View>
                </View>
            </View>
            <Text style={styles.licenseSubtitle}>Government-Issued ID</Text>
        </View>
    );

    // Wallet Sheet UI
    if (step === "sheet") {
        return (
            <View style={styles.container}>
                <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]} />

                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            transform: [{ translateY: slideAnim }],
                            paddingBottom: insets.bottom + 20,
                        },
                    ]}
                >
                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <View style={styles.walletBadge}>
                            <Ionicons name="wallet" size={16} color="#000" />
                            <Text style={styles.walletText}>Wallet</Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <View style={styles.closeButtonInner}>
                                <Ionicons name="close" size={16} color={IOS.secondaryLabel} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* App Info - using Paywall Passport icon */}
                    <View style={styles.appInfo}>
                        <Image source={Images.passportLogo} style={styles.appIconImage} />
                        <View>
                            <Text style={styles.appName}>Paywall Passport</Text>
                            <Text style={styles.appDomain}>paywallpassport.com</Text>
                        </View>
                    </View>

                    {/* License Card */}
                    <LicenseCard />

                    {/* What will be shared */}
                    <View style={styles.shareSection}>
                        <Text style={styles.shareTitle}>
                            The following information will be shared:
                        </Text>
                        <Text style={styles.shareSubtitle}>
                            Paywall Passport will not store this information.
                        </Text>

                        <View style={styles.dataGrid}>
                            <View style={styles.dataItem}>
                                <Ionicons name="checkmark-circle-outline" size={16} color={IOS.secondaryLabel} />
                                <Text style={styles.dataItemText}>Age Over 21</Text>
                            </View>
                        </View>
                    </View>

                    {/* Confirm Button */}
                    <TouchableOpacity
                        style={[styles.confirmButton, isLoading && styles.confirmButtonDisabled]}
                        onPress={handleConfirm}
                        activeOpacity={0.7}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        )}
                    </TouchableOpacity>
                </Animated.View>
            </View>
        );
    }

    return null;
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "flex-end",
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    sheet: {
        backgroundColor: IOS.systemBackground,
        borderTopLeftRadius: 14,
        borderTopRightRadius: 14,
        paddingTop: 16,
        paddingHorizontal: 20,
    },
    sheetHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 20,
    },
    walletBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    walletText: {
        fontSize: 17,
        fontWeight: "600",
        color: IOS.label,
    },
    closeButton: {
        padding: 4,
    },
    closeButtonInner: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: IOS.systemGray5,
        alignItems: "center",
        justifyContent: "center",
    },
    appInfo: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 20,
        gap: 12,
    },
    appIcon: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: IOS.blue,
        alignItems: "center",
        justifyContent: "center",
    },
    appIconImage: {
        width: 44,
        height: 44,
        borderRadius: 10,
    },
    appName: {
        fontSize: 17,
        fontWeight: "600",
        color: IOS.label,
    },
    appDomain: {
        fontSize: 13,
        color: IOS.secondaryLabel,
    },
    licenseCard: {
        alignItems: "center",
        marginBottom: 20,
    },
    licenseCardInner: {
        width: 200,
        aspectRatio: 1.586,
        borderRadius: 12,
        backgroundColor: "#E8E4F0",
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    licenseGradient: {
        flex: 1,
        padding: 12,
    },
    licenseHeader: {
        marginBottom: 8,
    },
    licenseState: {
        fontSize: 8,
        fontWeight: "700",
        color: "#5D4E7A",
        letterSpacing: 1,
    },
    licenseBody: {
        flexDirection: "row",
        gap: 10,
    },
    licensePhoto: {
        width: 40,
        height: 50,
        backgroundColor: "#D0C8DC",
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
    },
    licenseInfo: {
        flex: 1,
        gap: 6,
        paddingTop: 4,
    },
    licenseLine: {
        height: 6,
        width: 80,
        backgroundColor: "#D0C8DC",
        borderRadius: 3,
    },
    licenseSubtitle: {
        marginTop: 8,
        fontSize: 13,
        color: IOS.secondaryLabel,
    },
    shareSection: {
        marginBottom: 24,
    },
    shareTitle: {
        fontSize: 13,
        color: IOS.label,
        marginBottom: 4,
    },
    shareSubtitle: {
        fontSize: 13,
        color: IOS.secondaryLabel,
        marginBottom: 16,
    },
    dataGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 16,
    },
    dataItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    dataItemText: {
        fontSize: 15,
        color: IOS.label,
    },
    confirmButton: {
        backgroundColor: "#000000",
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 8,
    },
    confirmButtonDisabled: {
        opacity: 0.7,
    },
    confirmButtonText: {
        fontSize: 17,
        fontWeight: "600",
        color: "#FFFFFF",
    },
});
