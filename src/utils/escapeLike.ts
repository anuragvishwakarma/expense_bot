// A user- or model-supplied name used with .ilike() must match literally: % and _ are wildcards and
// \ is the escape character, so "100%" or "a_b" would otherwise match the wrong category.
export const escapeLike = (s: string): string => s.replace(/[\\%_]/g, c => `\\${c}`);
