/** 解析 PATCH JSON 中的數字欄位：undefined 表示不更新，null 表示清空 */
export function parseOptionalNumber(
  v: unknown,
): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}
