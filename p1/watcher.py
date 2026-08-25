# watcher.py (core sync logic, called both by initial index and by file events)

def sync_file(filepath: str, target_root: str, store: ChunkStore, embedder: Embedder):
    rel_path = os.path.relpath(filepath, target_root)

    if not os.path.exists(filepath):
        # FILE DELETED
        old = store.get_by_file(rel_path)
        store.delete(list(old.keys()))
        log_activity(f"deleted {rel_path} ({len(old)} chunks removed)")
        return

    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        source = f.read()

    new_chunks = chunk_file(filepath, rel_path, source)  # dispatches to python/regex chunker
    old_meta = store.get_by_file(rel_path)

    new_ids = {c.id for c in new_chunks}
    old_ids = set(old_meta.keys())

    to_delete = old_ids - new_ids
    store.delete(list(to_delete))
    

    to_embed = []
    for c in new_chunks:
        new_hash = hash_chunk(c.content)
        old_hash = old_meta.get(c.id, {}).get("content_hash")
        if new_hash != old_hash:          # covers BOTH "new chunk" and "changed chunk"
            to_embed.append(c)

    if to_embed:
        embeddings = embedder.embed([c.content for c in to_embed])
        store.upsert(to_embed, embeddings)

    log_activity(
        f"{rel_path}: +{len([c for c in to_embed if c.id not in old_ids])} "
        f"~{len([c for c in to_embed if c.id in old_ids])} "
        f"-{len(to_delete)}"
    )