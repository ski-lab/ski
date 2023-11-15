import { LazyWeakMap } from './lazy-map.js'

export class RunLock<T extends object> {
  viewlock = new LazyWeakMap<T, Set<PropertyKey>>(() => new Set())

  run<U>(object: T, property: PropertyKey, callback: () => U): U | undefined {
    let set = this.viewlock.get(object)
    if (!set.has(property)) {
      set.add(property)
      let result = callback()
      set.delete(property)
      return result
    }
  }
}
