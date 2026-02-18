import SuccessScreen from "@/components/SuccessScreen";
import React from "react";
import { StyleSheet, View } from "react-native";

export default function SuccessPage() {
  return (
    <View style={styles.container}>
      <SuccessScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});

