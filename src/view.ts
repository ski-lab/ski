/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import createElements from './create-elements.js'
import { decorator, Decorator } from './decorator.js'
import deepAssign from './deep-assign.js'
import { allElements, elementDecorator, ElementType } from './elements.js'

export const view: {
  <S extends string>(query?: S): Decorator<HTMLElement, Partial<ElementType<S>>>
  <S extends string, P extends keyof ElementType<S>>(
    element: S,
    property: P,
    format?: (value: any) => ElementType<S>[P]
  ): Decorator<HTMLElement, ElementType<S>[P]>
  <S extends string, P extends string | symbol>(
    elements: S,
    property: P,
    format?: (value: any) => unknown
  ): Decorator<HTMLElement, unknown>

  <E extends HTMLElement, P extends keyof E>(
    element: string,
    property: P,
    format?: (value: any) => E[P]
  ): Decorator<HTMLElement, E[P]>

  <E extends HTMLElement>(target: string): Decorator<HTMLElement, Partial<E>>

  <E extends HTMLElement>(element: E): Decorator<HTMLElement, Partial<E>>
  <E extends HTMLElement, P extends keyof E>(
    element: E,
    property: P,
    format?: (value: any) => E[P]
  ): Decorator<HTMLElement, E[P]>

  <T, E extends HTMLElement>(callback: (self: T) => E): Decorator<HTMLElement, Partial<E>>
  <T, E, P extends keyof E>(
    callback: (self: T) => E,
    property: P,
    format?: (value: any) => E[P]
  ): Decorator<HTMLElement, E[P]>
  ////
} = (
  target: string | Element | ((self: any) => Element) = ':host',
  property?: string,
  format?: (value: unknown) => unknown
) => {
  return elementDecorator<any>({
    elements: allElements(target as any),

    async apply(element, value) {
      if (format) value = await format(value)
      property ? Reflect.set(element, property, value) : deepAssign(element, value)
    },

    get: format
      ? undefined
      : (element: any) => {
          return property ? element[property] : element
        },
  })
}

export const populate: {
  <S extends string>(target: string, tagName: S, defaults?: Partial<ElementType<S>>): Decorator<
    HTMLElement,
    Iterable<Partial<ElementType<S>>>
  >

  <E extends HTMLElement>(
    target: string,
    elementType: new () => E,
    defaults?: Partial<E>
  ): Decorator<HTMLElement, Iterable<Partial<E>>>

  <E extends HTMLElement>(
    target: string,
    factory: (props: Partial<E>) => E,
    defaults?: Partial<E>
  ): Decorator<HTMLElement, Iterable<Partial<E>>>

  <T extends HTMLElement, S extends string>(
    target: T,
    tagName: S,
    defaults?: Partial<ElementType<S>>
  ): Decorator<HTMLElement, Iterable<Partial<ElementType<S>>>>

  <T extends HTMLElement, E extends HTMLElement>(
    target: T,
    elementType: new () => E,
    defaults?: Partial<E>
  ): Decorator<HTMLElement, Iterable<Partial<E>>>

  <T extends HTMLElement, E extends HTMLElement>(
    target: T,
    factory: (props: Partial<E>) => E,
    defaults?: Partial<E>
  ): Decorator<HTMLElement, Iterable<Partial<E>>>

  <T, S extends string>(
    target: (self: T) => HTMLElement,
    tagName: S,
    defaults?: Partial<ElementType<S>>
  ): Decorator<HTMLElement, Iterable<Partial<ElementType<S>>>>

  <T, E extends HTMLElement>(
    target: (self: T) => HTMLElement,
    elementType: new () => E,
    defaults?: Partial<E>
  ): Decorator<HTMLElement, Iterable<Partial<E>>>

  <T, S extends string>(
    target: (self: T) => HTMLElement,
    tagName: S,
    property: keyof ElementType<S>
  ): Decorator<HTMLElement, Iterable<Partial<ElementType<S>>>>

  <T, E extends HTMLElement>(
    target: (self: T) => HTMLElement,
    elementType: new () => E,
    property: keyof E
  ): Decorator<HTMLElement, Iterable<Partial<E>>>

  <T, E extends HTMLElement>(
    target: (self: T) => HTMLElement,
    factory: (props: Partial<E>) => E,
    defaults?: Partial<E>
  ): Decorator<HTMLElement, Iterable<Partial<E>>>

  ////
} = (
  target: string | Element | ((self: any) => Element),
  type: string | CustomElementConstructor | ((props: any) => Element),
  arg3?: any
) => {
  ////
  const match = (element: Element) =>
    typeof type == 'string'
      ? element.matches(type)
      : 'prototype' in type
      ? element instanceof type
      : true

  let defaults = typeof arg3 == 'object' ? arg3 : undefined

  const matchProperties = (element: any) =>
    defaults ? Object.entries(defaults).every(([key, value]) => element[key] == value) : true

  const getElements = (element: Element) =>
    Array.from(element.children).filter(e => match(e) && matchProperties(e))

  const clear = (element: Element) => {
    for (let e of getElements(element)) e.remove()
  }

  return elementDecorator<any>({
    elements: allElements(target as any),

    apply(parent, list) {
      clear(parent)

      if (typeof arg3 == 'function') list = list.map(arg3)
      if (typeof arg3 == 'string') list = list.map((data: unknown) => ({ [arg3]: data }))
      createElements({
        parent,
        type,
        list,
        defaults: defaults,
      })
    },

    get(element) {
      let elements = getElements(element)
      return typeof arg3 == 'string' ? elements.map((element: any) => element[arg3]) : elements
    },
  })
}

