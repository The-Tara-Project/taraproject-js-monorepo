import type { TaraStack } from '../tara-project';
import { TaraRecord } from '../base/record';
import type { ITaraRecord } from '../base/types';

/**
 * RecordManager provides operations for creating and managing Tara records.
 */
export class RecordManager {
  constructor(private context: TaraStack) {}

  /**
   * Create a new TaraRecord with auto-generated UUID.
   *
   * @param content - The content to wrap in a TaraRecord
   * @returns A new TaraRecord instance
   */
  create<T extends Record<string, unknown> = Record<string, unknown>>(content: T): TaraRecord<T> {
    return new TaraRecord(content);
  }

  /**
   * Parse TaraRecord from plain object.
   *
   * @param obj - A plain object with __tara.id field
   * @returns A TaraRecord instance
   * @throws Error if object is invalid
   */
  fromObject<T extends Record<string, unknown>>(obj: T & { __tara: { id: string } }): TaraRecord<T> {
    return TaraRecord.fromObject(obj);
  }

  /**
   * Parse TaraRecord from JSON string.
   *
   * @param json - A JSON string representing a TaraRecord
   * @returns A TaraRecord instance
   * @throws Error if JSON is invalid
   */
  fromJSON<T extends Record<string, unknown>>(json: string): TaraRecord<T> {
    return TaraRecord.fromJSON(json);
  }

  /**
   * Validate if object is a valid TaraRecord.
   *
   * @param obj - Any object to validate
   * @returns true if the object is a valid TaraRecord structure
   */
  validate(obj: any): obj is ITaraRecord {
    return TaraRecord.isValid(obj);
  }
}
