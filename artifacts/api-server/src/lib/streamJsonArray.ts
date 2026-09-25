import { createReadStream } from "fs";
import chain from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/stream-array.js";

export type ForEachJsonArrayRecordOptions = {
  maxRows?: number;
};

/**
 * Stream-parse a top-level JSON array without holding the full file in memory.
 * Rejects non-array roots and rows above maxRows.
 */
export async function forEachJsonArrayRecord(
  filePath: string,
  options: ForEachJsonArrayRecordOptions,
  onRecord: (record: unknown) => Promise<void> | void,
): Promise<number> {
  const { maxRows } = options;
  let count = 0;
  const pipeline = chain([
    createReadStream(filePath),
    parser(),
    streamArray(),
  ]);

  try {
    for await (const chunk of pipeline) {
      const value = (chunk as { value?: unknown }).value;
      count += 1;
      if (maxRows != null && count > maxRows) {
        pipeline.destroy();
        throw new Error(`JSON import exceeds the ${maxRows.toLocaleString()}-row limit`);
      }
      await onRecord(value);
    }
  } catch (err) {
    pipeline.destroy();
    const message = String((err as Error).message ?? err);
    if (message.includes("Top-level object should be an array")) {
      throw new Error("Expected a JSON array at the root");
    }
    throw err;
  }

  return count;
}
