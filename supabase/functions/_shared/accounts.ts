/**
 * Deleting an account for good, shared by litma-account (the writer's own Settings → Delete
 * account) and litma-admin (the owner's /admin/ → Writers). Every Litma table references auth.users
 * with ON DELETE CASCADE, so deleting the auth user removes works, versions, books, Story World,
 * saved words, AI keys, tokens, goals, statistics and community posts; pictures in storage are
 * removed first because storage doesn't cascade.
 */
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

/** Every file under the writer's folder (two levels: avatars/<id>/x, media/<id>/<folder>/x). */
async function removeFiles(db: SupabaseClient, bucket: string, id: string) {
  const paths: string[] = [];
  const { data: top } = await db.storage.from(bucket).list(id, { limit: 1000 });
  for (const f of top ?? []) {
    if (f.id) paths.push(`${id}/${f.name}`);
    else {
      const { data: inner } = await db.storage.from(bucket).list(`${id}/${f.name}`, { limit: 1000 });
      for (const g of inner ?? []) if (g.id) paths.push(`${id}/${f.name}/${g.name}`);
    }
  }
  for (let i = 0; i < paths.length; i += 100) await db.storage.from(bucket).remove(paths.slice(i, i + 100));
}

/** Deletes the account and everything in it. Returns an error message, or null when done. */
export async function deleteAccount(db: SupabaseClient, id: string): Promise<string | null> {
  for (const bucket of ["avatars", "media"]) {
    try {
      await removeFiles(db, bucket, id);
    } catch (e) {
      console.error(`deleteAccount: removing ${bucket} files`, e); // the account is still deleted
    }
  }
  const { error } = await db.auth.admin.deleteUser(id);
  return error ? error.message : null;
}
