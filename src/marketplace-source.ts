// The reader of the source of a relative plugin entry in `marketplace.json`.
import type { DocumentNode, ObjectNode } from './marketplace-json.ts'

/** What a rule sees at the source of an entry. */
export type SourceRead =
  | { kind: 'not-relative' }
  | { kind: 'missing' }
  | { kind: 'not-directory' }
  | { kind: 'escapes' }
  | { kind: 'unreadable' }
  | { kind: 'no-manifest' }
  | { kind: 'manifest'; manifest: Record<string, unknown> }

export function sourceReader(
  _file: string,
  _document: DocumentNode,
): (entry: ObjectNode) => SourceRead {
  return () => ({ kind: 'not-relative' })
}
