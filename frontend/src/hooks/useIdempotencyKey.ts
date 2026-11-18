import { useRef } from "react";

function generateKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Gives every submit attempt of a form/modal a stable key: a double-click or a
 * retry after a network error resends the SAME key, so the backend can recognize
 * it as a duplicate instead of applying the money-moving action twice. Call
 * `renew()` right after a successful submit so the next, unrelated action gets a
 * fresh key.
 */
export function useIdempotencyKey() {
  const keyRef = useRef<string>(generateKey());

  const renew = () => {
    keyRef.current = generateKey();
  };

  return { get: () => keyRef.current, renew };
}
