/**
 * Simple in-memory event broadcaster for SSE
 * Suitable for single-instance deployments
 */

type EventListener = (data: unknown) => void;

class EventBroadcaster {
  private listeners: Map<string, Set<EventListener>> = new Map();

  /**
   * Subscribe to events for a specific channel
   */
  subscribe(channel: string, listener: EventListener): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    
    this.listeners.get(channel)!.add(listener);

    // Return unsubscribe function
    return () => {
      const channelListeners = this.listeners.get(channel);
      if (channelListeners) {
        channelListeners.delete(listener);
        if (channelListeners.size === 0) {
          this.listeners.delete(channel);
        }
      }
    };
  }

  /**
   * Broadcast an event to all listeners on a channel
   */
  broadcast(channel: string, data: unknown): void {
    const channelListeners = this.listeners.get(channel);
    if (channelListeners) {
      channelListeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  /**
   * Get the number of active listeners for a channel
   */
  getListenerCount(channel: string): number {
    return this.listeners.get(channel)?.size || 0;
  }

  /**
   * Get total number of channels
   */
  getChannelCount(): number {
    return this.listeners.size;
  }
}

// Singleton instance
export const eventBroadcaster = new EventBroadcaster();

// Event types
export interface CheckInStatusEvent {
  type: 'check-in' | 'check-out';
  anonymousId: string;
  checkInId?: string;
  timestamp: string;
}

/**
 * Broadcast a check-in status change
 */
export function broadcastStatusChange(event: CheckInStatusEvent): void {
  // Broadcast to the specific user's channel
  eventBroadcaster.broadcast(`user:${event.anonymousId}`, event);
  
  // Also broadcast to a global channel for dashboard updates
  eventBroadcaster.broadcast('global', event);
}