export const style: {
  (target?: string): Decorator<HTMLElement, Record<string, unknown>>
  (target: HTMLElement): Decorator<HTMLElement, Record<string, unknown>>
  <T>(target: (self: T) => HTMLElement): Decorator<HTMLElement, Record<string, unknown>>

  (target: string, property: string, format?: (value: any) => string): Decorator<
    HTMLElement,
    unknown
  >
  (target: HTMLElement, property: string, format?: (value: any) => string): Decorator<
    HTMLElement,
    unknown
  >
  <T>(
    target: (self: T) => HTMLElement,
    property: string,
    format?: (value: any) => string
  ): Decorator<HTMLElement, string | null | void>
  ////
} = (
  target: string | HTMLElement | ((self: any) => HTMLElement) = ':host',
  property?: string,
  format?: (value: string) => string
) => {
  return elementDecorator<any>({
    elements: allElements(target as any),
    apply(element, value) {
      if (property) element.style.setProperty(property, format ? format(value) : value)
      else if (value)
        for (let [property, v] of Object.entries<string>(value))
          element.style.setProperty(property, v)
    },
  })
}

export const setAttribute: {
  (target: string, attribute: string, format?: (value: any) => string): Decorator<
    HTMLElement,
    unknown
  >
  (target: HTMLElement, attribute: string, format?: (value: any) => string): Decorator<
    HTMLElement,
    unknown
  >
  <T>(
    target: (self: T) => HTMLElement,
    attribute: string,
    format?: (value: any) => string
  ): Decorator<HTMLElement, string | null | void>
  ////
} = (
  target: string | HTMLElement | ((self: any) => HTMLElement) = ':host',
  attribute: string,
  format?: (value: string) => string
) => {
  return elementDecorator<any>({
    elements: allElements(target as any),
    apply(element, value) {
      element.setAttribute(attribute, format ? format(value) : value)
    },
  })
}

export const toggleClass = <S extends string, E extends ElementType<S>>(
  target: S | E | ((self: any) => E),
  className: string
): Decorator<HTMLElement, boolean> => {
  return elementDecorator<boolean>({
    elements: allElements(target as any),
    apply: (element, toggle) => element.classList.toggle(className, toggle),
  })
}

export const toggleClasses = <S extends string, E extends ElementType<S>>(
  target: S | E | ((self: any) => E)
): Decorator<HTMLElement, Record<string, boolean> | void> => {
  return elementDecorator<Record<string, boolean> | void>({
    elements: allElements(target as any),
    apply: (element, record) => {
      if (record)
        for (let [name, toggle] of Object.entries(record)) element.classList.toggle(name, toggle)
    },
  })
}

export const asyncToggle = <S extends string, E extends ElementType<S>>(
  target: S | E | ((self: any) => E),
  className: { loading?: string; done?: string }
): Decorator<HTMLElement, Promise<any>> => {
  return elementDecorator<Promise<any>>({
    elements: allElements(target as any),
    async async(element, promise) {
      if (element instanceof HTMLElement) {
        className.loading && element.classList.add(className.loading)
        className.done && element.classList.remove(className.done)
        await promise
        className.done && element.classList.add(className.done)
        className.loading && element.classList.remove(className.loading)
      }
    },
  })
}

export const asyncToggleAttr = <S extends string, E extends ElementType<S>>(
  target: S | E | ((self: any) => E),
  className: { loading?: string; done?: string }
): Decorator<HTMLElement, Promise<any>> => {
  return elementDecorator<Promise<any>>({
    elements: allElements(target as any),
    async async(element, promise) {
      if (element instanceof HTMLElement) {
        className.loading && element.toggleAttribute(className.loading, true)
        className.done && element.toggleAttribute(className.done, false)
        await promise
        className.done && element.toggleAttribute(className.done, true)
        className.loading && element.toggleAttribute(className.loading, false)
      }
    },
  })
}

export const asyncview = decorator<Element, Promise<any>>({
  async: (_element, promise) => promise,
})

export const runIfUnsetAttr =
  (selector: string, attribute: string) =>
  (
    _prototype: HTMLElement,
    _property: PropertyKey,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => any>
  ): any => {
    return {
      ...descriptor,
      value(this: HTMLElement, ...args: unknown[]) {
        let element = allElements(selector)(this)[0]
        if (!element?.hasAttribute(attribute)) descriptor.value!.call(this, ...args)
      },
    }
  }

export const runIfEmpty =
  (selector: string) =>
  (
    _prototype: HTMLElement,
    _property: PropertyKey,
    descriptor: TypedPropertyDescriptor<(...args: unknown[]) => any>
  ): any => {
    return {
      ...descriptor,
      value(this: HTMLElement, ...args: unknown[]) {
        if ((this.shadowRoot || this).querySelector(selector) == null)
          descriptor.value!.call(this, ...args)
      },
    }
  }
