"use client";

import { useEffect, useState, useRef } from "react";

interface ActivityEvent {
    id: string;
    type: "join" | "recruit";
    actorAddress: string;
    actorUsername: string;
    targetAddress?: string;
    targetUsername?: string;
    amount?: string;
    timestamp: string;
}

interface LiveActivityFeedProps {
    maxItems?: number;
    pollInterval?: number;
    className?: string;
    compact?: boolean;
}

function getRelativeTime(timestamp: string): string {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diff = now - then;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

function ActivityItem({
    event,
    isNew,
}: {
    event: ActivityEvent;
    isNew: boolean;
}) {
    return (
        <div
            className={`
                flex items-center gap-2 py-2 px-3
                rounded-lg
                transition-all duration-300
                ${isNew ? "animate-activity-in bg-[hsl(160,84%,50%,0.05)]" : "bg-transparent"}
            `}
        >
            {/* Icon */}
            <div
                className={`
                    flex-shrink-0 w-6 h-6
                    flex items-center justify-center
                    rounded-full text-xs
                    ${event.type === "recruit"
                        ? "bg-[hsl(45,100%,50%,0.15)] text-[hsl(45,100%,50%)]"
                        : "bg-[hsl(160,84%,50%,0.15)] text-[hsl(160,84%,50%)]"
                    }
                `}
            >
                {event.type === "recruit" ? "💰" : "△"}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                {event.type === "recruit" ? (
                    <p className="text-xs text-[hsl(210,20%,92%,0.9)] truncate">
                        <span className="font-medium text-[hsl(160,84%,50%)]">
                            {event.actorUsername}
                        </span>
                        {" recruited "}
                        <span className="font-medium text-[hsl(210,20%,92%)]">
                            {event.targetUsername}
                        </span>
                    </p>
                ) : (
                    <p className="text-xs text-[hsl(210,20%,92%,0.9)] truncate">
                        <span className="font-medium text-[hsl(160,84%,50%)]">
                            {event.actorUsername}
                        </span>
                        {" joined the pyramid"}
                    </p>
                )}
            </div>

            {/* Time */}
            <div className="flex-shrink-0 text-[10px] text-[hsl(215,12%,55%)]">
                {getRelativeTime(event.timestamp)}
            </div>
        </div>
    );
}

export function LiveActivityFeed({
    maxItems = 5,
    pollInterval = 10000,
    className = "",
    compact = false,
}: LiveActivityFeedProps) {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const previousEventsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const fetchActivity = async () => {
            try {
                const response = await fetch("/api/activity");
                if (!response.ok) return;

                const data = await response.json();
                const newEvents = data.events as ActivityEvent[];

                // Find truly new events (not seen before)
                const newIds = new Set<string>();
                newEvents.forEach((event) => {
                    if (!previousEventsRef.current.has(event.id)) {
                        newIds.add(event.id);
                    }
                });

                // Update previous events ref
                previousEventsRef.current = new Set(newEvents.map((e) => e.id));

                // Only mark as new if this isn't the first load
                if (!isLoading && newIds.size > 0) {
                    setNewEventIds(newIds);
                    // Clear "new" status after animation
                    setTimeout(() => setNewEventIds(new Set()), 2000);
                }

                setEvents(newEvents.slice(0, maxItems));
                setIsLoading(false);
            } catch (error) {
                console.error("Failed to fetch activity:", error);
                setIsLoading(false);
            }
        };

        fetchActivity();
        const interval = setInterval(fetchActivity, pollInterval);

        return () => clearInterval(interval);
    }, [maxItems, pollInterval, isLoading]);

    if (isLoading) {
        return (
            <div className={`space-y-2 ${className}`}>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div
                        key={i}
                        className="h-10 rounded-lg bg-[hsl(220,13%,14%)] animate-pulse"
                    />
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className={`text-center py-4 ${className}`}>
                <p className="text-xs text-[hsl(215,12%,55%)]">
                    No activity yet. Be the first!
                </p>
            </div>
        );
    }

    return (
        <div className={className}>
            {!compact && (
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[hsl(160,84%,50%)] animate-pulse" />
                    <h3 className="text-xs font-medium text-[hsl(215,12%,55%)] uppercase tracking-wider">
                        Live Activity
                    </h3>
                </div>
            )}
            <div className="space-y-2">
                {events.map((event) => (
                    <ActivityItem
                        key={event.id}
                        event={event}
                        isNew={newEventIds.has(event.id)}
                    />
                ))}
            </div>
        </div>
    );
}
