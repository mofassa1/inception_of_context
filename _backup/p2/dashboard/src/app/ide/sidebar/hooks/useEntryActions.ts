import { resolveSibling } from "@/shared/lib/path";
import type {
  DirectoryEntry,
  FileTreeCallbacks,
} from "@/shared/types/filesystem";
import { useCreateEntry } from "./useCreateEntry";
import { useDeleteEntry } from "./useDeleteEntry";
import { useRenameEntry } from "./useRenameEntry";

type EntryActionsOptions = Pick<
  FileTreeCallbacks,
  "onPathRemoved" | "onPathRenamed"
>;

export function useEntryActions(
  entry: DirectoryEntry,
  { onPathRemoved, onPathRenamed }: EntryActionsOptions,
) {
  const { createEntry } = useCreateEntry();
  const { deleteEntry } = useDeleteEntry();
  const { renameEntry } = useRenameEntry();

  async function renameTo(nextName: string) {
    if (!nextName || nextName === entry.name) return;

    const nextPath = resolveSibling(entry.path, nextName);

    try {
      await renameEntry({ currentPath: entry.path, nextPath });
      onPathRenamed(entry.path, nextPath);
    } catch (error) {
      alert("Rename failed: " + (error as Error).message);
    }
  }

  async function remove(confirmMessage: string) {
    if (!confirm(confirmMessage)) return;

    try {
      await deleteEntry(entry.path);
      onPathRemoved(entry.path);
    } catch (error) {
      alert("Delete failed: " + (error as Error).message);
    }
  }

  async function createChild(name: string, isDirectory: boolean) {
    if (!name) return false;

    try {
      await createEntry({ entryPath: entry.path + "/" + name, isDirectory });
      return true;
    } catch (error) {
      alert("Couldn't create: " + (error as Error).message);
      return false;
    }
  }

  return { renameTo, remove, createChild };
}
