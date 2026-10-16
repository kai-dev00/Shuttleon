import { useState } from "react";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { formatListDate } from "../common/dates";
import { safePush } from "@/src/hooks/safePush";
import { ChevronRight, Pencil, Trophy, Radio, CheckCircle2, Play, Hourglass } from "lucide-react-native";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Header from "../common/header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/src/hooks/useThemeColors";
import { useBracket, useStandings, useTournament } from "./hooks/useTournaments";
import { BracketMatch, StandingsRow } from "../../database/repositories/TournamentRepository";
import StandingsTable, { StandingsColumn } from "./components/StandingTable";
import { FORMAT_LABELS, TournamentStatusBadge } from "./components/TournamentRow";

type Tab = "bracket" | "standings";

const TAB_OPTIONS: { label: string; value: Tab }[] = [
  { label: "Bracket", value: "bracket" },
  { label: "Standings", value: "standings" },
];

export default function TournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = id || undefined;
  const { mutedForeground, primaryForeground } = useThemeColors();

  const { data: tournament, isLoading: isLoadingTournament } = useTournament(tournamentId);
  const { data: bracket, isLoading: isLoadingBracket } = useBracket(tournamentId);
  const [activeTab, setActiveTab] = useState<Tab>("bracket");

  const { data: standings = [] } = useStandings(tournamentId);

  const standingsColumns: StandingsColumn<StandingsRow>[] = [
    {
      key: "record",
      label: "W-L-T",
      align: "right",
      width: 80,
      render: (row) => `${row.wins}-${row.losses}-${row.ties}`,
    },
    {
      key: "diff",
      label: "Diff",
      align: "right",
      width: 56,
      render: (row) => (row.pointDiff > 0 ? `+${row.pointDiff}` : `${row.pointDiff}`),
    },
  ];

  if (isLoadingTournament || isLoadingBracket) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={mutedForeground} />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <Header title="Tournament" showBack onBackPress={() => router.back()} />
        <EmptyState icon={Trophy} title="Tournament not found" />
      </SafeAreaView>
    );
  }

  const canEdit = tournament.status === "draft" || tournament.status === "upcoming";
  const hasBracket = Boolean(bracket && bracket.rounds.length > 0);

  const allMatches = bracket?.rounds.flat() ?? [];
  const playedCount = allMatches.filter((match) => match.status === "concluded").length;
  const progress = allMatches.length > 0 ? playedCount / allMatches.length : 0;
  const champion = tournament.status === "concluded" ? standings[0] : undefined;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Header
        title={tournament.name}
        subtitle={`${FORMAT_LABELS[tournament.format]} · ${tournament.players.length} players`}
        showBack
        onBackPress={() => router.back()}
        rightContent={canEdit ? <Pencil size={22} /> : null}
        onRightPress={() => safePush(`/tournament/edit/${tournament.id}`)}
        rightAccessibilityLabel="Edit tournament"
      />
      <View className="gap-3 px-4 pb-3">
        <Card tonal={Boolean(champion)} className="gap-3 p-4">
          {champion ? (
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary">
                <Trophy size={22} color={primaryForeground} />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-semibold uppercase text-muted-foreground">
                  Tournament complete
                </Text>
                <Text className="text-lg font-extrabold" numberOfLines={1}>
                  {champion.name} wins
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-muted-foreground">
                {tournament.matchType === "singles" ? "Singles" : "Doubles"} · BO{tournament.bestOf} ·{" "}
                {tournament.scoring} pts
              </Text>
              <TournamentStatusBadge status={tournament.status} />
            </View>
          )}

          <Text className="text-xs text-muted-foreground">
            {formatListDate(tournament.createdAt)}
          </Text>

          {allMatches.length > 0 ? (
            <View className="gap-1.5">
              <View className="h-2 overflow-hidden rounded-full bg-muted">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </View>
              <Text className="text-xs text-muted-foreground">
                {playedCount} of {allMatches.length} matches played
              </Text>
            </View>
          ) : null}
        </Card>

        {hasBracket ? (
          <SegmentedControl options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />
        ) : null}
      </View>

      {!hasBracket ? (
        <EmptyState
          icon={Trophy}
          title="No bracket yet"
          subtitle="No bracket has been generated for this tournament."
        />
      ) : activeTab === "bracket" ? (
        <ScrollView contentContainerClassName="gap-6 px-4 pb-8">
          {bracket!.rounds.map((matches, index) => (
            <RoundSection key={index} roundNumber={index + 1} matches={matches} />
          ))}
        </ScrollView>
      ) : (
        <StandingsTable
          rows={standings}
          columns={standingsColumns}
          keyExtractor={(row) => row.teamId}
          labelColumn={(row) => row.name}
        />
      )}
    </SafeAreaView>
  );
}

function RoundSection({ roundNumber, matches }: { roundNumber: number; matches: BracketMatch[] }) {
  const done = matches.filter((match) => match.status === "concluded").length;

  return (
    <View className="gap-2.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-bold">Round {roundNumber}</Text>
        <Text className="text-xs text-muted-foreground">
          {done}/{matches.length} done
        </Text>
      </View>
      <View className="gap-2.5">
        {matches.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </View>
    </View>
  );
}

function MatchCard({ match }: { match: BracketMatch }) {
  const { mutedForeground } = useThemeColors();
  const canScore = Boolean(match.sideA && match.sideB);
  const concluded = match.status === "concluded";
  const showSets = match.status !== "upcoming" || match.teamASets > 0 || match.teamBSets > 0;
  const aWon = concluded && match.winnerTeamId !== null && match.winnerTeamId === match.sideA?.id;
  const bWon = concluded && match.winnerTeamId !== null && match.winnerTeamId === match.sideB?.id;

  return (
    <Pressable
      disabled={!canScore}
      onPress={() => safePush(`/tournament/match/${match.id}`)}
      accessibilityRole="button"
      className={cn(
        "flex-row items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted",
        !canScore && "opacity-60",
      )}
    >

      <View className="flex-1 gap-1.5">
        <SideLine name={match.sideA?.name ?? "TBD"} sets={match.teamASets} showSets={showSets} won={aWon} dim={bWon} />
        <SideLine name={match.sideB?.name ?? "TBD"} sets={match.teamBSets} showSets={showSets} won={bWon} dim={aWon} />
      </View>

<View className="flex-row items-center gap-2">
      {match.status === "ongoing" ? (
        <Badge label="Live" icon={Radio} variant="live" />
      ) : concluded ? (
        <Badge label="Done" icon={CheckCircle2} variant="done" />
      ) : canScore ? (
        <Badge label="Ready" icon={Play} variant="outline" />
      ) : (
        <Badge label="TBD" icon={Hourglass} variant="muted" />
      )}
      </View>
      {canScore ? <ChevronRight size={18} color={mutedForeground} /> : null}
    </Pressable>
  );
}

function SideLine({
  name,
  sets,
  showSets,
  won,
  dim,
}: {
  name: string;
  sets: number;
  showSets: boolean;
  won: boolean;
  dim: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Text
        numberOfLines={1}
        className={cn("flex-1 text-sm", won ? "font-bold" : "font-medium", dim && "text-muted-foreground")}
      >
        {name}
      </Text>
      {showSets ? (
        <Text
          className={cn("w-5 text-right text-sm", won ? "font-extrabold" : "text-muted-foreground")}
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {sets}
        </Text>
      ) : null}
    </View>
  );
}
