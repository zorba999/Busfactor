"use server";

import { revalidatePath } from "next/cache";

/**
 * Drop the cached render of the docket and one repository dossier.
 *
 * Both pages are ISR'd on a 60s window to stay inside Studio's 30 calls per
 * minute. That budget is the right default for visitors, but it is the wrong
 * one for the person who just paid for a verdict: without this they sign a
 * transaction, watch it finalise on chain, and still see the old page.
 */
export async function refreshVerdict(repo: string) {
  revalidatePath("/");

  const [owner, name] = repo.split("/");
  if (owner && name) {
    revalidatePath(
      `/repo/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
    );
  }
}
