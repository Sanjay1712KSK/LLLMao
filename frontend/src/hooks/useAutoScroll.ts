import { useEffect, useRef } from 'react';

export function useAutoScroll<T>(dependency: T) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [dependency]);

  return ref;
}
