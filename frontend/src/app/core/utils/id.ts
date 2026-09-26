export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Số ngày từ mốc tới hôm nay, âm nếu mốc ở tương lai */
export function daysSince(dateIso: string): number {
  if (!dateIso) return 0;
  const start = new Date(dateIso).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.floor((Date.now() - start) / 86_400_000);
}
