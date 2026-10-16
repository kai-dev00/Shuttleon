import { SQLiteDatabase } from "expo-sqlite";
import { newId, nowIso } from "../ids";

export type QuickMatchSet = {
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
};

export type QuickMatch = {
  id: string;
  matchType: "singles" | "doubles";
  bestOf: number;
  scoring: number;
  rematchNumber: number;
  teamASets: number;
  teamBSets: number;
  sets: QuickMatchSet[];
  status: "upcoming" | "ongoing" | "concluded";
  teamAName: string;
  teamBName: string;
  teamA: string[];
  teamB: string[];
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
};

type QuickMatchPlayer = {
  id: string;
  quick_match_id: string;
  team: "A" | "B";
  player_order: number;
  name: string;
};

type QuickMatchRow = {
  id: string;
  match_type: "singles" | "doubles";
  best_of: number;
  scoring: number;
  rematch_number: number;
  team_a_sets: number;
  team_b_sets: number;
  status: "upcoming" | "ongoing" | "concluded";
  ended_at: string | null;
  team_a_name: string;
  team_b_name: string;
  created_at: string;
  updated_at: string;
};

export type CreateQuickMatch = {
  matchType: "singles" | "doubles";
  bestOf: number;
  scoring: number;
  teamAName: string;
  teamBName: string;
  teamA: string[];
  teamB: string[];
};

const MATCH_COLUMNS = `
  id, match_type, best_of, scoring, rematch_number, team_a_sets, team_b_sets,
  status, ended_at, team_a_name, team_b_name, created_at, updated_at
`;

export class QuickMatchRepository {
  constructor(private readonly database: SQLiteDatabase) {}

  public async getAll(): Promise<QuickMatch[]> {
    const matches = await this.database.getAllAsync<QuickMatchRow>(
      `SELECT ${MATCH_COLUMNS} FROM quick_matches WHERE deleted_at IS NULL ORDER BY created_at DESC;`,
    );

    return Promise.all(matches.map((match) => this.toQuickMatch(match)));
  }

  public async getById(id: string): Promise<QuickMatch | null> {
    const match = await this.database.getFirstAsync<QuickMatchRow>(
      `SELECT ${MATCH_COLUMNS} FROM quick_matches WHERE id = ? AND deleted_at IS NULL;`,
      [id],
    );

    return match ? this.toQuickMatch(match) : null;
  }

  private async toQuickMatch(match: QuickMatchRow): Promise<QuickMatch> {
    const [players, sets] = await Promise.all([
      this.getPlayers(match.id),
      this.getSetHistory(match.id),
    ]);

    return {
      id: match.id,
      matchType: match.match_type,
      bestOf: match.best_of,
      scoring: match.scoring,
      rematchNumber: match.rematch_number,
      teamASets: match.team_a_sets,
      teamBSets: match.team_b_sets,
      sets,
      status: match.status,
      teamAName: match.team_a_name,
      teamBName: match.team_b_name,
      teamA: players
        .filter((player) => String(player.team).toUpperCase() === "A")
        .map((player) => player.name),
      teamB: players
        .filter((player) => String(player.team).toUpperCase() === "B")
        .map((player) => player.name),
      createdAt: match.created_at,
      updatedAt: match.updated_at,
      endedAt: match.ended_at,
    };
  }

  private getPlayers(quickMatchId: string): Promise<QuickMatchPlayer[]> {
    return this.database.getAllAsync<QuickMatchPlayer>(
      `
      SELECT id, quick_match_id, team, player_order, name
      FROM quick_match_players
      WHERE quick_match_id = ? AND deleted_at IS NULL
      ORDER BY player_order;
      `,
      [quickMatchId],
    );
  }

  private async getSetHistory(quickMatchId: string): Promise<QuickMatchSet[]> {
    const sets = await this.database.getAllAsync<{
      set_number: number;
      team_a_score: number;
      team_b_score: number;
    }>(
      `
      SELECT set_number, team_a_score, team_b_score
      FROM quick_match_sets
      WHERE quick_match_id = ? AND deleted_at IS NULL
      ORDER BY set_number;
      `,
      [quickMatchId],
    );

    return sets.map((set) => ({
      setNumber: set.set_number,
      teamAScore: set.team_a_score,
      teamBScore: set.team_b_score,
    }));
  }

  public async create(data: CreateQuickMatch): Promise<string> {
    const id = newId();

    await this.database.withTransactionAsync(async () => {
      await this.insertMatch(id, data, 0);
      await this.syncPlayers(id, data);
    });

    return id;
  }

  public async createRematch(id: string): Promise<string> {
    const original = await this.getById(id);

    if (!original) {
      throw new Error("Match not found");
    }

    const rematchId = newId();

    await this.database.withTransactionAsync(async () => {
      await this.insertMatch(rematchId, original, original.rematchNumber + 1);
      await this.syncPlayers(rematchId, original);
    });

    return rematchId;
  }

