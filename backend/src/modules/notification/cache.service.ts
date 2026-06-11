import { Injectable, Logger } from '@nestjs/common';

interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private store: Map<string, CacheItem<any>> = new Map();

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const item: CacheItem<T> = {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : Infinity,
    };
    this.store.set(key, item);
    this.logger.debug(`Cache set: ${key}`);
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) {
      return null;
    }
    if (item.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.logger.debug(`Cache delete: ${key}`);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.store.get(key);
    if (!item) return false;
    if (item.expiresAt < Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const item = this.store.get(key);
    if (item) {
      item.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }

  async hset<T>(key: string, field: string, value: T): Promise<void> {
    const existing = await this.get<Record<string, any>>(key);
    const obj = existing || {};
    obj[field] = value;
    await this.set(key, obj);
  }

  async hget<T>(key: string, field: string): Promise<T | null> {
    const obj = await this.get<Record<string, any>>(key);
    if (!obj) return null;
    return obj[field] as T || null;
  }

  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    return await this.get<Record<string, T>>(key);
  }
}
