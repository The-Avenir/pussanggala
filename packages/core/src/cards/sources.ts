import type { NoteView, SourceRef } from "../contracts/cards";
import { recordKey, type Pack } from "../pack/types";
import type { RecordKind } from "../schema/pack";

export interface RecordRef {
  kind: RecordKind;
  id: string;
}

export function sourceRefs(pack: Pack, records: RecordRef[], now: Date): SourceRef[] {
  const ids = new Set(records.flatMap((record) => (pack.sourcesByRecord.get(recordKey(record.kind, record.id)) ?? []).map((link) => link.source_id)));
  return [...ids].sort().map((id) => {
    const source = pack.sources.get(id)!;
    const ref: SourceRef = { sourceId: id, kind: source.kind, stale: false };
    if (source.url !== null) ref.url = source.url;
    if (source.posted_at !== null) {
      ref.postedAt = source.posted_at;
      const posted = Date.parse(source.posted_at);
      if (Number.isFinite(posted)) {
        ref.ageDays = Math.floor((now.getTime() - posted) / 86_400_000);
        ref.stale = ref.ageDays > pack.manifest.stale_after_days;
      }
    }
    return ref;
  });
}

export function noteView(pack: Pack, noteId: string, now: Date): NoteView {
  const note = pack.notes.get(noteId)!;
  return { noteId, kind: note.kind, body: note.body, sources: sourceRefs(pack, [{ kind: "note", id: noteId }], now) };
}
