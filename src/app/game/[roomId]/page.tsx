import GamePageClient from "@/components/game/GamePageClient";
import ErrorBoundary from "@/components/ui/ErrorBoundary";

interface GamePageProps {
  params: Promise<{ roomId: string }>;
}

export default async function GamePage({ params }: GamePageProps) {
  const { roomId } = await params;
  return (
    <ErrorBoundary>
      <GamePageClient roomId={roomId} />
    </ErrorBoundary>
  );
}