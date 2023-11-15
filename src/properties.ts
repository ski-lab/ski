import { onConnected } from './connected-callback.js'

export const findPropertyDescriptor = (o: any, p: PropertyKey): PropertyDescriptor | undefined =>
  Object.getOwnPropertyDescriptor(o, p) || (o.__proto__ && findPropertyDescriptor(o.__proto__, p))

// This function only needs to be called for elements created before defining the custom-element class
export function upgradeOwnProperties(element: HTMLElement) {
  let properties = Object.getOwnPropertyDescriptors(element)

  let prototype = Object.getPrototypeOf(element)
  while (prototype !== HTMLElement.prototype) {
    let setters = Object.entries(Object.getOwnPropertyDescriptors(prototype)).filter(
      ([_, desc]) => desc.set
    )

    let target = element as any
    for (let [key] of setters)
      if (key in properties) {
        let value: any = target[key]
        console.log('upgraded', element.localName, key, value)
        delete target[key]
        target[key] = value
      }

    prototype = Object.getPrototypeOf(prototype)
  }
}

export const upgradeProperties = <T extends CustomElementConstructor>(constructor: T) => {
  onConnected(constructor.prototype, upgradeOwnProperties)
  return constructor
}

export function prop<T = unknown>(
  _prototype?: unknown,
  _property?: string | symbol,
  descriptor?: PropertyDescriptor
): any {
  let storage = new WeakMap<object, T>()
  let newdescriptor = {
    ...descriptor,

    get(this: object) {
      return storage.get(this)!
    },

    set(this: object, value: T) {
      descriptor?.set?.call(this, value)
      storage.set(this, value)
    },

    enumerable: true,
    configurable: true,
  }

  return newdescriptor
}
