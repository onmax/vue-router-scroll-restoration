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
 * With a `hash`, the target element is scrolled into view instead, and the containers that hold it
 * are left to `scrollIntoView`.
 */
export function restoreScroll(
  containers: readonly ScrollContainer[],
  snapshot: ScrollSnapshot | undefined,
  hash: string,
  { signal, settle = 3000 }: RestoreScrollOptions = {},
): void {
  const target = hash ? findHashTarget(hash) : null
  const targets = containers
    .filter(({ element }) => !target || !element.contains(target))
    .map(({ id, element }) => ({ element, position: snapshot?.[id] ?? { left: 0, top: 0 }, height: -1 }))

  for (const { element, position } of targets)
    element.scrollTo(position)
  // scroll-margin-top on the target sets the offset
  target?.scrollIntoView({ block: 'start' })
  if (settle === false || signal?.aborted || targets.every(({ position }) => position.top === 0 && position.left === 0))
    return

  const done = new AbortController()
  const stop = () => done.abort()
  signal?.addEventListener('abort', stop, { signal: done.signal })
  for (const type of USER_INPUT)
    window.addEventListener(type, stop, { capture: true, passive: true, signal: done.signal })

  const start = performance.now()
  let heldSince = start
  const frame = (now: number) => {
    if (done.signal.aborted)
      return
    let held = true
    for (const item of targets) {
      const { element, position } = item
      if (!reached(element, position)) {
        element.scrollTo(position)
        held &&= reached(element, position)
      }
      if (element.scrollHeight !== item.height) {
        item.height = element.scrollHeight
        held = false
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

function reached(element: Element, { left, top }: ScrollPosition) {
  return Math.abs(element.scrollTop - top) < 1 && Math.abs(element.scrollLeft - left) < 1
}

function findHashTarget(hash: string) {
  const id = hash.slice(1)
  try {
    return document.getElementById(decodeURIComponent(id))
  }
  catch {
    // a malformed escape such as `#%E0%A4%A`
    return document.getElementById(id)
  }
}

export interface ScrollStore {
  get: (key: string) => ScrollSnapshot | undefined
  set: (key: string, snapshot: ScrollSnapshot) => void
  /** Writes the store to `sessionStorage`, so a reload in the same tab finds it. */
  persist: () => void
}

/** Snapshots by key, in memory, oldest first, keeping at most `limit`. */
export function createScrollStore(storageKey: string, limit = 100): ScrollStore {
  const snapshots = new Map<string, ScrollSnapshot>(read(storageKey))
  return {
    get: key => snapshots.get(key),
    set(key, snapshot) {
      snapshots.delete(key)
      snapshots.set(key, snapshot)
      for (const oldest of snapshots.keys()) {
        if (snapshots.size <= limit)
          break
        snapshots.delete(oldest)
      }
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

function read(storageKey: string): [string, ScrollSnapshot][] {
  let stored: unknown
  try {
    stored = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')
  }
  catch {
    return []
  }
  // another version or another script may have written this key
  return Array.isArray(stored) ? stored.filter(isStoredEntry) : []
}

function isStoredEntry(value: unknown): value is [string, ScrollSnapshot] {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'object' || !value[1])
    return false
  return Object.values(value[1]).every(position => typeof position?.left === 'number' && typeof position.top === 'number')
}
