import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useTournamentRepository } from "../../../database/hooks/useTournamentRepository";
import {
  CompleteTournamentSet,
  CreateTournament,
} from "../../../database/repositories/TournamentRepository";

export function useTournaments() {
  const repository = useTournamentRepository();
  const queryClient = useQueryClient();

  const { data: tournaments = [], isLoading, isError } = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => repository.getAll(),
  });

  const { mutateAsync: create } = useMutation({
    mutationFn: (data: CreateTournament) => repository.create(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });

  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateTournament }) =>
      repository.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });

  const { mutateAsync: remove } = useMutation({
    mutationFn: (id: string) => repository.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    },
  });

  const { mutateAsync: generateBracket } = useMutation({
    mutationFn: (id: string) => repository.generateBracket(id),
    onSuccess: async (_result, id) => {
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      await queryClient.invalidateQueries({ queryKey: ["bracket", id] });
    },
  });

  const { mutateAsync: updateTournamentStatus } = useMutation({
    mutationFn: ({ tournamentId, status }: { tournamentId: string; status: string }) =>
      repository.updateTournamentStatus(tournamentId, status as any),
    onSuccess: async (_result, { tournamentId }) => {
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      await queryClient.invalidateQueries({ queryKey: ["tournaments", tournamentId] });
    },
  });

  return {
    tournaments,
    isLoading,
    isError,
    create,
    update,
    remove,
    generateBracket,
    updateTournamentStatus,
  };
}

// Fetch a single tournament by id — useful for the review step / detail screen.
export function useTournament(id: string | undefined) {
  const repository = useTournamentRepository();

  return useQuery({
    queryKey: ["tournaments", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Tournament id is required");
      }
      return repository.getById(id);
    },
    enabled: id !== undefined,
  });
}

// Fetch the generated bracket (rounds + matches) for a tournament.
export function useBracket(id: string | undefined) {
  const repository = useTournamentRepository();

  return useQuery({
    queryKey: ["bracket", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Tournament id is required");
      }
      return repository.getBracket(id);
    },
    enabled: id !== undefined,
  });
}

export function useTournamentMatch(id: string | undefined) {
  const repository = useTournamentRepository();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tournament-match", id],
    queryFn: () => {
      if (id === undefined) {
        throw new Error("Match id is required");
      }
      return repository.getMatchById(id);
    },
    enabled: id !== undefined,
  });

  const { mutateAsync: completeSet } = useMutation({
    mutationFn: (data: CompleteTournamentSet) => repository.completeSet(data),
    onSuccess: async (_result, data) => {
      const match = await repository.getMatchById(data.matchId);
      await queryClient.invalidateQueries({
        queryKey: ["tournament-match", data.matchId],
      });
      if (match) {
        await queryClient.invalidateQueries({
          queryKey: ["bracket", match.tournamentId],
        });
        await queryClient.invalidateQueries({ queryKey: ["standings", match.tournamentId] }); // add this
        await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
        await queryClient.invalidateQueries({
          queryKey: ["tournaments", match.tournamentId],
        });
      }
    },
  });

  return {
    ...query,
    completeSet,
  };
}

//
export function useStandings(tournamentId: string | undefined) {
  const repository = useTournamentRepository();

  return useQuery({
    queryKey: ["standings", tournamentId],
    queryFn: () => {
      if (tournamentId === undefined) throw new Error("Tournament id is required");
      return repository.getStandings(tournamentId);
    },
    enabled: tournamentId !== undefined,
  });
}