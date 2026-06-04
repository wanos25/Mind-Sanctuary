import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom polyfills used by framer-motion and our auto-scroll
class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
// @ts-expect-error - test polyfill
global.IntersectionObserver = IO;
// @ts-expect-error - test polyfill
window.IntersectionObserver = IO;

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = function () {};
HTMLElement.prototype.scrollIntoView = function () {};
