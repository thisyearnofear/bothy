export interface OperationGuard {
  begin: () => number;
  invalidate: () => void;
  isCurrent: (generation: number) => boolean;
  mount: () => void;
  unmount: () => void;
}

export function createOperationGuard(): OperationGuard {
  let current = 0;
  let mounted = true;
  return {
    begin: () => ++current,
    invalidate: () => { current += 1; },
    isCurrent: (generation) => mounted && generation === current,
    mount: () => { mounted = true; },
    unmount: () => { mounted = false; current += 1; },
  };
}
