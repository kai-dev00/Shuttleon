import { useLocalSearchParams } from "expo-router";

import ScoringPlayScreen from "../common/scoring/ScoringPlayScreen";
import { useTournamentMatch } from "./hooks/useTournaments";

export default function TournamentMatchPlayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id || undefined;
  const { data: match, isLoading, completeSet } = useTournamentMatch(matchId);

  const sidesReady = Boolean(match?.sideA && match?.sideB);

  return (
    <ScoringPlayScreen
      title={match?.tournamentName ?? "Tournament Match"}
      isLoading={isLoading}
      matchKey={match?.id}
      match={
        match && sidesReady
          ? {
              matchType: match.matchType,
              bestOf: match.bestOf,
              scoring: match.scoring,
              status: match.status,
              createdAt: match.createdAt,
              sideAName:
                match.matchType === "doubles"
                  ? match.sideA!.name
                  : match.sideA!.playerNames[0] ?? match.sideA!.name,
              sideBName:
                match.matchType === "doubles"
                  ? match.sideB!.name
                  : match.sideB!.playerNames[0] ?? match.sideB!.name,
              sideAPlayers: match.sideA!.playerNames,
              sideBPlayers: match.sideB!.playerNames,
            }
          : null
      }
      initialSets={match?.sets ?? []}
      notFoundLabel={
        match && !sidesReady
          ? "Both sides must be assigned before scoring."
          : "Match not found."
      }
      onCompleteSet={async (payload) => {
        if (!match) return;
        await completeSet({
          matchId: match.id,
          setNumber: payload.setNumber,
          teamAScore: payload.teamAScore,
          teamBScore: payload.teamBScore,
          teamASets: payload.teamASets,
          teamBSets: payload.teamBSets,
          winner: payload.winner,
          matchComplete: payload.matchComplete,
        });
      }}
    />
  );
}
