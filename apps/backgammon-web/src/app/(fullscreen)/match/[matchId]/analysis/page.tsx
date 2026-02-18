"use client";

import { useParams, useRouter } from "next/navigation";
import { PostGameAnalysis } from "@/components/PostGameAnalysis";

export default function AnalysisPage() {
  const params = useParams<{ matchId: string }>();
  const router = useRouter();

  return (
    <PostGameAnalysis
      winner="white"
      myColor="white"
      resultType="normal"
      opponentName="MarcGM"
      onRematch={() => router.push("/")}
      onBackToLobby={() => router.push("/")}
      onBack={() => router.back()}
    />
  );
}
