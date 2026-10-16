/** 150000 → "150k", 1200000 → "1,2tr", 500 → "500đ" */
export function shortVnd(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}tr`;
  if (value >= 1000) return `${(value / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}k`;
  return `${value}đ`;
}
