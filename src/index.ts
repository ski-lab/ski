/* eslint-disable @typescript-eslint/no-explicit-any */
import { registerPromise } from './async.js'
import { boolAttr, cssvar, listAttr, numsAttr, textAttr, unitAttr } from './attributes.js'
import { Decorator } from './decorator.js'
import { ElementType, defineElement, element, elements, getElementProperty } from './elements.js'
import { detail, emit, event as eventListener, matches, on, onConnectedCallback, preventDefault, stopPropagation } from './events.js'
import { content } from './inject-document.js'
import { compute, observe, observeNumericCSSVariable } from './observer.js'
import { prop, upgradeProperties } from './properties.js'
import { checkprevious, debounce } from './run.js'
import { onslotchange, runIfEmptySlot, slotget, slotlistview, sloton, slotted, slottedlist, slotview } from './slots.js'
import { observeElementProperty } from './sync.js'
import {
  asyncToggle,
  asyncToggleAttr,
  asyncview,
  populate,
  runIfEmpty,
  runIfUnsetAttr,
  setAttribute,
  style,
  text,
  toggleClass,
  toggleClasses,
  togglePresence,
  view,
} from './view.js'

const partial = <T, U>(
  source: T,
  value: U
): {
  [K in keyof T]: T[K] extends (p0: U, ...args: infer A) => infer R ? (...args: A) => R : never
} =>
  new Proxy<any>(source, {
    get:
      (t, property) =>
      (...args: unknown[]) =>
        t[property]?.(value, ...args),
  })

export const get = {
  element,
  elements,
  slot: {
    property: slotget,
  },
  property: getElementProperty,
}

export const set = {
  view,
  text,
  property: view,
  attr: view,
  properties: view,
  element: view,
  slotview,
  style,
  elements: populate,
  compute,
  content,
  attribute: setAttribute,
}

export const list = {
  view: populate,
}

export const toggle = {
  class: toggleClass,
  classes: toggleClasses,
  presence: togglePresence,
}

export const run = {
  on: Object.assign(on, {
    once: (...args: Parameters<typeof on>) => on(args[0], args[1], { ...args[2], once: true }),
  }),
  when: Object.assign(
    (property: PropertyKey): { changes: MethodDecorator } => {
      return {
        changes: observe(property),
      }
    },
    {
      property: {
        changes: observe,
      },
    }
  ),
  observe,
  compute,
  emit,
  checkprevious,
  debounce,
  if: {
    unset: { attr: runIfUnsetAttr },
    empty: runIfEmpty,
    unslotted: runIfEmptySlot,
  },
}

export const then = {
  emit,
}

export const when = {
  property: {
    changes: observe,
  },
  changed: observe,
  defined: { upgrade: upgradeProperties },
}

export const def = {
  event: Object.assign(eventListener(), {
    of: eventListener,
    bubbles: eventListener(CustomEvent, { bubbles: true }),
    composed: eventListener(CustomEvent, { composed: true }),
  }),
  custom: {
    event: Object.assign(eventListener(CustomEvent), {
      bubbles: eventListener(CustomEvent, { bubbles: true }),
      composed: eventListener(CustomEvent, { composed: true }),
    }),
  },
  eventof: eventListener,
  property: prop,
  observer: observe,
  listener: on,
  computed: compute,
  cssv: cssvar,
  element: defineElement,
  view,
}

export const event = {
  define: eventListener(),
  custom: eventListener,
  on,
  emit: Object.assign(emit, {
    bubbles: (type: string) => emit(type, { bubbles: true }),
  }),
  preventDefault,
  stopPropagation,
  prevent: {
    default: preventDefault,
  },
  stop: {
    propagation: stopPropagation,
  },
  matches,
  detail,
}

export const attr = {
  text: textAttr,
  bool: boolAttr,
  unit: unitAttr,
  list: listAttr,
  nums: numsAttr,
  number: unitAttr,
  numeral: unitAttr,
  boolean: boolAttr,
  toggle: boolAttr,
  textlist: listAttr,
  numberlist: numsAttr,
}

