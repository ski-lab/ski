/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import { LazyMap, LazyWeakMap } from './lazy-map.js'

// set of wrapper functions for each method name of each object
const wrapped: LazyWeakMap<object, LazyMap<PropertyKey, Set<Function>>> = new LazyWeakMap(
  prototype =>
    new LazyMap(
      () => new Set<Function>(),
      prototype !== Object.prototype
        ? Array.from(wrapped.get(Object.getPrototypeOf(prototype)), ([key, set]) => [
            key,
            new Set(set),
          ])
        : null
    )
)

export function createHook<T extends object, A extends unknown[], R>(
  methodName: PropertyKey,
  callback: (this: T, original?: (...args: A) => R, ...args: A) => R
) {
  return <U extends T>(prototype: U) => {
    const hooks = wrapped.get(prototype).get(methodName)
    if (hooks.has(callback)) return
    hooks.add(callback)

    if (methodName == 'constructor') {
      Object.setPrototypeOf(
        prototype.constructor,
        class extends Object.getPrototypeOf(prototype.constructor) {
          constructor(...args: A) {
            super(...args)
            return callback.call(this as unknown as T, undefined, ...args) || this
          }
        }
      )
      return
    }

    let existingMethod = (prototype as any)[methodName]
    let method = function (this: T, ...args: A) {
      return callback.call(this, existingMethod?.bind(this), ...args)
    }

    Object.defineProperty(prototype, methodName, {
      value: method,
      configurable: true,
      enumerable: true,
    })
  }
}

export function once<T extends object, A extends unknown[], R>(
  callback: (this: T, $uper: (...args: A) => R, ...args: A) => R
) {
  const executed = new WeakSet<T>()
  return function (this: T, $uper?: (...args: A) => R, ...args: A) {
    if (executed.has(this)) return $uper?.call(this, ...args)
    executed.add(this)
    return callback.call(this, $uper?.bind<any>(this), ...args)
  }
}

export function redefineOwnProperty<T, K extends keyof T>(
  target: T,
  name: K,
  clone: (value?: T[K]) => T[K]
): T[K] {
  if (!Object.prototype.hasOwnProperty.call(target, name))
    Object.defineProperty(target, name, {
      value: clone(target[name]),
    })
  return target[name]
}
