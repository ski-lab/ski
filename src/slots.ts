/* eslint-disable @typescript-eslint/no-explicit-any */
import { onConnected } from './connected-callback.js'
import createElements, { CreateElement } from './create-elements.js'
import { decorator, Decorator } from './decorator.js'
import deepAssign from './deep-assign.js'
import { elementDecorator, ElementType } from './elements.js'
import { observeElement } from './observer.js'

type ElementDecorator<T> = Decorator<HTMLElement, Iterable<Partial<T>>>

function findSlot(element: Element, name: string): HTMLSlotElement | undefined {
  let selector = name ? `slot[name="${name}"]` : 'slot:not([name]),slot[name=""]'
  let root = element.shadowRoot || (element.getRootNode() as ShadowRoot)
  let result = root?.querySelector<HTMLSlotElement>(selector)
  return result || undefined
}

function createProxySlot(element: Element, slot: string, name = slot): HTMLSlotElement {
  let proxyslot = document.createElement('slot')
  proxyslot.name = name
  proxyslot.slot = slot
  element.append(proxyslot)
  return proxyslot
}

function getLightDOMSlot(host: Element, slot: string) {
  let root = host.getRootNode()
  while (root instanceof ShadowRoot) {
    let selector = slot ? `slot[slot="${slot}"]` : `slot:not([slot]),slot[slot=""]`
    let proxyslot =
      host.querySelector<HTMLSlotElement>(`${selector}`) || createProxySlot(host, slot)

    host = root.host
    slot = proxyslot.name
    root = host.getRootNode()
  }

  return { host, slot }
}

const match = (element: Element, type?: CreateElement) =>
  typeof type == 'string'
    ? element.matches(type)
    : Object.prototype.isPrototypeOf.call(HTMLElement, type!)
    ? element instanceof <any>type
    : true

function cloneSlotContent(
  slot: HTMLSlotElement | undefined,
  type: CreateElement = 'text'
): Element[] {
  let cloned =
    slot?.firstElementChild instanceof HTMLTemplateElement
      ? <ParentNode>slot.firstElementChild.content.cloneNode(true)
      : <ParentNode>slot?.cloneNode(true)

  const makeElement = () =>
    typeof type == 'function'
      ? Object.prototype.isPrototypeOf.call(HTMLElement, type)
        ? new (<CustomElementConstructor>type)()
        : (<any>type)()
      : document.createElement(type)

  return cloned?.children.length > 0 ? Array.from(cloned.children) : [makeElement()]
}

function createSlotted(element: Element, name: string, type?: CreateElement): Element[] {
  let slotelement = findSlot(element, name)
  let { host, slot } = getLightDOMSlot(element, name)
  let elements = cloneSlotContent(slotelement, type)
  for (let child of elements) child.slot = slot
  host.append(...elements)
  return elements
}

function getSlotted(element: Element, slot: string, type?: CreateElement): Element[] {
  getLightDOMSlot(element, slot)
  let slotelement = findSlot(element, slot)
  let assignedElements = slotelement?.assignedElements({ flatten: true }) || []
  if (assignedElements[0]?.parentElement instanceof HTMLSlotElement) assignedElements = []
  if (type) assignedElements = assignedElements.filter(element => match(element, type))

  return assignedElements
}

const assignedSlot = (element: Element): HTMLSlotElement | null =>
  element.assignedSlot?.assignedSlot ? assignedSlot(element.assignedSlot) : element.assignedSlot

