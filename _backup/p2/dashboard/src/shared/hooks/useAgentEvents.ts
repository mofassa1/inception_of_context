import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "@/shared/api/client";
import { ENDPOINTS } from "@/shared/constants/endpoints";
import { QUERY_KEYS } from "@/shared/constants/queryKeys";
import { getParentPath } from "@/shared/lib/path";
import type { IndexEvent } from "@/shared/types/agent";

const MAX_TRACKED_EVENTS = 50;

export function useAgentEvents() {
  const [events, setEvents] = useState<IndexEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;

  useEffect(() => {
    const source = new EventSource(API_BASE_URL + ENDPOINTS.AGENT_EVENTS);

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (message) => {
      let event: IndexEvent;

      try {
        event = JSON.parse(message.data);
      } catch {
        return;
      }

      setEvents((current) =>
        [event, ...current].slice(0, MAX_TRACKED_EVENTS),
      );

      const client = queryClientRef.current;
      client.invalidateQueries({ queryKey: [QUERY_KEYS.FILE_CHUNKS, event.path] });
      client.invalidateQueries({ queryKey: [QUERY_KEYS.DIRECTORY, getParentPath(event.path)] });
      client.invalidateQueries({ queryKey: [QUERY_KEYS.AGENT_FILES] });
      client.invalidateQueries({ queryKey: [QUERY_KEYS.OVERVIEW] });
    };

    return () => source.close();
  }, []);

  return { events, connected };
}
