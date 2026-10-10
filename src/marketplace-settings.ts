// The marketplace keys of a settings file, with their aliases. A rule that reads
// `extraKnownMarketplaces` or `strictKnownMarketplaces` asks here, so that it
// reads the key as Claude Code reads it.
import { MARKETPLACE_KEY_ALIASES } from './data/settings-keys.ts'
import { lastMember, type MemberNode, type ValueNode } from './marketplace-json.ts'

/** A marketplace key that has an alias. */
export type MarketplaceKey = (typeof MARKETPLACE_KEY_ALIASES)[keyof typeof MARKETPLACE_KEY_ALIASES]

const ALIAS_OF = new Map<string, string>(
  Object.entries(MARKETPLACE_KEY_ALIASES).map(([alias, key]) => [key, alias]),
)

/** The last member that Claude Code reads for `key` in `body`. It is the member
 *  `key`, or the member of its alias when `key` is not there. With both
 *  spellings in one file, Claude Code uses the canonical key and ignores the
 *  alias (the settings reference, "Marketplace key aliases"). */
export function marketplaceMember(
  body: ValueNode | undefined,
  key: MarketplaceKey,
): MemberNode | undefined {
  return lastMember(body, key) ?? lastMember(body, ALIAS_OF.get(key) ?? key)
}
