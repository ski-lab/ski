import { CustomHTMLElementConstructor } from './elements.js'
import { content } from './inject-document.js'
import { view } from './view.js'

export const dashDashTemplate = (source: string | DocumentFragment) => {
  if (!(source instanceof DocumentFragment)) source = document.createRange().createContextualFragment(source)

  var attrNodes = document.evaluate(`//*/attribute::*[starts-with(name(), '--')]`, source, null, XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE)

  let attributes = new Array(attrNodes.snapshotLength).fill(0).map((_, i) => {
    let attr = attrNodes.snapshotItem(i) as Attr
    return attr.name.slice(2) + '=' + attr.value
  })

  return <T extends CustomHTMLElementConstructor>(cls: T) => {
    for (const pair of new Set(attributes)) {
      const [attribute, property] = pair.split('=')
      view(`[--${attribute}="${property}"]`, attribute)(cls.prototype, property)
    }

    return content(source)(cls)
  }
}
