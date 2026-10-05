describe('ScrollViewPortTrackerContext', () => {
  it('is shared across separately loaded copies of the module', () => {
    let first: unknown;
    let second: unknown;
    jest.isolateModules(() => {
      first = require('../ScrollViewPortTrackerContext').default;
    });
    jest.isolateModules(() => {
      second = require('../ScrollViewPortTrackerContext').default;
    });

    expect(first).toBeDefined();
    expect(second).toBe(first);
    expect(
      (globalThis as any)[Symbol.for('rn-scroll-viewport-tracker.context')]
    ).toBe(first);
  });
});
