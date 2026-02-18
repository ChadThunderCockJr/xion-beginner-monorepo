import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";

import ProviderSelectionScreen from "./ProviderSelectionScreen";
import AppleWalletMockFlow from "./AppleWalletMockFlow";

type FlowState = "provider_selection" | "apple_wallet_flow";

interface VerificationScreenProps {
  sessionId?: string;
  apiUrl?: string;
}

export default function VerificationScreen({
  sessionId,
  apiUrl,
}: VerificationScreenProps) {
  const router = useRouter();
  const [flowState, setFlowState] = useState<FlowState>("provider_selection");

  const handleSelectProvider = (providerId: string) => {
    if (providerId === "apple_wallet") {
      setFlowState("apple_wallet_flow");
    }
    // Other providers would be handled here when available
  };

  const handleBack = () => {
    router.push("/");
  };

  const handleFlowComplete = () => {
    router.push("/success");
  };

  const handleFlowCancel = () => {
    setFlowState("provider_selection");
  };

  return (
    <View style={styles.container}>
      {flowState === "provider_selection" && (
        <ProviderSelectionScreen
          onSelectProvider={handleSelectProvider}
          onBack={handleBack}
        />
      )}

      {flowState === "apple_wallet_flow" && (
        <AppleWalletMockFlow
          sessionId={sessionId}
          apiUrl={apiUrl}
          onComplete={handleFlowComplete}
          onCancel={handleFlowCancel}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
