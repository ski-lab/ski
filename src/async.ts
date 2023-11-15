const promiseList = new Set<Promise<unknown>>()

export function registerPromise<T>(promise: T): T {
  if (promise instanceof Promise) {
    promiseList.add(promise)
    promise.finally(() => promiseList.delete(promise))
  }
  return promise
}

// @ts-ignore
globalThis.registerPromise = registerPromise

// @ts-ignore
globalThis.pendingPromises = () => Promise.allSettled(promiseList)

export function consoleTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  ...message: any[]
): Promise<T> {
  let id = setTimeout(() => console.warn(...message), timeout)
  promise.finally(() => clearTimeout(id))
  return promise
}
