import { registerPromise } from './async.js'

export const debounce =
  (timeout: number = 20) =>
  (_prototype: unknown, _property: PropertyKey, descriptor: PropertyDescriptor): any => {
    const timer = new WeakMap<object, number>()
    const resolvers = new Map<number, (run: boolean) => void>()
    return {
      ...descriptor,
      value(this: any, ...args: unknown[]) {
        registerPromise(
          new Promise<boolean>(resolve => {
            let t = timer.get(this)!
            clearTimeout(t)
            resolvers.get(t)?.(false)
            t = setTimeout(() => resolve(true), timeout) as any
            timer.set(this, t)
            resolvers.set(t, resolve)
          }).then(run => {
            if (run) descriptor.value!.call(this, ...args)
          })
        )
      },
    }
  }

export const checkprevious =
  (
    identifier: string,
    test: (value: string, previous: string) => boolean = (value, previous) => previous == value
  ) =>
  (
    _prototype: Element,
    _method: PropertyKey,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
  ): any => {
    return {
      ...descriptor,
      value(this: Element, ...values: unknown[]) {
        let value = values.join(' ')
        const text = `${identifier} ${value}`

        let host = this // eslint-disable-line @typescript-eslint/no-this-alias
        while (host.getRootNode() instanceof ShadowRoot)
          host = (<ShadowRoot>host.getRootNode()).host

        for (let child of host.childNodes)
          if (child instanceof Comment)
            if (child.textContent?.startsWith(identifier)) {
              child.remove()
              let previous = child.textContent.substring(identifier.length + 1)
              if (test(value, previous)) {
                return
              }
            }

        let result = descriptor.value!.call(this, ...values)
        host.prepend(document.createComment(text))
        return result
      },
    }
  }
