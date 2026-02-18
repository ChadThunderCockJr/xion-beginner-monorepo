import VerificationScreen from "@/components/VerificationScreen";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function VerificationPage() {
  return (
    <View style={styles.container}>
      <VerificationScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
