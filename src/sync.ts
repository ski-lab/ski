import { onConnected } from './connected-callback.js'
import { prop } from './properties.js'

export const observeElementProperty = <P extends string | symbol>(
  selector: string,
  property: P,
  event = 'change'
) => {
  type Property = Record<P, any>

  return <T extends HTMLElement, K extends keyof T>(
    prototype: T,
    field: K,
    descriptor: PropertyDescriptor = prop()
  ): any => {
    ////
    onConnected(prototype, host => {
      const target = host.shadowRoot?.querySelector(selector)
      const child = target as Property

      target?.addEventListener(event, () => (host[field] = child[property]))
      if (target && host[field] != child[property]) host[field] = child[property]
    })

    let newdescriptor = {
      ...descriptor,

      set(this: Element, value: unknown) {
        descriptor.set?.call(this, value)
        let element: any = this.shadowRoot?.querySelector(selector)
        if (element) element[property] = value
      },
    }
    return newdescriptor
  }
}
