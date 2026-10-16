import { SQLiteDatabase } from "expo-sqlite";
import { newId, nowIso } from "../ids";

export type TournamentFormat = "round_robin" | "single_elim" | "swiss" | "other";
export type TournamentStatus = "draft" | "upcoming" | "ongoing" | "concluded";

export type TournamentPlayer = {
  id: string;
  name: string;
  seed: number | null;
};

export type Tournament = {
  id: string;
  name: string;
  matchType: "singles" | "doubles";
  format: TournamentFormat;
  bestOf: number;
  scoring: number;
  status: TournamentStatus;
  players: TournamentPlayer[];
  createdAt: string;
  updatedAt: string;
};

export type CreateTournament = {
  name: string;
  matchType: "singles" | "doubles";
  format: TournamentFormat;
  bestOf: number;
  scoring: number;
  players: string[];
};

type TournamentPlayerRow = {
  id: string;
  name: string;
  seed: number | null;
};

export type BracketTeam = {
  id: string;
  name: string;
  playerNames: string[];
};

export type TournamentMatchStatus = "upcoming" | "ongoing" | "concluded";

export type TournamentMatchSet = {
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
};

export type BracketMatch = {
  id: string;
  round: number;
  matchOrder: number;
  sideA: BracketTeam | null;
  sideB: BracketTeam | null;
  status: TournamentMatchStatus;
  teamASets: number;
  teamBSets: number;
  winnerTeamId: string | null;
};

