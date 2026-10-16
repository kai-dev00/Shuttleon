import { supabase } from "@/lib/supabase";
import type { Remote } from "./syncEngine";

/** Talks to the Supabase tables created by supabase/migrations. RLS scopes every call to the signed-in user. */
export const supabaseRemote: Remote = {
  async upsert(table, rows) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  },

  async fetchChanged(table, after, limit) {
    let query = supabase.from(table).select("*");

    if (after) {
      // Keyset pagination on (updated_at, id) so rows sharing a timestamp are never skipped.
      query = query.or(
        `updated_at.gt.${after.updatedAt},and(updated_at.eq.${after.updatedAt},id.gt.${after.id})`,
      );
    }

    const { data, error } = await query
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(limit);

    if (error) throw new Error(`${table}: ${error.message}`);
    return data ?? [];
  },
};
