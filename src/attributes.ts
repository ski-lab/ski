/* eslint-disable @typescript-eslint/no-explicit-any */
import { decorator } from './decorator.js'
import { createHook, redefineOwnProperty } from './hook.js'
import { findPropertyDescriptor } from './properties.js'

export function camelize(name: string) {
  return name.replace(/-./g, m => m[1].toUpperCase())
}

export function dashify(name: string) {
  return name.replace(/[A-Z]/g, m => '-' + m[0].toLowerCase())
}

interface HtmlElementClass {
  observedAttributes: string[]
}

const setupAttributeChanged = createHook<Element, [name: string, old: string, value: string], void>(
  'attributeChangedCallback',
  function callAttributeSetter(this: Element, $uper, name, old, value) {
    $uper?.(name, old, value)
    if (old != value) {
      let property = camelize(name)
      Reflect.set(this, property, (<any>this)[property]) // call setter when attribute changes
    }
  }
)

export function addObservedAttribute(prototype: any, dashedName: string) {
  let observedAttributes = redefineOwnProperty(
    <HtmlElementClass>prototype.constructor,
    'observedAttributes',
    observedAttributes => Array.from(observedAttributes || [])
  )
  if (!observedAttributes.includes(dashedName)) observedAttributes.push(dashedName)
}

function attribute<T extends Element, K extends keyof T, U extends Object>({
  prototype,
  property,
  descriptor = findPropertyDescriptor(prototype, property),
  get,
  set,
}: {
  prototype: T
  property: K
  descriptor?: PropertyDescriptor
  get: (element: T, name: string) => U
  set: (element: T, name: string, value: U) => void
}): any {
  let name = dashify(property.toString())

  setupAttributeChanged<any>(prototype)
  addObservedAttribute(prototype, name)

  let previousValue = new WeakMap<T, U>()

  return decorator<any, any>({
    apply(element, value) {
      if (value !== previousValue.get(element)) {
        previousValue.set(element, value)
        descriptor?.set?.call(element, value)
        if (get(element, name)?.toString() != value?.toString()) set(element, name, value)
      }
    },

    get(element) {
      return get(element, name)
    },
  })(prototype, <any>property, descriptor)

  // TODO: avoid this double function arguments ()()
}

export function textAttr<T extends Element, K extends keyof T>(
  prototype: T & { [key in K]: string },
  property: K,
  descriptor?: PropertyDescriptor
) {
  return attribute({
    prototype,
    property,
    descriptor,
    get: (element, name) => element.getAttribute(name) || '',
    set: (element, name, value) =>
      value ? element.setAttribute(name, value) : element.removeAttribute(name),
  })
}

export function boolAttr<T extends Element, K extends keyof T>(
  prototype: T & { [key in K]: boolean },
  property: K,
  descriptor?: PropertyDescriptor
) {
  return attribute({
    prototype,
    property,
    descriptor,
    get: (element, name) => element.hasAttribute(name),
    set: (element, name, value: boolean) => element.toggleAttribute(name, Boolean(value)),
  })
}

export function unitAttr<T extends Element, K extends keyof T>(
  prototype: T & { [key in K]: number },
  property: K,
  descriptor?: PropertyDescriptor
) {
  return attribute({
    prototype,
    property,
    descriptor,
    get: (element, name) => Number(element.getAttribute(name)),
    set: (element, name, value: number) =>
      Number(value) == value
        ? element.setAttribute(name, value.toString())
        : element.removeAttribute(name),
  })
}

export function listAttr<T extends Element, K extends keyof T>(
  prototype: T & { [key in K]?: string[] },
  property: K,
  descriptor?: PropertyDescriptor
) {
  return attribute({
    prototype,
    property,
    descriptor,
    get: (element, name) =>
      element
        .getAttribute(name)
        ?.trim()
        .split(/\s+/)
        .filter(value => value)
        .map(value => value) ?? [],
    set: (element, name, values: unknown[]) =>
      values?.length > 0
        ? element.setAttribute(name, values.join(' '))
        : element.removeAttribute(name),
  })
}

export function numsAttr<T extends Element, K extends keyof T>(
  prototype: T & { [key in K]?: number[] },
  property: K,
  descriptor?: PropertyDescriptor
) {
  return attribute({
    prototype,
    property,
    descriptor,
    get: (element, name) =>
      element
        .getAttribute(name)
        ?.trim()
        .split(/\s+/)
        .filter(value => value)
        .map(value => Number(value)) ?? [],
    set: (element, name, values: unknown[]) =>
      values ? element.setAttribute(name, values.join(' ')) : element.removeAttribute(name),
  })
}

export function cssvar<T extends HTMLElement, K extends keyof T>(
  _prototype: T & { [key in K]: string },
  property: K,
  descriptor?: PropertyDescriptor
): any {
  let name = '--' + dashify(property.toString())
  return {
    get(this: T) {
      return this.style.getPropertyValue(name)
    },

    set(this: T, value: string) {
      this.style.setProperty(name, value)
      descriptor?.set?.call(this, value)
    },

    enumerable: true,
    configurable: true,
  }
}
