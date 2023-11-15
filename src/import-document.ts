const pending = new Map<URL, Promise<unknown>>()

const getTemplateContainer = () => {
  let container = document.body.querySelector<HTMLTemplateElement>('template.webcomponents')
  if (!container) {
    container = document.createElement('template')
    container.classList.add('webcomponents')
    document.body.appendChild(container)
  }
  return container
}

export async function importDocument(
  path: URL,
  ...dependencies: CustomElementConstructor[]
): Promise<DocumentFragment> {
  await pending.get(path)

  const container = getTemplateContainer()
  let template = container.content.querySelector(
    `[data-path="${path.pathname}"]`
  ) as HTMLTemplateElement

  if (!template) {
    let templatePromise = loadTemplate(path, dependencies)
    pending.set(path, templatePromise)
    template = document.createElement('template')
    template.dataset.path = path.pathname
    template.content.append(await templatePromise)
    container.content.append(template, '\n')
    pending.delete(path)
  }

  return template.content.cloneNode(true) as DocumentFragment
}

async function loadTemplate(
  contentpath: URL,
  dependencies: CustomElementConstructor[]
): Promise<DocumentFragment> {
  let res = await fetch(contentpath.href)
  let text = res.ok
    ? await res.text()
    : `<strong class="error">Could not load ${contentpath.href}</strong>`

  let fragment = await temporarilyChangeBaseURI(contentpath.href, () =>
    document.createRange().createContextualFragment(text)
  )

  return updateTemplate(contentpath, fragment, dependencies)
}

async function temporarilyChangeBaseURI<T>(value: string, callback: () => T) {
  document.head.insertAdjacentHTML('afterbegin', `<base href="${value}">`)
  let result = await Promise.resolve().then(callback)
  document.head.firstElementChild?.remove()
  return result
}

function updateTemplate(
  contentpath: URL,
  fragment: DocumentFragment,
  dependencies?: CustomElementConstructor[]
) {
  let result = contentpath.host == location.host ? pathRewrite(contentpath, fragment) : fragment
  if (dependencies) checkDependencies(contentpath.pathname, dependencies, result)
  return result
}

export function pathRewrite<T extends ParentNode>(
  basePath: URL,
  fragment: T,
  query = `img[src],script[src],link[href]`
): T {
  let result = fragment.cloneNode(true) as T
  for (let element of result.querySelectorAll<HTMLElement>(query)) {
    for (let attr of ['src', 'href']) {
      if (element.hasAttribute(attr)) {
        let newurl = new URL(element.getAttribute(attr)!, basePath)
        element.setAttribute(attr, newurl.href.replace(location.origin, ''))
        preload(newurl.href)
      }
    }
  }
  return result
}

const checkDependencies = async <T extends ParentNode>(
  path: string,
  dependencies: CustomElementConstructor[],
  fragment: T
) => {
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
}

function preload(url: string) {
  if (document.documentElement.hasAttribute('ssr')) {
    let href = url.replace(location.origin, '')
    let rel = url.endsWith('html') ? 'prefetch' : 'preload'
    let as = href.endsWith('css')
      ? 'style'
      : href.endsWith('js')
      ? 'script'
      : href.endsWith('html')
      ? 'document'
      : href.match(/png$|jpg$/)
      ? 'image'
      : ''

    if (as)
      document.head.insertAdjacentHTML('beforeend', `<link rel="${rel}" as="${as}" href="${href}">`)
  }
}
