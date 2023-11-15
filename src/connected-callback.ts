import { createHook, once, redefineOwnProperty } from './hook.js'

interface ConnectedCallbacks {
  connectedCallbacks: Set<(element: HTMLElement, constructor: unknown) => void>
}

const setupConnectedCallback = createHook<HTMLElement, [], void>(
  'connectedCallback',
  once(function connectedCallback(this: HTMLElement, original) {
    if (!this.isConnected) return
    original?.()
    const cls = (<unknown>this.constructor) as ConnectedCallbacks
    for (let callback of cls.connectedCallbacks) callback(this, cls)
  })
)

/**
 *
 * @param prototype Custom Element class.prototype
 * @param callback Callback function to run when the component connectedCallback is called
 *
 * From MDN:
 * connectedCallback: Invoked each time the custom element is appended into a document-connected element.
 * This will happen each time the node is moved, and may happen before the element's contents have been fully parsed.
 */
export const onConnected = <T extends HTMLElement>(
  prototype: T,
  callback: (host: T, constructor: any) => void
) => {
  setupConnectedCallback(prototype)
  redefineOwnProperty(
    (<unknown>prototype.constructor) as ConnectedCallbacks,
    'connectedCallbacks',
    connectedCallbacks => new Set(connectedCallbacks)
  ).add(<any>callback)
}
