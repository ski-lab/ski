/* eslint-disable @typescript-eslint/no-explicit-any */
import { registerPromise } from './async.js'
import { onConnected } from './connected-callback.js'
import { redefineOwnProperty } from './hook.js'
import { LazyMap } from './lazy-map.js'
import { findPropertyDescriptor, prop } from './properties.js'

interface ObservedPropertiesClass {
  observedPropertiesCallbacks: LazyMap<PropertyKey, PropertyKey[]>
  observedProperties: Set<PropertyKey>
}

export function propertyChanged(self: any, name: PropertyKey, value: unknown) {
  let cls = self.constructor as ObservedPropertiesClass

  if (cls.observedPropertiesCallbacks)
    for (let method of cls.observedPropertiesCallbacks.get(name)) registerPromise(self[method]?.call?.(self, value))
}

function addObservedProperty(prototype: any, name: PropertyKey) {
  let observedProperties = redefineOwnProperty(
    prototype.constructor as ObservedPropertiesClass,
    'observedProperties',
    observedProperties => new Set(observedProperties)
  )

  if (!observedProperties.has(name)) {
    Object.defineProperty(prototype, name, observed(prototype, name))
    observedProperties.add(name)
  }
}

function addObservedPropertyCallback(prototype: any, name: PropertyKey, callback: PropertyKey) {
  redefineOwnProperty(
    prototype.constructor as ObservedPropertiesClass,
    'observedPropertiesCallbacks',
    observedPropertiesCallbacks =>
      new LazyMap(
        () => [],
        Array.from(observedPropertiesCallbacks || [], ([key, list]) => [key, Array.from(list)])
      )
  )
    .get(name)
    .push(callback)
}

type Keys<T extends unknown[]> = T extends [infer K] ? K : T extends [infer K, ...infer R] ? K | Keys<R> : string

export const observe =
  <P extends PropertyKey[]>(...properties: P) =>
  <T, K extends PropertyKey>(prototype: K extends keyof T ? T & { [key in Keys<P>]?: unknown } : T, method: K) => {
    if (properties.length == 0) properties = guessProperties(prototype, method) as P
    for (let property of properties) {
      addObservedProperty(prototype, property)
      addObservedPropertyCallback(prototype, property, method)
    }
  }

function guessProperties(prototype: any, method: PropertyKey) {
  let properties: PropertyKey[] = []
  let proxy = new Proxy(
    {},
    {
      get(_, property) {
        properties.push(property)
        return ''
      },
    }
  )
  Object.getOwnPropertyDescriptor(prototype, method)?.get?.call(proxy)
  return properties
}

export const compute = <T = any>(apply: (params: T) => unknown) => {
  let properties =
    apply
      .toString()
      .match(/\(\{([^}]+)\}\)/)?.[1]
      .split(', ') || []

  return <K extends PropertyKey>(prototype: T, property: K, descriptor?: PropertyDescriptor): any => {
    let symbol = Symbol(`${compute.name}-${properties}->${property.toString()}`)
    Object.defineProperty(prototype, symbol, {
      value() {
        if (descriptor?.value) descriptor.value.call(this, apply(this))
        else this[property] = apply(this)
      },
    })
    observe(...properties)<any, PropertyKey>(prototype, symbol)
  }
}

export const observed = <T extends Element, K extends keyof T>(
  prototype: T,
  property: K,
  descriptor: PropertyDescriptor = findPropertyDescriptor(prototype, property) || prop()
): any => {
  let previousValue = new WeakMap<T, unknown>()

  if (descriptor.value)
    return <ThisType<T>>{
      ...descriptor,
      value(...args: unknown[]) {
        let value = descriptor.value.apply(this, args)
        propertyChanged(this, property, value)
        return value
      },
    }
  else
    return <ThisType<T>>{
      ...descriptor,
      set(value: unknown) {
        if (value !== previousValue.get(this)) {
          previousValue.set(this, value)
          descriptor.set?.call(this, value)
          propertyChanged(this, property, value)
        }
      },
    }
}

// Based on https://github.com/fluorumlabs/css-variable-observer/blob/master/src/index.ts
// Based on https://github.com/saviski/ski-mixins/blob/master/src/in/css-properties.ts
export const observeNumericCSSVariable =
  (...properties: `--${string}`[]) =>
  (prototype: HTMLElement, _property: PropertyKey, descriptor: TypedPropertyDescriptor<(...args: number[]) => any>) => {
    onConnected(prototype, element => {
      let sensor = document.createElement('ins')
      sensor.toggleAttribute('numeric-css-property-sensor', true)
      sensor.style.transitionProperty = 'font-variation-settings, width, color'
      sensor.style.transitionDuration = '0.001ms'
      sensor.style.transitionTimingFunction = 'step-start'
      sensor.style.fontVariationSettings = properties
        .map((property, index) => {
          const ascii4 = index.toString().padStart(4, 'a')
          return `'${ascii4}' var(${property}, 0)`
        })
        .join(',')

      const cssVarUpdated = () => {
        const computedStyle = getComputedStyle(sensor)
        let values = properties.map(property => computedStyle.getPropertyValue(property))
        if (values.every(value => value !== '')) descriptor.value?.call(element, ...values.map(Number))
      }

      sensor.ontransitionrun = cssVarUpdated
      element.shadowRoot!.append(sensor)
      cssVarUpdated()
    })
  }

export const observeElement = (elements: Element[], attribute: string, callback: () => void) => {
  if (!attribute && elements.length == 0) return

  let observer = new MutationObserver(callback)
  for (let element of elements)
    attribute == 'textContent'
      ? observer.observe(element, {
          childList: true,
        })
      : observer.observe(element, {
          attributeFilter: [attribute],
        })
}
