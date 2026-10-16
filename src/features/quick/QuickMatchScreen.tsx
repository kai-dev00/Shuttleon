import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertCircle, Plus, Search, Trash2, X, Zap } from "lucide-react-native";
import Header from "../common/header";
import CustomList from "@/components/ui/CustomList";
import { EmptyState } from "@/components/ui/empty-state";
import { Fab } from "@/components/ui/fab";
import { Input } from "@/components/ui/input";
import MatchRow, { MATCH_ROW_HEIGHT, Match } from "./components/MatchRow";
import { router } from "expo-router";
import { safePush } from "@/src/hooks/safePush";
import { useQuickMatches } from "./hooks/useQuickMatches";
import { DATE_FILTER_OPTIONS, matchesDateFilter, type DateFilter } from "../common/dates";
import FilterBar, {
  FilterRow,
  FilterToggleButton,
  countActiveFilters,
} from "../common/filterBar";
import { useThemeColors } from "@/src/hooks/useThemeColors";

export default function QuickMatchScreen() {
  const { mutedForeground } = useThemeColors();
  const { matches, isLoading, isError, remove } = useQuickMatches();
  const [search, setSearch] = useState("");
  const [matchTypeFilter, setMatchTypeFilter] = useState<
    "all" | "singles" | "doubles"
  >("all");
  const [rematchOnly, setRematchOnly] = useState(false);
  const [bestOfFilter, setBestOfFilter] = useState<number | null>(null);
  const [scoringFilter, setScoringFilter] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>(
    "all",
  );
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeFilterCount = countActiveFilters([
    matchTypeFilter,
    rematchOnly,
    bestOfFilter,
    scoringFilter,
    dateFilter,
  ]);

  const filterRows: FilterRow[] = [
    {
      key: "type-row",
      items: [
        {
          type: "group",
          group: {
            key: "matchType",
            options: [
              { label: "All", value: "all" },
              { label: "Singles", value: "singles" },
              { label: "Doubles", value: "doubles" },
            ],
            selected: matchTypeFilter,
            onChange: (value) =>
              setMatchTypeFilter((value ?? "all") as typeof matchTypeFilter),
          },
        },
        {
          type: "toggle",
          toggle: {
            key: "rematchOnly",
            label: "Rematches",
            selected: rematchOnly,
            onToggle: () => setRematchOnly((current) => !current),
          },
        },
      ],
    },
    {
      key: "best-of-scoring-row",
      items: [
        {
          type: "group",
          group: {
            key: "bestOf",
            label: "Best of",
            options: [1, 2, 3, 4, 5].map((value) => ({
              label: `BO${value}`,
              value,
            })),
            selected: bestOfFilter,
            onChange: setBestOfFilter,
            toggleOff: true,
          },
        },
        {
          type: "group",
          group: {
            key: "scoring",
            label: "Scoring",
            options: [8, 11, 21].map((value) => ({
              label: String(value),
              value,
            })),
            selected: scoringFilter,
            onChange: setScoringFilter,
            toggleOff: true,
          },
        },
      ],
    },
    {
      key: "date-row",
      items: [
        {
          type: "group",
          group: {
            key: "date",
            label: "Date",
            options: DATE_FILTER_OPTIONS,
            selected: dateFilter,
            onChange: (value) =>
              setDateFilter((value ?? "all") as typeof dateFilter),
          },
        },
      ],
    },
  ];

  const displayMatches: Match[] = matches.map((match) => ({
    id: String(match.id),
    matchType: match.matchType,
    bestOf: match.bestOf,
    scoring: match.scoring,
    rematchNumber: match.rematchNumber,
    createdAt: match.createdAt,
    endedAt: match.endedAt,
    teamASets: match.teamASets,
    teamBSets: match.teamBSets,
    teamAName: match.teamAName,
    teamBName: match.teamBName,
    playerA: match.teamA.join(" / "),
    playerB: match.teamB.join(" / "),
    status: match.status,
    result:
      match.status === "concluded"
        ? "Match concluded"
        : match.status === "ongoing"
          ? "Match in progress"
          : undefined,
  }));

  const filteredMatches = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return displayMatches.filter((match) => {
      const searchableText = [
        match.playerA,
        match.playerB,
        match.teamAName,
        match.teamBName,
        match.matchType,
        match.rematchNumber > 0 ? `rematch ${match.rematchNumber}` : "original",
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedSearch || searchableText.includes(normalizedSearch)) &&
        (matchTypeFilter === "all" || match.matchType === matchTypeFilter) &&
        (!rematchOnly || match.rematchNumber > 0) &&
        (bestOfFilter === null || match.bestOf === bestOfFilter) &&
        (scoringFilter === null || match.scoring === scoringFilter) &&
        matchesDateFilter(match.createdAt, dateFilter)
      );
    });
  }, [
    bestOfFilter,
    dateFilter,
    displayMatches,
    matchTypeFilter,
    rematchOnly,
    scoringFilter,
    search,
  ]);

  function handlePress(match: Match) {
    if (selectedIds.size > 0) {
      toggleSelection(match.id);
      return;
    }

    safePush(`/quick/${match.id}`);
  }

  function handleLongPress(match: Match) {
    toggleSelection(match.id);
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDeleteSelected() {
    if (selectedIds.size === 0) return;

    Alert.alert(
      "Delete selected matches?",
      `This will permanently delete ${selectedIds.size} match${selectedIds.size === 1 ? "" : "es"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await Promise.all([...selectedIds].map((id) => remove(id)));
            setSelectedIds(new Set());
          },
        },
      ],
    );
  }


  const selecting = selectedIds.size > 0;
  const hasMatches = displayMatches.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Header
        title={selecting ? `${selectedIds.size} selected` : "Quick"}
        subtitle={
          selecting || !hasMatches
            ? undefined
            : `${displayMatches.length} match${displayMatches.length === 1 ? "" : "es"}`
        }
        onCancel={selecting ? () => setSelectedIds(new Set()) : undefined}
        rightContent={selecting ? <Trash2 size={22} /> : undefined}
        rightVariant="destructive"
        rightAccessibilityLabel="Delete selected matches"
        onRightPress={handleDeleteSelected}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={mutedForeground} />
        </View>
      ) : isError ? (
        <EmptyState
          icon={AlertCircle}
          title="Couldn't load matches"
          subtitle="Something went wrong reading your matches. Restart the app and try again."
        />
      ) : !hasMatches ? (
        <EmptyState
          icon={Zap}
          title="No quick matches yet"
          subtitle="Start a casual game and track the score live."
          actionLabel="New quick match"
          onAction={() => safePush("/quick/add")}
        />
      ) : (
        <View className="flex-1">
          <View className="px-4 pb-3">
            <View className="flex-row items-center gap-2">
              <View className="relative flex-1">
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search matches"
                  icon={Search}
                  className="w-full pl-10 pr-10"
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <Pressable
                    className="absolute right-1 top-0 h-10 w-10 items-center justify-center"
                    onPress={() => setSearch("")}
                    accessibilityLabel="Clear search"
                    hitSlop={8}
                  >
                    <X size={18} color={mutedForeground} />
                  </Pressable>
                )}
              </View>
              <FilterToggleButton
                activeFilterCount={activeFilterCount}
                expanded={showFilters}
                onPress={() => setShowFilters((current) => !current)}
              />
            </View>

            <FilterBar visible={showFilters} rows={filterRows} />
          </View>

          {filteredMatches.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matches found"
              subtitle="Try a different search or clear the filters."
            />
          ) : (
            <CustomList
              className="mb-24"
              data={filteredMatches}
              keyExtractor={(item, index) => `${item.id || "quick-match"}-${index}`}
              itemHeight={MATCH_ROW_HEIGHT}
              renderItem={(match) => (
                <MatchRow
                  match={match}
                  selected={selectedIds.has(match.id)}
                  onPress={handlePress}
                  onLongPress={handleLongPress}
                />
              )}
            />
          )}
        </View>
      )}

      {!isLoading && !isError && hasMatches && !selecting ? (
        <Fab icon={Plus} onPress={() => safePush("/quick/add")} accessibilityLabel="New quick match" />
      ) : null}
    </SafeAreaView>
  );
}

