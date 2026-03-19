import LobbyPageClient from "@/components/lobby/LobbyPageClient";

interface RoomPageProps {
  params: Promise<{ code: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;

  return <LobbyPageClient roomCode={code.toUpperCase()} />;
}