// The retained client hashes growthbook feature names before looking them up
// in the bootstrap payload (`Mf` in the shared chunk): a Java-style string
// hash rendered as an unsigned decimal string. Seeding a gate therefore
// requires keying it by this hash; use this helper so gates stay readable at
// the definition site.
export function growthbookFeatureKey(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash &= hash;
  }
  return ((4294967295 & hash) >>> 0).toString();
}