export type TournamentMatchDetail = {
  id: string;
  tournamentId: string;
  tournamentName: string;
  matchType: "singles" | "doubles";
  bestOf: number;
  scoring: number;
  round: number;
  matchOrder: number;
  status: TournamentMatchStatus;
  teamASets: number;
  teamBSets: number;
  sets: TournamentMatchSet[];
  sideA: BracketTeam | null;
  sideB: BracketTeam | null;
  winnerTeamId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompleteTournamentSet = {
  matchId: string;
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
  teamASets: number;
  teamBSets: number;
  winner: "A" | "B";
  matchComplete: boolean;
};

export type Bracket = {
  format: TournamentFormat;
  rounds: BracketMatch[][];
};

export type StandingsRow = {
  teamId: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  played: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
};

export class TournamentRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  public async getAll(): Promise<Tournament[]> {
    const tournaments = await this.database.getAllAsync<{
      id: string;
      name: string;
      match_type: "singles" | "doubles";
      format: TournamentFormat;
      best_of: number;
      scoring: number;
      status: TournamentStatus;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        id,
        name,
        match_type,
        format,
        best_of,
        scoring,
        status,
        created_at,
        updated_at
      FROM tournaments
      WHERE deleted_at IS NULL
      ORDER BY created_at DESC;
      `,
    );

    return Promise.all(
      tournaments.map(async (tournament) => {
        const players = await this.getPlayers(tournament.id);
        return {
          id: tournament.id,
          name: tournament.name,
          matchType: tournament.match_type,
          format: tournament.format,
          bestOf: tournament.best_of,
          scoring: tournament.scoring,
          status: tournament.status,
          players,
          createdAt: tournament.created_at,
          updatedAt: tournament.updated_at,
        };
      }),
    );
  }

  public async getById(id: string): Promise<Tournament | null> {
    const tournament = await this.database.getFirstAsync<{
      id: string;
      name: string;
      match_type: "singles" | "doubles";
      format: TournamentFormat;
      best_of: number;
      scoring: number;
      status: TournamentStatus;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        id,
        name,
        match_type,
        format,
        best_of,
        scoring,
        status,
        created_at,
        updated_at
      FROM tournaments
      WHERE id = ? AND deleted_at IS NULL;
      `,
      [id],
    );

    if (!tournament) {
      return null;
    }

    const players = await this.getPlayers(id);

    return {
      id: tournament.id,
      name: tournament.name,
      matchType: tournament.match_type,
      format: tournament.format,
      bestOf: tournament.best_of,
      scoring: tournament.scoring,
      status: tournament.status,
      players,
      createdAt: tournament.created_at,
      updatedAt: tournament.updated_at,
    };
  }

  private getPlayers(tournamentId: string): Promise<TournamentPlayerRow[]> {
    return this.database.getAllAsync<TournamentPlayerRow>(
      `
      SELECT id, name, seed
      FROM tournament_players
      WHERE tournament_id = ? AND deleted_at IS NULL
      ORDER BY seed IS NULL, seed, id;
      `,
      [tournamentId],
    );
  }

  public async create(data: CreateTournament): Promise<string> {
    const id = newId();
    const now = nowIso();

    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `
        INSERT INTO tournaments (
          id, name, match_type, format, best_of, scoring, status, created_at, updated_at, dirty
        )
        VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, 1);
        `,
        [id, data.name, data.matchType, data.format, data.bestOf, data.scoring, now, now],
      );

      await this.syncPlayers(id, data.players);
    });

    return id;
  }

  public async update(id: string, data: CreateTournament): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `
        UPDATE tournaments
        SET name = ?, match_type = ?, format = ?, best_of = ?, scoring = ?, updated_at = ?, dirty = 1
        WHERE id = ?;
        `,
        [data.name, data.matchType, data.format, data.bestOf, data.scoring, nowIso(), id],
      );

      await this.syncPlayers(id, data.players);
    });
  }

  /**
   * Makes the stored players match `players` by position (seed), keeping existing rows and ids,
   * inserting new ones and tombstoning removed ones (plus their team links).
   * Must run inside a transaction.
   */
  private async syncPlayers(tournamentId: string, players: string[]): Promise<void> {
    const now = nowIso();
    const existing = await this.getPlayers(tournamentId);

    for (let index = 0; index < players.length; index++) {
      const seed = index + 1;
      const current = existing[index];

      if (!current) {
        await this.database.runAsync(
          `
          INSERT INTO tournament_players (id, tournament_id, name, seed, created_at, updated_at, dirty)
          VALUES (?, ?, ?, ?, ?, ?, 1);
          `,
          [newId(), tournamentId, players[index], seed, now, now],
        );
      } else if (current.name !== players[index] || current.seed !== seed) {
        await this.database.runAsync(
          `UPDATE tournament_players SET name = ?, seed = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
          [players[index], seed, now, current.id],
        );
      }
    }

    for (const removed of existing.slice(players.length)) {
      await this.database.runAsync(
        `
        UPDATE tournament_team_players SET deleted_at = ?, updated_at = ?, dirty = 1
        WHERE tournament_player_id = ? AND deleted_at IS NULL;
        `,
        [now, now, removed.id],
      );
      await this.database.runAsync(
        `UPDATE tournament_players SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
        [now, now, removed.id],
      );
    }
  }

  /** Soft delete: tombstones the tournament and everything under it so the delete can sync. */
  public async delete(id: string): Promise<void> {
    const now = nowIso();

    await this.database.withTransactionAsync(async () => {
      const tombstone = (table: string, where: string) =>
        this.database.runAsync(
          `UPDATE ${table} SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE ${where} AND deleted_at IS NULL;`,
          [now, now, id],
        );

      await tombstone(
        "tournament_match_sets",
        "tournament_match_id IN (SELECT id FROM tournament_matches WHERE tournament_id = ?)",
      );
      await tombstone("tournament_matches", "tournament_id = ?");
      await tombstone(
        "tournament_team_players",
        "tournament_team_id IN (SELECT id FROM tournament_teams WHERE tournament_id = ?)",
      );
      await tombstone("tournament_teams", "tournament_id = ?");
      await tombstone("tournament_players", "tournament_id = ?");
      await tombstone("tournaments", "id = ?");
    });
  }

  /**
   * Builds teams from the tournament's players, schedules matches based on
   * `format`, and moves the tournament to "ongoing". Currently supports
   * round_robin only — single_elim throws until that scheduling logic exists.
   */
  public async generateBracket(tournamentId: string): Promise<void> {
    const tournament = await this.getById(tournamentId);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    if (tournament.format !== "round_robin") {
      throw new Error(
        `Bracket generation for "${tournament.format}" isn't implemented yet — only round_robin is supported.`,
      );
    }

    await this.database.withTransactionAsync(async () => {
      const teamIds = await this.createTeamsFromPlayers(
        tournamentId,
        tournament.matchType,
        tournament.players,
      );

      if (teamIds.length < 2) {
        throw new Error("Need at least 2 teams to generate a bracket");
      }

      const rounds = buildRoundRobinRounds(teamIds);
      const now = nowIso();

      for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
        const roundMatches = rounds[roundIndex];
        for (let matchIndex = 0; matchIndex < roundMatches.length; matchIndex++) {
          const [teamA, teamB] = roundMatches[matchIndex];
          await this.database.runAsync(
            `
            INSERT INTO tournament_matches (
              id, tournament_id, round, match_order, side_a_team_id, side_b_team_id,
              status, created_at, updated_at, dirty
            )
            VALUES (?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, 1);
            `,
            [newId(), tournamentId, roundIndex + 1, matchIndex + 1, teamA, teamB, now, now],
          );
        }
      }
    });
  }

  /**
   * Creates a tournament_team (+ tournament_team_players) row per side.
   * Singles: one team per player. Doubles: consecutive players paired up
   * (players list order determines pairing) — throws if the count is odd.
   */
  private async createTeamsFromPlayers(
    tournamentId: string,
    matchType: "singles" | "doubles",
    players: TournamentPlayer[],
  ): Promise<string[]> {
    if (matchType === "doubles" && players.length % 2 !== 0) {
      throw new Error("Doubles requires an even number of players");
    }

    const groups: TournamentPlayer[][] =
      matchType === "singles"
        ? players.map((player) => [player])
        : chunk(players, 2);

    const teamIds: string[] = [];
    const now = nowIso();

    for (const group of groups) {
      const teamId = newId();
      await this.database.runAsync(
        `
        INSERT INTO tournament_teams (id, tournament_id, name, created_at, updated_at, dirty)
        VALUES (?, ?, ?, ?, ?, 1);
        `,
        [teamId, tournamentId, group.map((player) => player.name).join(" / "), now, now],
      );

      for (const player of group) {
        await this.database.runAsync(
          `
          INSERT INTO tournament_team_players (
            id, tournament_team_id, tournament_player_id, created_at, updated_at, dirty
          )
          VALUES (?, ?, ?, ?, ?, 1);
          `,
          [newId(), teamId, player.id, now, now],
        );
      }

      teamIds.push(teamId);
    }

    return teamIds;
  }


  public async updateTournamentStatus(tournamentId: string, status: TournamentStatus): Promise<void> {
    await this.database.runAsync(
      `UPDATE tournaments SET status = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
      [status, nowIso(), tournamentId],
    );
  }

  public async getBracket(tournamentId: string): Promise<Bracket | null> {
    const tournament = await this.getById(tournamentId);
    if (!tournament) return null;

    const matches = await this.database.getAllAsync<{
      id: string;
      round: number;
      match_order: number;
      side_a_team_id: string | null;
      side_b_team_id: string | null;
      status: TournamentMatchStatus;
      team_a_sets: number;
      team_b_sets: number;
      winner_team_id: string | null;
    }>(
      `
      SELECT id, round, match_order, side_a_team_id, side_b_team_id, status, team_a_sets, team_b_sets, winner_team_id
      FROM tournament_matches
      WHERE tournament_id = ? AND deleted_at IS NULL
      ORDER BY round, match_order;
      `,
      [tournamentId],
    );

    const roundsMap = new Map<number, BracketMatch[]>();

    for (const match of matches) {
      const sideA = await this.getTeam(match.side_a_team_id);
      const sideB = await this.getTeam(match.side_b_team_id);

      const bracketMatch: BracketMatch = {
        id: match.id,
        round: match.round,
        matchOrder: match.match_order,
        sideA,
        sideB,
        status: match.status,
        teamASets: match.team_a_sets,
        teamBSets: match.team_b_sets,
        winnerTeamId: match.winner_team_id,
      };

      const existing = roundsMap.get(match.round) ?? [];
      existing.push(bracketMatch);
      roundsMap.set(match.round, existing);
    }

    const rounds = Array.from(roundsMap.keys())
      .sort((a, b) => a - b)
      .map((roundNumber) => roundsMap.get(roundNumber)!);

    return { format: tournament.format, rounds };
  }

  public async getMatchById(matchId: string): Promise<TournamentMatchDetail | null> {
    const match = await this.database.getFirstAsync<{
      id: string;
      tournament_id: string;
      round: number;
      match_order: number;
      side_a_team_id: string | null;
      side_b_team_id: string | null;
      team_a_sets: number;
      team_b_sets: number;
      status: TournamentMatchStatus;
      winner_team_id: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      SELECT
        id,
        tournament_id,
        round,
        match_order,
        side_a_team_id,
        side_b_team_id,
        team_a_sets,
        team_b_sets,
        status,
        winner_team_id,
        created_at,
        updated_at
      FROM tournament_matches
      WHERE id = ? AND deleted_at IS NULL;
      `,
      [matchId],
    );

    if (!match) return null;

    const tournament = await this.getById(match.tournament_id);
    if (!tournament) return null;

    const [sideA, sideB, sets] = await Promise.all([
      this.getTeam(match.side_a_team_id),
      this.getTeam(match.side_b_team_id),
      this.getMatchSets(match.id),
    ]);

    return {
      id: match.id,
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      matchType: tournament.matchType,
      bestOf: tournament.bestOf,
      scoring: tournament.scoring,
      round: match.round,
      matchOrder: match.match_order,
      status: match.status,
      teamASets: match.team_a_sets,
      teamBSets: match.team_b_sets,
      sets,
      sideA,
      sideB,
      winnerTeamId: match.winner_team_id,
      createdAt: match.created_at,
      updatedAt: match.updated_at,
    };
  }

  public async completeSet(data: CompleteTournamentSet): Promise<void> {
    const match = await this.getMatchById(data.matchId);
    if (!match) {
      throw new Error("Match not found");
    }
    if (!match.sideA || !match.sideB) {
      throw new Error("Both sides must be assigned before scoring");
    }

    const sideA = match.sideA;
    const sideB = match.sideB;

    await this.database.withTransactionAsync(async () => {
      const now = nowIso();

      await this.database.runAsync(
        `
        INSERT INTO tournament_match_sets (
          id, tournament_match_id, set_number, team_a_score, team_b_score, created_at, updated_at, dirty
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT (tournament_match_id, set_number) DO UPDATE SET
          team_a_score = excluded.team_a_score,
          team_b_score = excluded.team_b_score,
          deleted_at = NULL,
          updated_at = excluded.updated_at,
          dirty = 1;
        `,
        [newId(), data.matchId, data.setNumber, data.teamAScore, data.teamBScore, now, now],
      );

      const winnerTeamId = data.matchComplete
        ? data.winner === "A"
          ? sideA.id
          : sideB.id
        : match.winnerTeamId;
      const nextStatus: TournamentMatchStatus = data.matchComplete
        ? "concluded"
        : "ongoing";

      await this.database.runAsync(
        `
        UPDATE tournament_matches
        SET team_a_sets = ?, team_b_sets = ?, status = ?, winner_team_id = ?, updated_at = ?, dirty = 1
        WHERE id = ?;
        `,
        [data.teamASets, data.teamBSets, nextStatus, winnerTeamId, now, data.matchId],
      );

      if (match.status === "upcoming" || match.status === "ongoing") {
        const tournament = await this.getById(match.tournamentId);
        if (
          tournament &&
          (tournament.status === "draft" || tournament.status === "upcoming")
        ) {
          await this.updateTournamentStatus(match.tournamentId, "ongoing");
        }
      }

      if (data.matchComplete) {
        const remaining = await this.database.getFirstAsync<{ count: number }>(
          `
          SELECT COUNT(*) as count
          FROM tournament_matches
          WHERE tournament_id = ? AND status != 'concluded' AND deleted_at IS NULL;
          `,
          [match.tournamentId],
        );

        if ((remaining?.count ?? 0) === 0) {
          await this.updateTournamentStatus(match.tournamentId, "concluded");
        }
      }
    });
  }

  private async getTeam(teamId: string | null): Promise<BracketTeam | null> {
    if (teamId === null) return null;

    const team = await this.database.getFirstAsync<{ id: string; name: string | null }>(
      `SELECT id, name FROM tournament_teams WHERE id = ? AND deleted_at IS NULL;`,
      [teamId],
    );
    const players = await this.database.getAllAsync<{ name: string }>(
      `
      SELECT tp.name
      FROM tournament_team_players ttp
      JOIN tournament_players tp ON tp.id = ttp.tournament_player_id
      WHERE ttp.tournament_team_id = ? AND ttp.deleted_at IS NULL AND tp.deleted_at IS NULL;
      `,
      [teamId],
    );

    return {
      id: teamId,
      name: team?.name ?? players.map((player) => player.name).join(" / "),
      playerNames: players.map((player) => player.name),
    };
  }

  private async getMatchSets(matchId: string): Promise<TournamentMatchSet[]> {
    const sets = await this.database.getAllAsync<{
      set_number: number;
      team_a_score: number;
      team_b_score: number;
    }>(
      `
      SELECT set_number, team_a_score, team_b_score
      FROM tournament_match_sets
      WHERE tournament_match_id = ? AND deleted_at IS NULL
      ORDER BY set_number;
      `,
      [matchId],
    );

    return sets.map((set) => ({
      setNumber: set.set_number,
      teamAScore: set.team_a_score,
      teamBScore: set.team_b_score,
    }));
  }


