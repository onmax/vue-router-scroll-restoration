export interface ScrollPosition {
  left: number
  top: number
}

/** Saved positions of one history entry, by container id. */
export type ScrollSnapshot = Record<string, ScrollPosition>

export interface ScrollContainer {
  id: string
  element: Element
}

/** The id of the document's own scroller in `containers` and in snapshots. */
export const WINDOW = 'window'

/** Elements with this attribute are tracked without configuration; its value is the container id. */
export const CONTAINER_ATTRIBUTE = 'data-scroll-restoration-id'

const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/**
 * Finds the containers on the page now: each selector in `selectors` (`'window'` for the
 * document), then every element with `data-scroll-restoration-id`.
 */
export function findContainers(selectors: readonly string[]): ScrollContainer[] {
  const containers: ScrollContainer[] = []
  for (const selector of selectors) {
    const element = selector === WINDOW ? document.scrollingElement : document.querySelector(selector)
    if (element)
      containers.push({ id: selector, element })
  }
  for (const element of document.querySelectorAll(`[${CONTAINER_ATTRIBUTE}]`))
    containers.push({ id: element.getAttribute(CONTAINER_ATTRIBUTE)!, element })
  return containers
}

export function captureScroll(containers: readonly ScrollContainer[]): ScrollSnapshot {
  const snapshot: ScrollSnapshot = {}
  for (const { id, element } of containers)
    snapshot[id] = { left: element.scrollLeft, top: element.scrollTop }
  return snapshot
}

export interface RestoreScrollOptions {
  /** Aborting it stops a restore that is still settling. */
  signal?: AbortSignal
  /**
   * Keep re-applying positions while content loads, for at most this many milliseconds.
   * It stops earlier once every position holds and the content stops growing, or on user input.
   * `false` applies once.
   */
  settle?: number | false
}

/** How long positions must hold, with content no longer growing, before a restore ends. */
const SETTLED_AFTER = 200

/**
 * Scrolls each container to its position in `snapshot`, or to the top when it has none.
 * With a `hash`, decoded as in a Vue Router route, the target element is scrolled into view instead,
 * and the containers that hold it are left to `scrollIntoView`.
 */
export function restoreScroll(
  containers: readonly ScrollContainer[],
  snapshot: ScrollSnapshot | undefined,
  hash: string,
  { signal, settle = 3000 }: RestoreScrollOptions = {},
): void {
  const target = hash ? document.getElementById(hash.slice(1)) : null
  const targets = containers
    .filter(({ element }) => !target || !element.contains(target))
    .map(({ id, element }) => ({ element, position: snapshot?.[id] ?? { left: 0, top: 0 }, height: element.scrollHeight }))

  for (const { element, position } of targets)
    element.scrollTo(position)
  // scroll-margin-top on the target sets the offset
  target?.scrollIntoView({ block: 'start' })
  if (settle === false || signal?.aborted || targets.every(({ position }) => position.top === 0 && position.left === 0))
    return

  // Content that loads above a restored position can move it without changing the height, after the
  // positions held long enough to stop re-applying them. The browser's scroll anchoring would follow
  // that content, so it stays off for the whole settle time, until input or a newer navigation.
  const anchoring = new AbortController()
  signal?.addEventListener('abort', () => anchoring.abort(), { signal: anchoring.signal })
  abortOnInput(anchoring)
  const timer = setTimeout(() => anchoring.abort(), settle)
  anchoring.signal.addEventListener('abort', () => clearTimeout(timer))
  for (const element of new Set(targets.map(({ element }) => element))) {
    if (!(element instanceof HTMLElement))
      continue
    const previous = element.style.overflowAnchor
    element.style.overflowAnchor = 'none'
    anchoring.signal.addEventListener('abort', () => element.style.overflowAnchor = previous)
  }

  const done = new AbortController()
  const stop = () => done.abort()
  anchoring.signal.addEventListener('abort', stop, { signal: done.signal })

  const start = performance.now()
  let heldSince = start
  const frame = (now: number) => {
    if (done.signal.aborted)
      return
    let held = true
    for (const item of targets) {
      const { element, position } = item
      // late content moved it or made the page taller
      if (Math.abs(element.scrollTop - position.top) >= 1 || Math.abs(element.scrollLeft - position.left) >= 1 || element.scrollHeight !== item.height) {
        held = false
        item.height = element.scrollHeight
        element.scrollTo(position)
      }
    }
    if (!held)
      heldSince = now
    if (now - heldSince >= SETTLED_AFTER || now - start >= settle)
      return stop()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/** Aborts `controller` on the first wheel, touch, pointer or key input. */
export function abortOnInput(controller: AbortController): void {
  for (const type of USER_INPUT)
    window.addEventListener(type, () => controller.abort(), { capture: true, passive: true, signal: controller.signal })
}

export interface ScrollStore {
  get: (key: string | number) => ScrollSnapshot | undefined
  set: (key: string | number, snapshot: ScrollSnapshot) => void
  /** Writes the store to `sessionStorage`, so a reload in the same tab finds it. */
  persist: () => void
}

/** Snapshots by key, in memory, oldest first, keeping at most `limit`. */
export function createScrollStore(storageKey: string, limit = 100): ScrollStore {
  let snapshots: Map<string | number, ScrollSnapshot>
  try {
    // anything that isn't a list of [key, snapshot] pairs throws here
    snapshots = new Map(JSON.parse(sessionStorage.getItem(storageKey)!))
  }
  catch {
    snapshots = new Map()
  }
  return {
    get: key => snapshots.get(key),
    set(key, snapshot) {
      snapshots.delete(key)
      snapshots.set(key, snapshot)
      if (snapshots.size > limit)
        snapshots.delete(snapshots.keys().next().value!)
    },
    persist() {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify([...snapshots]))
      }
      catch {
        // storage is full or disabled; positions still work until the tab reloads
      }
    },
  }
}
