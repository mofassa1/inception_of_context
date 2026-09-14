import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from p2.deps import EventBusDep
from p1.core.events import EventBus

router = APIRouter(tags=["events"])


def event_stream(event_bus: EventBus):
    for event in event_bus.subscribe():
        if event is None:
            yield ": keepalive\n\n"
        else:
            yield f"data: {json.dumps(event)}\n\n"


@router.get("/events")
def stream_events(event_bus: EventBusDep) -> StreamingResponse:
    return StreamingResponse(
        event_stream(event_bus),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
