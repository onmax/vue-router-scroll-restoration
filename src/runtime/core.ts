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

const warned = new Set<string>()

/**
 * Finds the containers on the page now: each selector in `selectors` (`'window'` for the
 * document), then every element with `data-scroll-restoration-id`.
 */
export function findContainers(selectors: readonly string[]): ScrollContainer[] {
  const containers: ScrollContainer[] = []
  for (const selector of selectors) {
    const element = selector === WINDOW ? document.scrollingElement : document.querySelector(selector)
    // Nuxt UI's sidebar and panels both have [data-slot="body"]: only the sidebar would be kept
    if (process.env.NODE_ENV !== 'production' && element && selector !== WINDOW && !warned.has(selector)) {
      const count = document.querySelectorAll(selector).length
      if (count > 1) {
        warned.add(selector)
        console.warn(`[vue-router-scroll-restoration] "${selector}" matches ${count} elements. Only the first is saved and restored; use a selector that matches the one that scrolls.`)
      }
    }
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
   * It stops earlier on user input, and leaves a container alone once something else scrolls it.
   * `false` applies once.
   */
  settle?: number | false
}

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
    .map(({ id, element }) => {
      const position = snapshot?.[id] ?? { left: 0, top: 0 }
      element.scrollTo(position)
      return {
        element,
        position,
        applied: { left: element.scrollLeft, top: element.scrollTop },
        height: element.scrollHeight,
        released: false,
      }
    })
  // scroll-margin-top on the target sets the offset
  target?.scrollIntoView({ block: 'start' })
  // Nothing moves a container off its start, so only the others need to settle
  const settling = targets.filter(({ position }) => position.top !== 0 || position.left !== 0)
  if (settle === false || signal?.aborted || !settling.length)
    return

  const restore = new AbortController()
  signal?.addEventListener('abort', () => restore.abort(), { signal: restore.signal })
  abortOnInput(restore)
  const timer = setTimeout(() => restore.abort(), settle)
  restore.signal.addEventListener('abort', () => clearTimeout(timer))
  // Content that loads above a restored position can move it without changing the height. The
  // browser's scroll anchoring would follow that content, so it stays off while the restore settles.
  for (const element of new Set(settling.map(({ element }) => element))) {
    if (!(element instanceof HTMLElement))
      continue
    const previous = element.style.overflowAnchor
    element.style.overflowAnchor = 'none'
    restore.signal.addEventListener('abort', () => element.style.overflowAnchor = previous)
  }

  let pending: number | undefined
  const check = () => {
    pending = undefined
    for (const item of settling) {
      const { element, position } = item
      const resized = element.scrollHeight !== item.height
      item.height = element.scrollHeight
      if (item.released || reached(element, position))
        continue
      // Growth can make a clamped position reachable. A move away from the last applied position
      // that isn't clamped belongs to the app or the user, even when the height changed too.
      if ((resized && reached(element, item.applied)) || clamped(element, position)) {
        element.scrollTo(position)
        item.applied = { left: element.scrollLeft, top: element.scrollTop }
      }
      else
        item.released = true
    }
    if (settling.every(({ released }) => released))
      restore.abort()
  }
  const schedule = () => pending ??= requestAnimationFrame(check)

  // A position that held only moves when the layout changes, so the check waits for one: a DOM
  // change inside a container, a resize of a container or of its children, a scroll, or a viewport
  // resize. Observing only the children keeps the browser's per-frame resize checks small on large
  // pages; content that grows inside them resizes them too.
  const resizes = new ResizeObserver(schedule)
  const mutations = new MutationObserver((records) => {
    for (const { target: parent, addedNodes } of records) {
      if (settling.some(({ element }) => element === parent)) {
        for (const node of addedNodes) {
          if (node instanceof Element)
            resizes.observe(node)
        }
      }
    }
    schedule()
  })
  for (const { element } of settling) {
    resizes.observe(element)
    for (const child of element.children)
      resizes.observe(child)
    mutations.observe(element, { attributes: true, characterData: true, childList: true, subtree: true })
    // the document's scroller fires its scroll events on window
    const scroller = element === document.scrollingElement ? window : element
    scroller.addEventListener('scroll', schedule, { passive: true, signal: restore.signal })
  }
  window.addEventListener('resize', schedule, { passive: true, signal: restore.signal })
  restore.signal.addEventListener('abort', () => {
    if (pending !== undefined)
      cancelAnimationFrame(pending)
    resizes.disconnect()
    mutations.disconnect()
  })
  schedule()
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

function reached(element: Element, { left, top }: ScrollPosition) {
  return Math.abs(element.scrollTop - top) < 1 && Math.abs(element.scrollLeft - left) < 1
}

/** The container scrolled as far as its content allows, short of the position. */
function clamped(element: Element, { left, top }: ScrollPosition) {
  return (element.scrollTop < top - 1 && element.scrollTop >= element.scrollHeight - element.clientHeight - 1)
    || (element.scrollLeft < left - 1 && element.scrollLeft >= element.scrollWidth - element.clientWidth - 1)
}
