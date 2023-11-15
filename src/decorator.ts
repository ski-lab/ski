/* eslint-disable @typescript-eslint/no-explicit-any */
import { registerPromise } from './async.js'
import { onConnected } from './connected-callback.js'
import { findPropertyDescriptor } from './properties.js'

type NonVoid = {} // eslint-disable-line @typescript-eslint/ban-types
type AnyMethod<R = any> = (...args: any[]) => R
type HasReturnValue<T, R = NonVoid> = T extends AnyMethod ? AnyMethod<R> : R

export type Decorator<T, V> = <K extends string | symbol>(
  prototype: K extends keyof T ? T & Record<K, HasReturnValue<T[K], V>> : T,
  property: K,
  descriptor?: PropertyDescriptor
) => void

export const decorator = <T extends object, V>({
  apply,
  async,
  get,
  init,
  decorate,
}: {
  apply?: (self: T, value: V, property: string | symbol) => void
  async?: (self: T, value: Promise<V>, property: string | symbol) => Promise<any>
  get?: (self: T, property: string | symbol) => V
  init?: (self: T, property: string | symbol) => void
  decorate?: (prototype: T, property: string | symbol, descriptor?: PropertyDescriptor) => any
}): Decorator<T, V> =>
  ////
  function (
    prototype: T,
    property: string | symbol,
    descriptor = findPropertyDescriptor(prototype, property)
  ): any {
    ////
    decorate?.(prototype, property, descriptor)
    if (init) onConnected<any>(prototype, self => init(self, property))

    function execute(self: T, value: V | Promise<V>) {
      if (apply)
        value instanceof Promise
          ? registerPromise(value.then(resolved => apply(self, resolved, property)))
          : apply(self, value, property)
      else if (async)
        registerPromise(
          async(self, value instanceof Promise ? value : Promise.resolve(value), property)
        )
    }

    let result: PropertyDescriptor = {
      enumerable: true,
      configurable: true,
    }

    if (!descriptor && get) {
      // @decorator declare prop: type with custom getter
      result.set = function (this: T, value: V) {
        execute(this, value)
      }

      result.get = function (this: T): V {
        return get(this, property)
      }
    } else if (!descriptor) {
      // @decorator declare prop: type without custom getter
      let storage = new WeakMap<T, V>()

      result.set = function (this: T, value: V) {
        storage.set(this, value)
        execute(this, value)
      }

      result.get = function (this: T) {
        return storage.get(this)
      }
    } else if (descriptor.value) {
      // @decorator method(), ignores custom getter

      result.value = function run(this: T, ...args: unknown[]) {
        let value = descriptor.value.apply(this, args)
        execute(this, value)
        return value
      }
    } else if (descriptor.set) {
      // @decorator
      // set prop(val: type)
      // get prop(): type, will be overriden by custom getter

      // @decorator set prop(val: type) with custom getter

      result.set = function (this: T, value: V) {
        descriptor.set!.call(this, value)
        execute(this, descriptor.get ? descriptor.get.call(this) : value)
      }

      result.get = get
        ? function (this: T): V {
            return get(this, property)
          }
        : descriptor.get ||
          (() => {
            console.warn(`${prototype.constructor.name}.${property.toString()} is missing a getter`)
          })
      ////
    } else if (descriptor.get) {
      // @decorator get prop(): type without set, ignores custom getter

      result.get = function (this: T): V {
        let value = descriptor.get!.call(this)
        execute(this, value)
        return value
      }
    }

    return result
  }
