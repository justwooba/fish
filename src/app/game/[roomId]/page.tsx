import GamePageClient from "@/components/game/GamePageClient";

interface GamePageProps {
  params: Promise<{ roomId: string }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { roomId } = await params;
  return <GamePageClient roomId={roomId} />;
}