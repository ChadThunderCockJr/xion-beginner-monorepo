import VerificationScreen from "@/components/VerificationScreen";
import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function VerifyPage() {
    const { sessionId, apiUrl } = useLocalSearchParams();
    const insets = useSafeAreaInsets();

    const session = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    const api = Array.isArray(apiUrl) ? apiUrl[0] : apiUrl;

    if (!session || !api) {
        return (
            <View style={[styles.container, styles.centerContainer, { paddingTop: insets.top }]}>
                <Text style={styles.errorText}>Missing Session Info</Text>
                <Text>Please scan the QR code again.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <VerificationScreen sessionId={session} apiUrl={api} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#ffffff",
    },
    centerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
    },
    errorText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
        color: 'red'
    }
});
