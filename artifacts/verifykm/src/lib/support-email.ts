/** Character codes — avoids a plain address literal in the client bundle. */
const LOCAL = [105, 110, 102, 111] as const;
const DOMAIN = [118, 101, 114, 105, 102, 121, 107, 109, 46, 99, 111, 109] as const;

export function getSupportEmail(): string {
  return `${String.fromCharCode(...LOCAL)}@${String.fromCharCode(...DOMAIN)}`;
}
