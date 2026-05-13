export function parseNum(v: string): number {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) || n < 0 ? 0 : n
}
