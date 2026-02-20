/**
 * Event system for Engram
 * Simple typed event emitter
 */

import { EventEmitter } from 'events';
import type { Memory, RejectedInfo, MergeResult } from './types.js';

export interface EngramEventMap {
  stored: [memory: Memory];
  rejected: [info: RejectedInfo];
  recalled: [memories: Memory[], query: string];
  forgotten: [ids: string[], count: number];
  merged: [result: MergeResult];
  error: [error: Error];
  warning: [message: string];
}

export type EngramEventName = keyof EngramEventMap;

/**
 * Typed event emitter for Engram events
 */
export class EngramEmitter extends EventEmitter {
  emit<K extends EngramEventName>(event: K, ...args: EngramEventMap[K]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends EngramEventName>(
    event: K,
    listener: (...args: EngramEventMap[K]) => void
  ): this {
    return super.on(event, listener);
  }

  once<K extends EngramEventName>(
    event: K,
    listener: (...args: EngramEventMap[K]) => void
  ): this {
    return super.once(event, listener);
  }

  off<K extends EngramEventName>(
    event: K,
    listener: (...args: EngramEventMap[K]) => void
  ): this {
    return super.off(event, listener);
  }
}
