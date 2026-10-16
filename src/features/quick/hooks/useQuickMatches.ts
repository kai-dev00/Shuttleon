import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useQuickMatchRepository } from "../../../database/hooks/useQuickMatchRepository";
import {
  QuickMatch,
} from "../../../database/repositories/QuickMatchRepository";

import { CreateQuickMatch } from "../types/quickSchema";

export function useQuickMatches() {
  const repository = useQuickMatchRepository();
  const queryClient = useQueryClient();

  const { data: matches = [], isLoading, isError } = useQuery({
    queryKey: ["quick-matches"],
    queryFn: () => repository.getAll(),
  });

  const { mutateAsync: create } = useMutation({
    
   mutationFn: (data: CreateQuickMatch) => {
    console.log("CREATE DATA:", data);

    return repository.create({
      matchType: data.matchType,
      bestOf: data.bestOf,
      scoring: data.scoring,
      teamAName: data.teamAName,
      teamBName: data.teamBName,
      teamA:
        data.matchType === "singles"
          ? [data.player1]
          : [data.teamAPlayer1, data.teamAPlayer2],
      teamB:
        data.matchType === "singles"
          ? [data.player2]
          : [data.teamBPlayer1, data.teamBPlayer2],
    });
  },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["quick-matches"],
      });
    },
  });

  const { mutateAsync: updateStatus } = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: QuickMatch["status"];
    }) => repository.updateStatus(id, status),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["quick-matches"],
      });
    },
  });

  const { mutateAsync: updateSetScore } = useMutation({
    mutationFn: ({ id, teamASets, teamBSets }: {
      id: string;
      teamASets: number;
      teamBSets: number;
    }) => repository.updateSetScore(id, teamASets, teamBSets),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quick-matches"] });
    },
  });

  const { mutateAsync: recordSetScore } = useMutation({
    mutationFn: ({ id, setNumber, teamAScore, teamBScore }: {
      id: string;
      setNumber: number;
      teamAScore: number;
      teamBScore: number;
    }) => repository.recordSetScore(id, setNumber, teamAScore, teamBScore),
  });

  const { mutateAsync: rematch } = useMutation({
    mutationFn: (id: string) => repository.createRematch(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quick-matches"] });
    },
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateQuickMatch }) =>
      repository.update(id, {
        matchType: data.matchType,
        bestOf: data.bestOf,
        scoring: data.scoring,
        teamAName: data.teamAName,
        teamBName: data.teamBName,
        teamA:
          data.matchType === "singles"
            ? [data.player1]
            : [data.teamAPlayer1, data.teamAPlayer2],
        teamB:
          data.matchType === "singles"
            ? [data.player2]
            : [data.teamBPlayer1, data.teamBPlayer2],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["quick-matches"] });
    },
  });

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) =>
      repository.delete(id),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["quick-matches"],
      });
    },
  });

  return {
    matches,
    isLoading,
    isError,
    create,
    update,
    updateStatus,
    updateSetScore,
    recordSetScore,
    rematch,
    remove,
  };
}