  private async insertMatch(
    id: string,
    data: Pick<
      CreateQuickMatch,
      "matchType" | "bestOf" | "scoring" | "teamAName" | "teamBName"
    >,
    rematchNumber: number,
  ) {
    const now = nowIso();

    await this.database.runAsync(
      `
      INSERT INTO quick_matches (
        id, match_type, best_of, scoring, rematch_number,
        team_a_name, team_b_name, status, created_at, updated_at, dirty
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, 1);
      `,
      [
        id,
        data.matchType,
        data.bestOf,
        data.scoring,
        rematchNumber,
        data.teamAName,
        data.teamBName,
        now,
        now,
      ],
    );
  }

  public async update(id: string, data: CreateQuickMatch): Promise<void> {
    await this.database.withTransactionAsync(async () => {
      await this.database.runAsync(
        `
        UPDATE quick_matches
        SET
          match_type = ?,
          best_of = ?,
          scoring = ?,
          team_a_name = ?,
          team_b_name = ?,
          updated_at = ?,
          dirty = 1
        WHERE id = ?;
        `,
        [
          data.matchType,
          data.bestOf,
          data.scoring,
          data.teamAName,
          data.teamBName,
          nowIso(),
          id,
        ],
      );

      await this.syncPlayers(id, data);
    });
  }

  /**
   * Makes the stored players match `data`, keeping existing rows (and their ids) where the
   * team/position is unchanged, inserting new ones and tombstoning ones that are gone.
   * Must run inside a transaction.
   */
  private async syncPlayers(
    matchId: string,
    data: Pick<CreateQuickMatch, "teamA" | "teamB">,
  ): Promise<void> {
    const now = nowIso();
    const existing = await this.getPlayers(matchId);
    const byKey = new Map(
      existing.map((player) => [`${player.team}:${player.player_order}`, player]),
    );
    const wanted = new Set<string>();

    const teams = [
      { team: "A" as const, players: data.teamA },
      { team: "B" as const, players: data.teamB },
    ];

    for (const { team, players } of teams) {
      for (let index = 0; index < players.length; index++) {
        const order = index + 1;
        const key = `${team}:${order}`;
        wanted.add(key);
        const current = byKey.get(key);

        if (!current) {
          await this.database.runAsync(
            `
            INSERT INTO quick_match_players (
              id, quick_match_id, team, player_order, name, created_at, updated_at, dirty
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 1);
            `,
            [newId(), matchId, team, order, players[index], now, now],
          );
        } else if (current.name !== players[index]) {
          await this.database.runAsync(
            `UPDATE quick_match_players SET name = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
            [players[index], now, current.id],
          );
        }
      }
    }

    for (const [key, player] of byKey) {
      if (wanted.has(key)) continue;
      await this.database.runAsync(
        `UPDATE quick_match_players SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
        [now, now, player.id],
      );
    }
  }

  public async updateStatus(id: string, status: QuickMatch["status"]) {
    const now = nowIso();

    await this.database.runAsync(
      `
      UPDATE quick_matches
      SET
        status = ?,
        ended_at = CASE WHEN ? = 'concluded' THEN ? ELSE ended_at END,
        updated_at = ?,
        dirty = 1
      WHERE id = ?;
      `,
      [status, status, now, now, id],
    );
  }

  public async updateSetScore(
    id: string,
    teamASets: number,
    teamBSets: number,
  ): Promise<void> {
    await this.database.runAsync(
      `
      UPDATE quick_matches
      SET team_a_sets = ?, team_b_sets = ?, updated_at = ?, dirty = 1
      WHERE id = ?;
      `,
      [teamASets, teamBSets, nowIso(), id],
    );
  }

  /** Upserts one set's score, keeping the row (and its id) if the set already exists. */
  public async recordSetScore(
    id: string,
    setNumber: number,
    teamAScore: number,
    teamBScore: number,
  ): Promise<void> {
    const now = nowIso();

    await this.database.runAsync(
      `
      INSERT INTO quick_match_sets (
        id, quick_match_id, set_number, team_a_score, team_b_score, created_at, updated_at, dirty
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT (quick_match_id, set_number) DO UPDATE SET
        team_a_score = excluded.team_a_score,
        team_b_score = excluded.team_b_score,
        deleted_at = NULL,
        updated_at = excluded.updated_at,
        dirty = 1;
      `,
      [newId(), id, setNumber, teamAScore, teamBScore, now, now],
    );
  }

  /** Soft delete: tombstones the match and its children so the delete can sync. */
  public async delete(id: string) {
    const now = nowIso();

    await this.database.withTransactionAsync(async () => {
      for (const table of ["quick_match_players", "quick_match_sets"]) {
        await this.database.runAsync(
          `UPDATE ${table} SET deleted_at = ?, updated_at = ?, dirty = 1
           WHERE quick_match_id = ? AND deleted_at IS NULL;`,
          [now, now, id],
        );
      }

      await this.database.runAsync(
        `UPDATE quick_matches SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?;`,
        [now, now, id],
      );
    });
  }
}
