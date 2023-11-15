import { CustomHTMLElement } from './elements.js'
import { upgradeOwnProperties } from './properties.js'

export const content = (
  source: DocumentFragment | string,
  ...dependencies: CustomElementConstructor[]
) => {
  checkDependencies('content', dependencies)

  let content =
    typeof source == 'string' ? document.createRange().createContextualFragment(source) : source

  return <T extends new (...args: any[]) => CustomHTMLElement>(cls: T) =>
    // won't change cls.prototype, only (constructor) cls.__proto__
    Object.setPrototypeOf(
      cls,
      class extends (Object.getPrototypeOf(cls) as T) {
        constructor(...args: any[]) {
          super(...args)
          const root = this.shadowRoot || this.attachShadow({ mode: 'open' })

          let contents = content.cloneNode(true) as DocumentFragment
          stylesheetsBlocksPaint(contents)
          // TODO: clear previous content if any?
          root.append(contents)

          // Element was created before customElements.define() was called
          if (this.isConnected) setTimeout(() => upgradeOwnProperties(this), 0)
        }
      }
    )
}

const checkDependencies = (path: string, dependencies: CustomElementConstructor[]) =>
  async function <T extends ParentNode>(fragment: T) {
    let dependencySet = new Set(dependencies)

    let customTags = Array.from(
      new Set(
        Array.from(fragment.querySelectorAll('*'), element => element.localName).filter(tagname =>
          tagname.includes('-')
        )
      )
    )

    let tagMap = new Map(customTags.map(tagname => [tagname, customElements.get(tagname)]))

    let missingDependencies = Array.from(
      new Map(
        Array.from(tagMap.entries()).filter(([_, cls]) => !cls || !dependencySet.has(cls))
      ).keys()
    )

    if (missingDependencies.length > 0)
      console.warn('missing dependency', path, ...missingDependencies)

    return fragment
  }

async function stylesheetsBlocksPaint(root: DocumentFragment) {
  if ('SSR' in window) return
  const links = root.querySelectorAll('link')
  if (links.length > 0) {
    let style = document.createElement('style')
    style.textContent = /*css*/ `* { display: none !important }`
    root.append(style)
    await Promise.all(
      Array.from(links, link => new Promise(loaded => link.addEventListener('load', loaded)))
    ).then(() => style.remove())
  }
}
