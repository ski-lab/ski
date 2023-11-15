/* eslint-disable @typescript-eslint/no-explicit-any */

export default function deepAssign<T, S extends Partial<T>>(target: T, source = {} as S): T {
  let result: any = target
  for (const [key, val] of Object.entries<any>(source)) {
    if (val !== null && typeof val === `object` && !Array.isArray(val)) {
      let object = new val.__proto__.constructor()
      deepAssign(object, val)
      try {
        result[key] = object
      } catch {
        deepAssign(result[key], object)
      }
    } else result[key] = val
  }
  return result
}
