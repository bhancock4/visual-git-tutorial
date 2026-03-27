let counter = 0;

/**
 * Generate a deterministic 7-char hex hash from content.
 * Uses a simple djb2 hash + counter for uniqueness.
 */
export function generateHash(content: string): string {
  let hash = 5381;
  const str = content + (counter++);
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash).toString(16).padStart(7, '0').slice(0, 7);
}

export function resetHashCounter(): void {
  counter = 0;
}
