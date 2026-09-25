export function formatAccidentCount(t: (key: string) => string, count: number): string {
  const key = count === 1 ? "accident_count_one" : "accidents_count";
  const template = t(key);
  return template.replace("{count}", String(count));
}
