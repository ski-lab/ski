/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { decorator } from './decorator.js'

export type Separators = '.' | '[' | ':' | '#'
export type SelectorType<T extends string> = T extends `${string} ${infer U}`
  ? SelectorType<U>
  : T extends `${infer V}${Separators}${string}`
  ? SelectorType<V>
  : T

export type Hint<T extends HTMLElement> = string & T

export type ElementDefinition = Readonly<Record<string, string>>

export type ElementType<S extends string> = S extends Hint<infer U>
  ? U
  : SelectorType<S> extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[SelectorType<S>]
  : S extends ':root'
  ? ShadowRoot
  : HTMLElement

export type ElementTypes<T> = {
  [K in keyof T]: T[K] extends string ? ElementType<T[K]> : HTMLElement
}

// interface
export function multipleQuery<T extends ParentNode>(host: T, query: ':host'): Array<T>
export function multipleQuery<S extends string>(host: ParentNode, query: S): Array<ElementType<S>>
export function multipleQuery<E = HTMLElement>(host: ParentNode, ...query: string[]): Array<E>
// implementation
export function multipleQuery(host: ParentNode, ...queries: string[]): Array<Node> {
  return queries.flatMap<ParentNode>(query => findAll(host, query))
}

function findAll(parent: ParentNode, query: string): ParentNode[] {
  switch (query) {
    case ':host':
      return [parent]

    case ':root':
      return parent instanceof HTMLElement && parent.shadowRoot ? [parent.shadowRoot] : []

    // TODO: find a better name for light-host (host element that is not inside any shadow root)
    case ':light-host': {
      let root: Node
      while (((root = parent.getRootNode()), root instanceof ShadowRoot)) parent = root.host as ParentNode
      return [parent]
    }

    default: {
      let target = query.startsWith(':host') ? parent : (parent instanceof HTMLElement && parent.shadowRoot) || parent

      let scoped = query.replace(':host', ':scope')
      return Array.from<any>(target.querySelectorAll(scoped))
    }
  }
}

// interface
type Callback<E> = (self: Element) => Array<E>
export function allElements<S extends string>(selector: S): Callback<ElementType<SelectorType<S>>>
export function allElements<E>(element: E): Callback<E>
export function allElements<E>(callback: (self: Element) => E | undefined | null): Callback<E>
// implementation
export function allElements(selector: string | Element | Function) {
  return function (self: Element) {
    if (typeof selector == 'object') return [selector]
    else if (typeof selector == 'function') {
      let element = selector(self)
      if (element) return [element]
    } else {
      let result = multipleQuery<Element>(self as ParentNode, ...selector.split(',').map(s => s.trim()))
      return result
    }
  }
}

export function typehint<T extends HTMLElement>(selector: string): Hint<T> {
  return selector as Hint<T>
}

export interface CustomHTMLElement extends HTMLElement {
  connectedCallback?(): void
  disconnectedCallback?(): void
  adoptedCallback?(): void
  attributeChangedCallback?(name: string, old: string | null, value: string | null, namespace?: string | null): void
}

export interface CustomHTMLElementConstructor {
  new (...params: any[]): CustomHTMLElement
}

export const element =
  <S extends string>(query: S) =>
  <T, K>(_prototype: K extends keyof T ? T & Partial<Record<K, ElementType<S>>> : T, _property: K): any => ({
    get(this: Element) {
      return (this.shadowRoot || this).querySelector<any>(query) || undefined
    },

    enumerable: true,
    configurable: true,
  })

export const elements =
  <S extends string>(query: S) =>
  <T, K>(
    _prototype: K extends keyof T ? T & Record<K, Partial<ElementType<S>>[]> : T,
    _property: K,
    descriptor?: PropertyDescriptor
  ): any => ({
    ...descriptor,

    get(this: Element) {
      return findAll(this as ParentNode, query)
    },

    enumerable: true,
    configurable: true,
  })

export const bind =
  <S extends string, E extends ElementType<S>, P extends keyof E>(query: S, property: P = <P>'value') =>
  <T, K>(_prototype: K extends keyof T ? T & Partial<Record<K, E[P]>> : T, _property: K): any => ({
    get(this: Element) {
      const element = (this.shadowRoot || this).querySelector<any>(query) || undefined
      return element?.[property]
    },

    set(this: Element, value: unknown) {
      for (let element of (this.shadowRoot || this).querySelectorAll<any>(query)) element[property] = value
    },

    enumerable: true,
    configurable: true,
  })

export const getElementProperty =
  <S extends string, E extends ElementType<S>, P extends keyof E>(query: S, property: P) =>
  <T, K>(_prototype: K extends keyof T ? T & Partial<Record<K, E[P]>> : T, _property: K, descriptor?: PropertyDescriptor): any => ({
    ...descriptor,

    get(this: Element) {
      return this.shadowRoot?.querySelector<any>(query)?.[property]
    },

    enumerable: true,
    configurable: true,
  })

export type ElementProperties<T extends HTMLElement> = Partial<HTMLElement> & Omit<T, keyof HTMLElement>

export const elementDecorator = <V>({
  elements,
  apply,
  async,
  get,
  init,
  decorate,
}: {
  elements: string | ((self: HTMLElement) => Iterable<HTMLElement>)
  apply?: (element: HTMLElement, value: V) => unknown
  async?: (element: HTMLElement, promise: Promise<V>) => unknown | Promise<unknown>
  get?: (element: HTMLElement, property: PropertyKey) => V
  init?: (self: HTMLElement, property: string | symbol, element: HTMLElement) => void
  decorate?: (prototype: HTMLElement, property: string | symbol, descriptor?: PropertyDescriptor) => any
}) => {
  let list = typeof elements == 'string' ? allElements(elements) : elements

  return decorator<HTMLElement, V>({
    apply:
      apply &&
      ((self, value) => {
        for (let element of list(self)) apply(element, value)
      }),

    async:
      async &&
      (async (self, value) => {
        await Promise.all(Array.from(list(self), element => async(element, value)))
      }),

    get:
      get &&
      ((self, property) => {
        let [element] = list(self)
        return element && get(element, property)
      }),

    init:
      init &&
      ((self, property) => {
        for (let element of list(self)) init(self, property, element)
      }),

    decorate,
  })
}

export const defineElement = (tagname: `${string}-${string}`) => (constructor: CustomElementConstructor) =>
  customElements.define(tagname, constructor)
