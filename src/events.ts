/* eslint-disable @typescript-eslint/no-explicit-any */
import { registerPromise } from './async.js'
import { addObservedAttribute } from './attributes.js'
import { onConnected } from './connected-callback.js'
import { decorator } from './decorator.js'
import { allElements } from './elements.js'
import { createHook, redefineOwnProperty } from './hook.js'

export type EventProperty<T = void> = (event: Partial<T extends Event ? T : CustomEvent<T>>) => void

interface Listener {
  elements: (self: Element) => Iterable<EventTarget>
  type: string
  method: PropertyKey
  options?: AddEventListenerOptions
}

class ListenerClass {
  static eventListeners: Listener[]
}

type EventListener<E = Event> = (event: E) => void

type EventConstructor = new (type: string, init: EventInit) => Event

interface HtmlElementClass {
  events: Map<
    string,
    {
      constructor: EventConstructor
      property: string
      init?: EventInit
    }
  >
}

const eventPropertyType = (property: string) => property.toLowerCase().replace(/^on/, '')

function addAllEventListeners(element: HTMLElement, constructor: typeof ListenerClass) {
  for (let event of constructor.eventListeners)
    for (let target of event.elements(element)) {
      //* using .call? in case it is only a getter
      const listener = (e: Event) =>
        registerPromise((element as any)[event.method]?.call?.(element, e))
      target.addEventListener(event.type, listener, event.options)
    }
}

function registerEventListener(prototype: HTMLElement, listener: Listener) {
  onConnected(prototype, addAllEventListeners)
  redefineOwnProperty(
    (<unknown>prototype.constructor) as typeof ListenerClass,
    'eventListeners',
    eventListeners => Array.from(eventListeners || [])
  ).push(listener)
}

export function on<S extends string, V extends string>(
  target: S | EventTarget | ((self: Element) => EventTarget | undefined | null),
  type: V,
  options?: AddEventListenerOptions
) {
  return function <T extends HTMLElement>(
    prototype: T,
    method: PropertyKey,
    _descriptor: TypedPropertyDescriptor<any>
  ) {
    registerEventListener(prototype, {
      elements: allElements(target as any),
      type,
      method,
      options,
    })
  }
}

export function preventDefault<T extends Element>(
  _prototype: T,
  _method: PropertyKey,
  descriptor: TypedPropertyDescriptor<any>
) {
  return {
    value(event?: Event) {
      event?.preventDefault()
      return descriptor.value?.call(this, event)
    },
  }
}

export function stopPropagation<T extends Element>(
  _prototype: T,
  _method: PropertyKey,
  descriptor: TypedPropertyDescriptor<any>
) {
  return {
    value(event?: Event) {
      event?.stopPropagation()
      return descriptor.value?.call(this, event)
    },
  }
}

export const matches = (selectors: string) =>
  function <T extends Element>(
    _prototype: T,
    _method: PropertyKey,
    descriptor: TypedPropertyDescriptor<any>
  ) {
    return {
      value(event?: Event) {
        return event?.target instanceof Element && event.target.matches(selectors)
          ? descriptor.value?.call(this, event)
          : undefined
      },
    }
  }

export function detail<T extends Element>(
  _prototype: T,
  _method: PropertyKey,
  descriptor: TypedPropertyDescriptor<any>
) {
  return {
    ...descriptor,
    value(event?: CustomEvent) {
      descriptor.value?.call(this, event)
      return event?.detail
    },
  }
}

function addEvent(
  prototype: any,
  property: string,
  constructor: EventConstructor,
  init?: EventInit
) {
  let type = eventPropertyType(property)
  redefineOwnProperty(
    <HtmlElementClass>prototype.constructor,
    'events',
    events => new Map(events)
  ).set(type, { constructor, property, init })
}

function dispatchEvent<T>(target: EventTarget, type: string, options: T) {
  let events = (target.constructor as unknown as HtmlElementClass).events
  let details = events?.get(type)
  let eventClass = details?.constructor || CustomEvent
  let event = new eventClass(type, { ...details?.init, ...options })
  if (/jsdom/.test(navigator.userAgent))
    console.log('dispatchEvent', type, JSON.stringify((<any>options).detail)?.substring(0, 500))
  target.dispatchEvent(event)
}

const setupEventAttributeChanged = createHook<
  Element,
  [name: string, old: string, value: string],
  void
>(
  'attributeChangedCallback',
  function eventAttributeChanged(this: any, $super, attribute, old, value) {
    if (!attribute.startsWith('on')) return $super?.(attribute, old, value)

    let type = eventPropertyType(attribute)
    let events = (<HtmlElementClass>this.constructor).events
    let event = events?.get(type)
    if (event) this[event.property] = value && new Function('event', value).bind(this)
    else $super?.(attribute, old, value)
  }
)

/**
 *
 * @param constructor Event class
 * @param defaults defalt event init parameneter
 *
 * @description
 * Property name must start with 'on'
 * Defines a property with an associated event type and attribute
 * attribute name will be the property name in lowercase
 * event type will the the property name in lower case without the starting 'on' part
 *
 * ```typescript
 * class Element {
 *   `@`event declare onEventType: EventProperty
 * }
 * <my-element oneventtype="console.log(event)">
 * myElement.dispatchEvent(new Event('eventtype'))
 * ```
 * @returns decorator
 */
export const event = <E extends EventConstructor>(
  constructor: E = <any>CustomEvent,
  defaults?: ConstructorParameters<E>[1]
) =>
  function <T extends Element, P extends keyof T & `on${string}`>(
    prototype: T[P] extends EventListener<E> ? T : Record<P, EventListener>,
    property: P
  ): any {
    let name = property.toLowerCase()
    let type = name.replace(/^on/, '')
    let storage = new WeakMap<EventTarget, EventListener>()

    addObservedAttribute(prototype, name)
    setupEventAttributeChanged(prototype as T)
    addEvent(prototype, property, constructor, defaults)

    let decorator = <ThisType<EventTarget>>{
      get() {
        return (init: EventInit) => dispatchEvent(this, type, init)
      },

      set(value: EventListener) {
        let listener = storage.get(this)
        if (listener) this.removeEventListener(type, listener)
        this.addEventListener(type, value)
        storage.set(this, value)
      },
    }

    return decorator
  }

type EventType<S extends string> = S extends keyof HTMLElementEventMap
  ? HTMLElementEventMap[S] extends CustomEvent<infer T>
    ? T | Promise<T>
    : unknown | Promise<unknown>
  : void | Promise<void>

export const emit = <S extends string, T extends EventType<S>>(type: S, init?: EventInit) =>
  decorator<Element, T>({
    apply: (self, detail) => dispatchEvent(self, type, { ...init, detail }),
  })

export interface Target<T extends EventTarget> extends Event {
  target: T
}

export function onConnectedCallback(
  prototype: HTMLElement,
  property: PropertyKey,
  _descriptor: TypedPropertyDescriptor<() => any>
) {
  onConnected<any>(prototype, host => host[property]())
}
