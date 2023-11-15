import { elementDecorator } from './elements.js'
import { LazyWeakMap } from './lazy-map.js'

const placeholders = new LazyWeakMap<HTMLElement, ChildNode>(({ localName }) =>
  document.createComment(localName)
)

const selectors = new LazyWeakMap<HTMLElement, Map<string, HTMLElement[]>>(() => new Map())

export const toggleElement = <V>(selector: string, show: (value: V) => boolean = Boolean) =>
  elementDecorator<V>({
    elements: host => {
      let map = selectors.get(host)
      if (!map.has(selector)) map.set(selector, Array.from(host.querySelectorAll(selector)))
      return map.get(selector)!
    },

    apply(element, value) {
      let visible = show(value)
      if (visible && !element.isConnected) placeholders.get(element).replaceWith(element)
      if (!visible && element.isConnected) element.replaceWith(placeholders.get(element))
    },
  })
