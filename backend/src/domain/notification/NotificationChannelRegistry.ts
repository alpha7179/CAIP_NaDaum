// 알림 채널 어댑터 등록소
import type { NotificationChannelAdapter } from '../../adapters/notification/NotificationChannelAdapter.js';

// 알림 채널 어댑터 등록소
export class NotificationChannelRegistry {
  private readonly adapters = new Map<string, NotificationChannelAdapter>();

  register(adapter: NotificationChannelAdapter): void {
    if (adapter === null || adapter === undefined) {
      throw new Error('NotificationChannelRegistry.register: adapter must not be null/undefined');
    }
    const id = adapter.channelId;
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(
        'NotificationChannelRegistry.register: adapter.channelId must be a non-empty string',
      );
    }
    if (typeof adapter.send !== 'function') {
      throw new Error(
        `NotificationChannelRegistry.register: adapter.send must be a function (channelId=${id})`,
      );
    }
    if (this.adapters.has(id)) {
      throw new Error(
        `NotificationChannelRegistry.register: duplicate channelId "${id}" already registered`,
      );
    }
    this.adapters.set(id, adapter);
  }

  getById(id: string): NotificationChannelAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): NotificationChannelAdapter[] {
    return Array.from(this.adapters.values());
  }
}