export function findSlotted<E extends Element>({
  host,
  slot,
  selector,
  type,
  create = false,
}: {
  host: HTMLElement
  slot: string
  selector?: string
  type?: CreateElement
  create?: boolean
}): E[] {
  let assignedElements = getSlotted(host, slot, type)
  if (assignedElements.length == 0 && create)
    assignedElements = createSlotted(host, slot, type || selector?.split(/[[ .:]/)[0])

  if (assignedElements[0]) {
    let finalslot = assignedSlot(assignedElements[0])
    if (finalslot && (finalslot.getRootNode() as ShadowRoot).host != host) {
      //conflict
      console.log(
        'conflict',
        assignedElements[0].localName,
        finalslot.localName,
        (finalslot.getRootNode() as ShadowRoot).host.localName,
        host.localName
      )
    }
  }

  if (selector)
    assignedElements = assignedElements.flatMap(slotted =>
      slotted.matches(selector) ? slotted : Array.from(slotted.querySelectorAll(selector))
    )

  return <E[]>assignedElements
}

export const slotted =
  <S extends string>(slotname: string, selector?: S, create = false) =>
  <T, K>(
    _prototype: K extends keyof T ? T & Partial<Record<K, ElementType<S>>> : T,
    _property: K
  ): any => ({
    get(this: HTMLElement) {
      return findSlotted({ host: this, slot: slotname, selector, create })[0]
    },

    enumerable: true,
    configurable: true,
  })

export const slottedlist =
  <S extends string>(slotname: string, selector?: S, property?: string) =>
  <T, K>(
    _prototype: K extends keyof T
      ? T[K] extends Iterable<infer U>
        ? ElementType<S> extends U
          ? T
          : Record<K, U[]> // Element type does not extends array type from property
        : Record<K, any[]> // property is not an array
      : T, // private, protected property
    _property: K,
    descriptor?: PropertyDescriptor
  ): any => ({
    ...descriptor,

    get(this: HTMLElement) {
      let elements = findSlotted({ host: this, slot: slotname, selector })
      return property ? elements.map((element: any) => element[property]) : elements
    },

    // TODO: remove this setter, and fix the issue with populate without a setter
    set() {},

    enumerable: true,
    configurable: true,
  })

const DEFINED = (value: any) => value !== undefined
const VALIDATORS: Record<string, Record<string, (value: any) => boolean>> = {
  img: { src: DEFINED, srcset: DEFINED },
}

export const slotview: {
  <S extends string>(slot: string, type?: S): ElementDecorator<ElementType<S>>

  <S extends string, P extends keyof ElementType<S>>(
    slot: string,
    type: S,
    property: P,
    format?: (value: any) => ElementType<S>[P],
    validator?: (value: any) => boolean
  ): ElementDecorator<ElementType<S>[P]>

  <S extends string, P extends string | symbol>(
    slot: string,
    type: S,
    property: P,
    format?: (value: any) => unknown,
    validator?: (value: any) => boolean
  ): ElementDecorator<unknown>
  ////
} = (
  slotname: string,
  selector: string,
  property?: string,
  format?: (value: unknown) => unknown,
  validator: (value: any) => boolean = VALIDATORS[selector]?.[property!]
) => {
  return decorator<HTMLElement, any>({
    apply: (element, value) => {
      if (validator && !validator(value)) {
        for (let s of getSlotted(element, slotname, selector)) s.remove()
        return
      }

      if (value === undefined)
        console.warn('** slotting value=undefined', slotname, selector, property)

      if (format) value = format(value)

      setSlottedValue(element, slotname, selector, property, value)
    },

    get: format ? undefined : element => getSlottedValue(element, slotname, selector, property),
  })
}

export const slotget =
  (slotname: string, selector: string, property: string) =>
  (_prototype: HTMLElement, _property: PropertyKey, descriptor?: PropertyDescriptor) =>
    <any>{
      ...descriptor,
      get(this: HTMLElement) {
        return findSlotted<any>({ host: this, slot: slotname, selector })[0]?.[property]
      },
      configurable: true,
      enumerable: true,
    }

export const slotlistview: {
  ////
  <S extends string>(
    slot: string,
    tagName: S,
    defaults?: Partial<ElementType<S>>
  ): ElementDecorator<ElementType<S>>

  <E extends HTMLElement>(
    slot: string,
    elementType: new () => E,
    defaults?: Partial<E>
  ): ElementDecorator<E>

  <S extends string, V = any>(
    slot: string,
    tagName: S,
    transform: (value: V) => Partial<ElementType<S>>
  ): ElementDecorator<ElementType<S>>

  <E extends HTMLElement, V = any>(
    slot: string,
    elementType: new () => E,
    transform: (value: V) => Partial<E>
  ): ElementDecorator<E>

  <E extends HTMLElement, V = any>(
    slot: string,
    elementType: new () => E,
    transform: (value: V) => Partial<E>
  ): ElementDecorator<E>

  <S extends string>(slot: string, tagName: S, property: keyof ElementType<S>): ElementDecorator<
    ElementType<S>
  >

  <E extends HTMLElement>(
    slot: string,
    elementType: new () => E,
    property: keyof E
  ): ElementDecorator<E>

  <P>(slot: string, factory: (props: P) => HTMLElement): ElementDecorator<P>
  ////
} = (slot: string, type: CreateElement, arg3?: any) =>
  ////
  elementDecorator<any>({
    elements: host => [host],

    apply(element, value: any[]) {
      let set = new Set(value)
      for (let child of getSlotted(element, slot, type))
        if (set.has(child)) set.delete(child)
        else child.remove()

      let list: Iterable<any> = set
      if (typeof arg3 == 'function') list = Array.from(set, arg3)
      if (typeof arg3 == 'string') list = Array.from(set, data => ({ [arg3]: data }))
      if (typeof arg3 == 'object') var defaults = arg3

      let { host: parent, slot: name } = getLightDOMSlot(element, slot)

      createElements({
        parent,
        type,
        list,
        defaults: { ...defaults, slot: name },
      })
    },

    get(element) {
      let elements = findSlotted({
        host: element,
        slot,
        type,
      })
      return typeof arg3 == 'string' ? elements.map((element: any) => element[arg3]) : elements
    },
  })

type ElementMethodDecorator = (prototype: HTMLElement, property: PropertyKey) => void

export const sloton: {
  <S extends string, T extends string>(slot: string, selector: S, type: T): ElementMethodDecorator
  <T extends string>(slot: string, type: T): ElementMethodDecorator
} = (slot: string, arg1: string, arg2?: string) => {
  // args
  let selector = (arg2 && arg1) || ''
  let type = arg2 || arg1

  return (prototype: HTMLElement, property: PropertyKey) => {
    const previous = new WeakMap<HTMLElement, Element[]>()

    onConnected(prototype, (element: HTMLElement & Record<PropertyKey, any>) => {
      const fnname = `event_${slot}_${selector}_on${type}`
      const listener = { [fnname]: (e: Event): void => element[property].call(element, e) }[fnname]

      let slotelement = findSlot(element, slot)
      if (slotelement)
        if (selector) {
          slotelement.addEventListener('slotchange', () => {
            let elements = findSlotted({ host: element, slot, selector })
            previous.get(element)?.forEach(e => e.removeEventListener(type, listener))
            previous.set(element, elements)
            for (let slotted of elements) {
              slotted.addEventListener(type, listener)
              // TODO: review this special case of pre-loaded image being added to onload listener slot
              if (slotted instanceof HTMLImageElement && slotted.complete && type == 'load')
                slotted.dispatchEvent(new Event('load'))
            }
          })
        } else slotelement.addEventListener(type, listener)
    })
  }
}

export const onslotchange =
  (slot: string, selector?: string, attribute?: string) =>
  (prototype: HTMLElement, property: PropertyKey) =>
    onConnected(prototype, (element: any) => {
      findSlot(element, slot)?.addEventListener('slotchange', () => {
        let slotted = findSlotted({
          host: element,
          slot,
          selector,
        })
        element[property].call(element, ...slotted)

        // TODO: stop observing previous elements if any
        if (attribute)
          observeElement(slotted, attribute, () => element[property].call(element, ...slotted))
      })
    })

function setSlottedValue(
  host: HTMLElement,
  slot: string,
  selector: string,
  property: string | undefined,
  value: any
) {
  let slottedlist = findSlotted({
    host,
    slot,
    selector,
    create: true,
  })

  for (let slotted of slottedlist)
    property || typeof value == 'string'
      ? property?.includes('-')
        ? slotted.setAttribute(property, value)
        : Reflect.set(slotted, property || 'textContent', value)
      : deepAssign(slotted, value)
}

function getSlottedValue(host: HTMLElement, slot: string, selector: string, property?: string) {
  let [slotted] = findSlotted<any>({ host: host, slot, selector })
  return slotted && property
    ? property?.includes('-')
      ? slotted.getAttribute(property)
      : slotted[property]
    : slotted
}

export const runIfEmptySlot =
  (slot: string, selector?: string) =>
  (
    _prototype: HTMLElement,
    _property: PropertyKey,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => any>
  ): any => {
    return {
      ...descriptor,
      value(this: HTMLElement, ...args: unknown[]) {
        let slotted = findSlotted({ host: this, slot, selector })
        if (slotted.length == 0) descriptor.value!.call(this, ...args)
      },
    }
  }
