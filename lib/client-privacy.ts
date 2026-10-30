export function clearAccountDrafts(userId: string, storage?: Pick<Storage, 'removeItem'>): boolean {
  if (!userId) return false;
  try {
    (storage ?? localStorage).removeItem(`clareia-drafts:${userId}`);
    return true;
  } catch {
    // Private browsing can deny access to local storage.
    return false;
  }
}
