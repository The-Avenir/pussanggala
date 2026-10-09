export function osaDistance(a: string, b: string, max = Infinity): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  let beforePrevious = previous;
  for (let i = 1; i <= a.length; i++) {
    const current = Array<number>(b.length + 1).fill(Infinity);
    current[0] = i;
    let minimum = i;
    const start = Math.max(1, i - max);
    const end = Math.min(b.length, i + max);
    for (let j = start; j <= end; j++) {
      current[j] = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        current[j] = Math.min(current[j]!, beforePrevious[j - 2]! + 1);
      }
      minimum = Math.min(minimum, current[j]!);
    }
    if (minimum > max) return max + 1;
    beforePrevious = previous;
    previous = current;
  }
  const distance = previous[b.length]!;
  return distance > max ? max + 1 : distance;
}
