/**
 * Perf probe
 *
 * Tiny render-free singleton — Experience drops the live renderer here so the
 * DOM PerfMonitor can read renderer.info after each frame without touching R3F.
 */
export const perfProbe = {
    renderer: null,
}
