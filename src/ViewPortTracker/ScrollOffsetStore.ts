import type { ScrollBoxOffset } from '../types';

interface ScrollOffset {
  x: number;
  y: number;
}

interface ScrollViewDimensions {
  width: number;
  height: number;
}

class ScrollOffsetStore {
  private offset: ScrollOffset = { x: 0, y: 0 };
  private dimensions: ScrollViewDimensions = { width: 0, height: 0 };

  private callbacks: ((offset: ScrollBoxOffset) => void)[] = [];

  private isNotifying = false;

  constructor({ isNotifying }: { isNotifying: boolean }) {
    this.isNotifying = isNotifying;
  }

  setIsNotifying(val: boolean): void {
    const shouldNotify = val && !this.isNotifying;
    this.isNotifying = val;

    if (shouldNotify) {
      this.notify();
    }
  }

  notify(): void {
    if (this.isNotifying) {
      this.callbacks.forEach((callback) =>
        callback({
          ...this.offset,
          ...this.dimensions,
        })
      );
    }
  }

  setOffset(offset: ScrollOffset): void {
    this.offset = offset;
    this.notify();
  }

  getOffset(): ScrollOffset {
    return { ...this.offset };
  }

  setDimensions(dimensions: ScrollViewDimensions): void {
    this.dimensions = dimensions;
    this.notify();
  }

  getDimensions(): ScrollViewDimensions {
    return { ...this.dimensions };
  }

  subscribe(callback: (offset: ScrollBoxOffset) => void): () => void {
    this.callbacks.push(callback);

    if (this.isNotifying) {
      callback({ ...this.offset, ...this.dimensions });
    }

    return () => {
      this.callbacks = this.callbacks.filter((c) => c !== callback);
    };
  }
}

export default ScrollOffsetStore;