export const async = {
  view: asyncview,
  toggle: asyncToggle,
  toggleAttr: asyncToggleAttr,
  register: registerPromise,
}

export const sync = {
  with: observeElementProperty,
}

const defaultSlot = {
  view: slotview.bind(window, ''),
  text: slotview('', 'text', 'textContent'),
  populate: slotlistview.bind(window, '') as {
    <S extends string>(tagName: S, common?: Partial<ElementType<S>>): Decorator<HTMLElement, Iterable<Partial<ElementType<S>>>>

    <E extends HTMLElement>(elementType: new () => E, common?: Partial<E>): Decorator<HTMLElement, Iterable<Partial<E>>>

    <E extends HTMLElement, P = Partial<E>>(factory: (props: P) => E, common?: Partial<E>): Decorator<HTMLElement, Iterable<P>>
    ////
  },
  on: sloton.bind(window, ''),
  onchange: onslotchange(''),
  element: slotted.bind(window, ''),
  elements: slottedlist.bind(window, ''),
  all: slottedlist.bind(window, ''),
  list: slottedlist.bind(window, ''),
  get: slotget.bind(window, ''),
}

const SLOT = {
  view: slotview,
  populate: slotlistview,
  on: sloton,
  onchange: onslotchange,
  element: slotted,
  elements: slottedlist,
  all: slottedlist,
  list: {
    view: slotlistview,
  },
  get: slotget,
  text: (slot: string) => slotview(slot, 'text', 'textContent'),
}

// type BindRecord<T, U> = {
//   [K in keyof T]: T[K] extends (arg: infer A0, ...args: infer A) => infer R
//     ? A0 extends U
//       ? ((...args: A) => R) & BindRecord<T[K], U>
//       : never
//     : BindRecord<T[K], U>
// }

// const bindRecord = <T extends Record<any, any>, U>(record: T, arg0: U) =>
//   new Proxy(record, {
//     get: (t: any, property): any =>
//       typeof t[property] == 'function'
//         ? Object.assign(t[property].bind(globalThis, arg0), t[property])
//         : bindRecord(t[property], arg0),
//   }) as BindRecord<T, U>

export const slot = Object.assign(
  //(slot: string) => bindRecord(SLOT, slot),
  SLOT,
  {
    default: defaultSlot,
  }
)

export const css = {
  observe: observeNumericCSSVariable,
  set: style,
}

export const host = {
  on: on.bind(window, host => host),
  // @ts-ignore
  view: view.bind(window, (host: HTMLElement) => host) as {
    <E extends HTMLElement = any>(): Decorator<HTMLElement, Partial<E>>

    <E extends HTMLElement = any, P extends keyof E = any>(property: P, format?: (value: any) => E[P]): Decorator<HTMLElement, E[P]>

    <E extends HTMLElement>(property: keyof E, format?: (value: any) => unknown): Decorator<HTMLElement, unknown>
    ////
  },
  // @ts-ignore
  populate: populate.bind(window, host => host) as {
    <S extends string>(tagName: S, init_prop?: Partial<ElementType<S>> | keyof ElementType<S>): Decorator<
      HTMLElement,
      Iterable<Partial<ElementType<S>>>
    >

    <E extends HTMLElement>(elementType: new () => E, init_prop?: Partial<E> | keyof E): Decorator<HTMLElement, Iterable<Partial<E>>>

    <E extends HTMLElement>(factory: (props: Partial<E>) => E, init_prop?: Partial<E> | keyof E): Decorator<
      HTMLElement,
      Iterable<Partial<E>>
    >
  },
  toggle,
  upgrade: upgradeProperties,
  connected: onConnectedCallback,
}

export const root = {
  ...partial(run, (host: Element): EventTarget => host.shadowRoot!),
}

export const selector = (query: string) => ({
  test: null,
})

export { bind } from './bind.js'
