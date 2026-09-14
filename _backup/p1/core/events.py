import queue
import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Iterator

from p1.core.logging import get_logger

logger = get_logger(__name__)

MAX_QUEUED_EVENTS = 256
KEEPALIVE_SECONDS = 15.0
MAX_CONSECUTIVE_DROPS = 32


@dataclass
class Subscriber:
    id: str
    channel: queue.Queue = field(
        default_factory=lambda: queue.Queue(maxsize=MAX_QUEUED_EVENTS)
    )
    dropped_total: int = 0
    dropped_in_a_row: int = 0
    evicted: bool = False


class EventBus:
    """Fan-out of index events to SSE subscribers.

    A subscriber that stops draining its queue must never block or silently
    lose the feed: the oldest event is evicted to make room, every drop is
    counted and logged, and a persistently full subscriber is disconnected.
    """

    def __init__(self, max_consecutive_drops: int = MAX_CONSECUTIVE_DROPS) -> None:
        self._lock = threading.Lock()
        self._subscribers: dict[str, Subscriber] = {}
        self._max_consecutive_drops = max_consecutive_drops

    def publish(self, kind: str, path: str, chunk_count: int = 0) -> None:
        event = {
            "id": uuid.uuid4().hex,
            "kind": kind,
            "path": path,
            "chunkCount": chunk_count,
            "at": time.time(),
        }

        with self._lock:
            subscribers = list(self._subscribers.values())

        for subscriber in subscribers:
            self._deliver(subscriber, event)

    def _deliver(self, subscriber: Subscriber, event: dict) -> None:
        try:
            subscriber.channel.put_nowait(event)
            subscriber.dropped_in_a_row = 0
            return
        except queue.Full:
            pass

        try:
            subscriber.channel.get_nowait()
            subscriber.channel.put_nowait(event)
            subscriber.dropped_total += 1
            subscriber.dropped_in_a_row += 1
            logger.warning(
                "subscriber %s is not draining; dropped oldest event "
                "(%d dropped, %d consecutive)",
                subscriber.id,
                subscriber.dropped_total,
                subscriber.dropped_in_a_row,
            )
        except (queue.Empty, queue.Full):
            subscriber.dropped_total += 1
            subscriber.dropped_in_a_row += 1
            logger.warning(
                "subscriber %s could not accept event %s (%d dropped)",
                subscriber.id,
                event["id"],
                subscriber.dropped_total,
            )

        if subscriber.dropped_in_a_row >= self._max_consecutive_drops:
            self.evict(
                subscriber.id,
                reason=f"{subscriber.dropped_in_a_row} consecutive dropped events",
            )

    def evict(self, subscriber_id: str, reason: str) -> None:
        with self._lock:
            subscriber = self._subscribers.pop(subscriber_id, None)

        if subscriber is None:
            return

        subscriber.evicted = True
        logger.warning("evicting subscriber %s: %s", subscriber_id, reason)

        try:
            subscriber.channel.put_nowait(None)
        except queue.Full:
            logger.debug("subscriber %s queue full while signalling eviction", subscriber_id)

    def subscribe(self) -> Iterator[dict | None]:
        """Register immediately, then return the stream.

        Registration must not be deferred to the first iteration the way a bare
        generator would, or events published between subscribing and the first
        read are lost.
        """
        subscriber = Subscriber(id=uuid.uuid4().hex[:8])

        with self._lock:
            self._subscribers[subscriber.id] = subscriber

        logger.info(
            "subscriber %s connected (%d total)",
            subscriber.id,
            self.subscriber_count(),
        )

        return self._stream(subscriber)

    def _stream(self, subscriber: Subscriber) -> Iterator[dict | None]:
        try:
            while not subscriber.evicted:
                try:
                    event = subscriber.channel.get(timeout=KEEPALIVE_SECONDS)
                except queue.Empty:
                    yield None
                    continue

                if event is None:
                    break

                yield event
        finally:
            with self._lock:
                self._subscribers.pop(subscriber.id, None)
            logger.info(
                "subscriber %s disconnected (%d events dropped)",
                subscriber.id,
                subscriber.dropped_total,
            )

    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subscribers)

    def stats(self) -> dict:
        with self._lock:
            subscribers = list(self._subscribers.values())

        return {
            "subscribers": len(subscribers),
            "droppedEvents": sum(entry.dropped_total for entry in subscribers),
            "queueCapacity": MAX_QUEUED_EVENTS,
        }
