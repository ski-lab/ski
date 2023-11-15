export class LazyMap<K, V> extends Map<K, V> {
  constructor(
    protected initializer: (this: LazyMap<K, V>, key: K) => V,
    entries?: readonly (readonly [K, V])[] | null
  ) {
    super(entries)
  }

  get(key: K): V {
    let result: V
    if (super.has(key)) result = super.get(key)!
    else {
      result = this.initializer.call(this, key)
      super.set(key, result)
    }
    return result
  }
}

export class LazyWeakMap<K extends object, V> extends WeakMap<K, V> {
  constructor(
    protected initializer: (this: LazyWeakMap<K, V>, key: K) => V,
    entries?: readonly [K, V][] | null
  ) {
    super(entries)
  }

  get(key: K): V {
    let result: V
    if (super.has(key)) result = super.get(key)!
    else {
      result = this.initializer.call(this, key)
      super.set(key, result)
    }
    return result
  }

  maybeGet(key: K): V | undefined {
    return super.get(key)
  }
}
