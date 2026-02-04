import { useEffect, useRef, useState } from 'react';

export interface StatusEvent {
  type: 'connected' | 'check-in' | 'check-out';
  anonymousId?: string;
  checkInId?: string;
  timestamp: string;
}

export interface UseStatusEventsOptions {
  anonymousId: string | null;
  onStatusChange?: (event: StatusEvent) => void;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
}

/**
 * React hook for listening to real-time status changes via SSE
 */
export function useStatusEvents({
  anonymousId,
  onStatusChange,
  reconnectDelay = 1000,
  maxReconnectDelay = 30000,
}: UseStatusEventsOptions) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentDelayRef = useRef(reconnectDelay);

  useEffect(() => {
    if (!anonymousId) {
      return;
    }

    let isActive = true;

    const connect = () => {
      if (!isActive || !anonymousId) return;

      try {
        const eventSource = new EventSource(`/api/events/status?anonymousId=${anonymousId}`);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setConnected(true);
          setError(null);
          currentDelayRef.current = reconnectDelay; // Reset delay on successful connection
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as StatusEvent;
            
            if (data.type !== 'connected' && onStatusChange) {
              onStatusChange(data);
            }
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };

        eventSource.onerror = () => {
          setConnected(false);
          setError('Connection lost');
          eventSource.close();
          
          // Reconnect with exponential backoff
          if (isActive) {
            const delay = Math.min(currentDelayRef.current, maxReconnectDelay);
            reconnectTimeoutRef.current = setTimeout(() => {
              currentDelayRef.current = Math.min(currentDelayRef.current * 2, maxReconnectDelay);
              connect();
            }, delay);
          }
        };
      } catch (err) {
        setError('Failed to connect');
        console.error('SSE connection error:', err);
      }
    };

    connect();

    return () => {
      isActive = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      setConnected(false);
    };
  }, [anonymousId, onStatusChange, reconnectDelay, maxReconnectDelay]);

  return { connected, error };
}
