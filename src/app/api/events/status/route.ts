import { NextRequest } from 'next/server';
import { eventBroadcaster } from '@/lib/events/broadcaster';

/**
 * GET /api/events/status?anonymousId=xxx
 * Server-Sent Events endpoint for real-time status updates
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const anonymousId = searchParams.get('anonymousId');

  if (!anonymousId) {
    return new Response('anonymousId is required', { status: 400 });
  }

  // Create a new ReadableStream for SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const welcome = `data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`;
      controller.enqueue(encoder.encode(welcome));

      // Subscribe to user-specific events
      const unsubscribe = eventBroadcaster.subscribe(`user:${anonymousId}`, (data) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      });

      // Keep-alive ping every 30 seconds
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          // Stream already closed
          clearInterval(keepAlive);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        unsubscribe();
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
