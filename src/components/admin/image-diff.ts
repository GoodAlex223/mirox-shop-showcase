/** Mirrors ImageUploader's ImageItem — id present = persisted ProductImage row. */
export interface AdminImage {
  id?: string;
  url: string;
  alt?: string;
  isNew?: boolean;
}

export interface ImageChanges {
  added: AdminImage[];
  removedIds: string[];
  orderChanged: boolean;
}

/**
 * G16: the persistence wrapper's decision function. Adds = items without an
 * id; removals = persisted ids absent from `next`; a reorder is only reported
 * when the persisted-id sequence changed with NO add/remove in the same
 * change (the uploader emits one onChange per drag-over).
 */
export function diffImages(prev: AdminImage[], next: AdminImage[]): ImageChanges {
  const nextIds = next.filter((i) => i.id).map((i) => i.id as string);
  const prevIds = prev.filter((i) => i.id).map((i) => i.id as string);
  const added = next.filter((i) => !i.id);
  const removedIds = prevIds.filter((id) => !nextIds.includes(id));
  const sameMembers = added.length === 0 && removedIds.length === 0;
  const orderChanged = sameMembers && prevIds.some((id, index) => nextIds[index] !== id);
  return { added, removedIds, orderChanged };
}
