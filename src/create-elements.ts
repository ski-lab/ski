import { consoleTimeout } from './async.js'
import deepAssign from './deep-assign.js'

export type CreateElement<T extends Element = Element> =
  | string
  | CustomElementConstructor
  | ((props: Partial<T>) => T)

/**
 * Creates a collection of elements based on data from list and appends it to parent element
 * @param parent Container element
 * @param type tag-name, cuustom element class ou a function that returns a custom element class
 * @param list iterable
 * @param common commom properties values to be applied to all elements
 * @param adjacent append elements after parent instead of inside as children
 * @returns {Promise} A promise that resolves when the elements are created if the element type is
 * a custom element that has not yet been defined
 */
export default async function createElements<T extends Element>({
  parent,
  type,
  list,
  defaults = {},
  adjacent = false,
}: {
  parent: Element
  type: CreateElement<T>
  list: Iterable<Partial<Element>>
  defaults?: Partial<T>
  adjacent?: boolean
}): Promise<T[]> {
  if (typeof type == 'string' && type.includes('-'))
    await consoleTimeout(
      customElements.whenDefined(type),
      10000,
      type,
      'custom element was not defined in 10 seconds',
      'create-elements at',
      parent
    )

  let template =
    parent.firstElementChild instanceof HTMLTemplateElement && parent.firstElementChild.content

  const build = (factory = type, props?: unknown): T =>
    <any>(
      (typeof factory == 'function'
        ? Object.prototype.isPrototypeOf.call(HTMLElement, factory)
          ? new (<CustomElementConstructor>factory)()
          : (<any>factory)(props)
        : template
        ? template.cloneNode(true)
        : document.createElement(factory))
    )

  const elements = Array.from(list, partial => {
    if (partial instanceof Node) return deepAssign(<T>partial, defaults)
    if (partial) {
      let { tagName = type, ...properties } = partial
      return <T>deepAssign<any, any>(deepAssign(build(tagName, properties), defaults), properties)
    }
    return build(type)
  })

  parent[adjacent ? 'after' : 'append'](...elements)
  return elements
}
