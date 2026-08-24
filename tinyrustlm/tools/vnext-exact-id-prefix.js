"use strict";

function classifyExactIdPrefix(currentIds, baseIds, descendants) {
  if (!Array.isArray(currentIds) || !Array.isArray(baseIds) ||
      !Array.isArray(descendants) ||
      [...currentIds, ...baseIds, ...descendants].some((entry) =>
        typeof entry !== "string")) {
    return -1;
  }
  const current = [...currentIds].sort();
  const currentSet = new Set(current);
  const baseSet = new Set(baseIds);
  if (currentSet.size !== current.length || baseSet.size !== baseIds.length) return -1;
  const base = [...baseSet].sort();
  const expected = new Set(base);
  for (const descendant of descendants) {
    if (expected.has(descendant)) return -1;
    expected.add(descendant);
  }
  if (current.length < base.length ||
      current.length > base.length + descendants.length ||
      base.some((baseId) => !currentSet.has(baseId))) {
    return -1;
  }
  const prefix = current.length - base.length;
  for (let index = 0; index < descendants.length; index += 1) {
    if (currentSet.has(descendants[index]) !== (index < prefix)) return -1;
  }
  return prefix;
}

module.exports = Object.freeze({ classifyExactIdPrefix });