//



public async getStandings(tournamentId: string): Promise<StandingsRow[]> {
  const teams = await this.database.getAllAsync<{ id: string; name: string | null }>(
    `SELECT id, name FROM tournament_teams WHERE tournament_id = ? AND deleted_at IS NULL;`,
    [tournamentId],
  );

  const rows: StandingsRow[] = [];

  for (const team of teams) {
    const matches = await this.database.getAllAsync<{
      status: TournamentMatchStatus;
      winner_team_id: string | null;
    }>(
      `
      SELECT status, winner_team_id
      FROM tournament_matches
      WHERE tournament_id = ?
        AND (side_a_team_id = ? OR side_b_team_id = ?)
        AND status = 'concluded'
        AND deleted_at IS NULL;
      `,
      [tournamentId, team.id, team.id],
    );

    let wins = 0, losses = 0, ties = 0;
    for (const m of matches) {
      if (m.winner_team_id === team.id) wins++;
      else if (m.winner_team_id === null) ties++;
      else losses++;
    }

    const points = await this.database.getFirstAsync<{ pointsFor: number | null; pointsAgainst: number | null }>(
      `
      SELECT
        SUM(CASE WHEN tm.side_a_team_id = ? THEN s.team_a_score ELSE s.team_b_score END) AS pointsFor,
        SUM(CASE WHEN tm.side_a_team_id = ? THEN s.team_b_score ELSE s.team_a_score END) AS pointsAgainst
      FROM tournament_match_sets s
      JOIN tournament_matches tm ON tm.id = s.tournament_match_id
      WHERE tm.tournament_id = ? AND (tm.side_a_team_id = ? OR tm.side_b_team_id = ?)
        AND tm.deleted_at IS NULL AND s.deleted_at IS NULL;
      `,
      [team.id, team.id, tournamentId, team.id, team.id],
    );

    const pointsFor = points?.pointsFor ?? 0;
    const pointsAgainst = points?.pointsAgainst ?? 0;

    rows.push({
      teamId: team.id,
      name: team.name ?? "Unknown",
      wins,
      losses,
      ties,
      played: wins + losses + ties,
      pointsFor,
      pointsAgainst,
      pointDiff: pointsFor - pointsAgainst,
    });
  }

  return rows.sort((a, b) => b.wins - a.wins || b.pointDiff - a.pointDiff);
}


}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * Circle-method round robin scheduling. Returns rounds, each a list of
 * [teamAId, teamBId] pairs. Odd team counts get a bye automatically (that
 * team sits out whichever round it lands opposite the phantom slot).
 */
function buildRoundRobinRounds<T>(teamIds: T[]): Array<Array<[T, T]>> {
  const hasBye = teamIds.length % 2 !== 0;
  const list: (T | null)[] = hasBye ? [...teamIds, null] : [...teamIds];
  const numTeams = list.length;
  const numRounds = numTeams - 1;
  const half = numTeams / 2;

  let arr = [...list];
  const rounds: Array<Array<[T, T]>> = [];

  for (let round = 0; round < numRounds; round++) {
    const roundMatches: Array<[T, T]> = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i];
      const b = arr[numTeams - 1 - i];
      if (a !== null && b !== null) {
        roundMatches.push([a, b]);
      }
    }
    rounds.push(roundMatches);

    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr = [fixed, ...rest];
  }

  return rounds;
}


///
