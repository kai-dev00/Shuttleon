import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertCircle, Plus, Search, Trash2, Trophy, X } from "lucide-react-native";
import { router } from "expo-router";
import { safePush } from "@/src/hooks/safePush";
import { useThemeColors } from "@/src/hooks/useThemeColors";

import Header from "../common/header";
import CustomList from "@/components/ui/CustomList";
import { EmptyState } from "@/components/ui/empty-state";
import { Fab } from "@/components/ui/fab";
import { Input } from "@/components/ui/input";
import TournamentRow, {
  TOURNAMENT_ROW_HEIGHT,
  TournamentListItem,
} from "./components/TournamentRow";
import { useTournaments } from "./hooks/useTournaments";
import { DATE_FILTER_OPTIONS, matchesDateFilter, type DateFilter } from "../common/dates";
import FilterBar, {
  FilterRow,
  FilterToggleButton,
  countActiveFilters,
} from "../common/filterBar";

// NOTE: adjust these option lists to match your actual `format` / `status`
// enum values from the tournament schema — placeholders below are guesses.
const FORMAT_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Round robin", value: "round_robin" },
  { label: "Knockout", value: "knockout" },
];

const STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Concluded", value: "concluded" },
];

export default function TournamentScreen() {
  const { tournaments, isLoading, remove } = useTournaments();
  const { mutedForeground } = useThemeColors();

  const [search, setSearch] = useState("");
  const [matchTypeFilter, setMatchTypeFilter] = useState<
    "all" | "singles" | "doubles"
  >("all");
  const [bestOfFilter, setBestOfFilter] = useState<number | null>(null);
  const [scoringFilter, setScoringFilter] = useState<number | null>(null);
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const activeFilterCount = countActiveFilters([
    matchTypeFilter,
    bestOfFilter,
    scoringFilter,
    formatFilter,
    statusFilter,
    dateFilter,
  ]);

  const filterRows: FilterRow[] = [
    {
      key: "type-status-row",
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
      key: "format-row",
      items: [
        {
          type: "group",
          group: {
            key: "format",
            label: "Format",
            options: FORMAT_OPTIONS,
            selected: formatFilter,
            onChange: (value) => setFormatFilter((value as string) ?? "all"),
          },
        },
      ],
    },
    {
      key: "status-row",
      items: [
        {
          type: "group",
          group: {
            key: "status",
            label: "Status",
            options: STATUS_OPTIONS,
            selected: statusFilter,
            onChange: (value) => setStatusFilter((value as string) ?? "all"),
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
            onChange: (value) => setDateFilter((value ?? "all") as DateFilter),
          },
        },
      ],
    },
  ];

  const displayTournaments: TournamentListItem[] = tournaments.map(
    (tournament) => ({
      id: String(tournament.id),
      name: tournament.name,
      matchType: tournament.matchType,
      bestOf: tournament.bestOf,
      scoring: tournament.scoring,
      format: tournament.format,
      status: tournament.status,
      playerCount: tournament.players.length,
      createdAt: tournament.createdAt,
      updatedAt: tournament.updatedAt,
    }),
  );

  const filteredTournaments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return displayTournaments.filter((tournament) => {
      const searchableText = [
        tournament.name,
        tournament.matchType,
        tournament.format,
        tournament.status,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedSearch || searchableText.includes(normalizedSearch)) &&
        (matchTypeFilter === "all" ||
          tournament.matchType === matchTypeFilter) &&
        (bestOfFilter === null || tournament.bestOf === bestOfFilter) &&
        (scoringFilter === null || tournament.scoring === scoringFilter) &&
        (formatFilter === "all" || tournament.format === formatFilter) &&
        (statusFilter === "all" || tournament.status === statusFilter) &&
        matchesDateFilter(tournament.createdAt, dateFilter)
      );
    });
  }, [
    bestOfFilter,
    dateFilter,
    displayTournaments,
    formatFilter,
    matchTypeFilter,
    scoringFilter,
    search,
    statusFilter,
  ]);

  function handlePress(tournament: TournamentListItem) {
    if (selectedIds.size > 0) {
      toggleSelection(tournament.id);
      return;
    }

    safePush(`/tournament/${tournament.id}`);
  }

  function handleLongPress(tournament: TournamentListItem) {
    toggleSelection(tournament.id);
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
      "Delete selected tournaments?",
      `This will permanently delete ${selectedIds.size} tournament${selectedIds.size === 1 ? "" : "s"}.`,
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
  const hasTournaments = displayTournaments.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Header
        title={selecting ? `${selectedIds.size} selected` : "Tournament"}
        subtitle={
          selecting || !hasTournaments
            ? undefined
            : `${displayTournaments.length} tournament${displayTournaments.length === 1 ? "" : "s"}`
        }
        onCancel={selecting ? () => setSelectedIds(new Set()) : undefined}
        rightContent={selecting ? <Trash2 size={22} /> : undefined}
        rightVariant="destructive"
        rightAccessibilityLabel="Delete selected tournaments"
        onRightPress={handleDeleteSelected}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={mutedForeground} />
        </View>
      ) : !hasTournaments ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          subtitle="Create a round-robin tournament and run every match from one place."
          actionLabel="New tournament"
          onAction={() => safePush("/tournament/add")}
        />
      ) : (
        <View className="flex-1">
          <View className="px-4 pb-3">
            <View className="flex-row items-center gap-2">
              <View className="relative flex-1">
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search tournaments"
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

          {filteredTournaments.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No tournaments found"
              subtitle="Try a different search or clear the filters."
            />
          ) : (
            <CustomList
              className="mb-24"
              data={filteredTournaments}
              keyExtractor={(item, index) => `${item.id || "tournament"}-${index}`}
              itemHeight={TOURNAMENT_ROW_HEIGHT}
              renderItem={(tournament) => (
                <TournamentRow
                  tournament={tournament}
                  selected={selectedIds.has(tournament.id)}
                  onPress={handlePress}
                  onLongPress={handleLongPress}
                />
              )}
            />
          )}
        </View>
      )}

      {!isLoading && hasTournaments && !selecting ? (
        <Fab
          icon={Plus}
          onPress={() => safePush("/tournament/add")}
          accessibilityLabel="New tournament"
        />
      ) : null}
    </SafeAreaView>
  );
}
