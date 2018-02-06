import { debounce } from 'lodash'
import { remote } from 'electron'

const {config, $} = window

const additionalStyle = document.createElement('style')

remote.getCurrentWindow().webContents.on('dom-ready', (e) => {
  document.head.appendChild(additionalStyle)
})

const setCSS = ({ layout, zoomLevel }) => {
  const tabSize = ($('.poi-tab-container:last-child .poi-tab-contents') || $('.poi-tab-container .poi-tab-contents')).getBoundingClientRect()
  const panelRect = $('poi-nav-tabs').getBoundingClientRect()
  const { right, bottom } =  config.get('poi.webview.width', -1) !== 0 ?
    $('kan-game webview').getBoundingClientRect() : { right: window.innerWidth, bottom: window.innerHeight, width: 0 }
  // Apply css
  additionalStyle.innerHTML = `
div[role='tooltip'], .poi-app-container, poi-info {
  ${zoomLevel !== 1 ? `zoom: ${zoomLevel};` : ''}
}
.dropdown-menu[aria-labelledby=plugin-dropdown] {
  max-height: ${tabSize.height}px;
}
.grid-menu ul[aria-labelledby=plugin-dropdown] {
  max-width: ${tabSize.width}px;
  width: ${panelRect.width * 0.875}px;
}
.toast-poi {
  bottom: ${window.innerHeight - bottom + 12}px;
  right: ${window.innerWidth - right + 12}px;
}`

  // Resize when window size smaller than webview size
  const useForceResize = config.get('poi.webview.width', -1) > 0
  if (useForceResize) {
    const realWidth = config.get('poi.webview.width', -1)
    const realHeight = Math.floor(realWidth * 0.6 + $('poi-info').clientHeight * zoomLevel)
    if (layout === 'vertical' && realWidth > window.innerWidth) {
      let { width, height, x, y } = remote.getCurrentWindow().getBounds()
      const borderX = width - window.innerWidth
      width = realWidth + borderX
      remote.getCurrentWindow().setBounds({ width, height, x, y })
    }

    if (layout !== 'vertical' && realHeight > window.getStore('layout.window.height')) {
      let { width, height, x, y } = remote.getCurrentWindow().getBounds()
      console.log(width, height, x, y, window.getStore('layout.window.height'))
      height += realHeight - window.getStore('layout.window.height')
      remote.getCurrentWindow().setBounds({ width, height, x, y })
    }
  }
}

const setCSSDebounced = debounce(setCSS, 200)

const adjustSize = () => {
  const layout = config.get('poi.layout', 'horizontal')
  const zoomLevel = config.get('poi.zoomLevel', 1)
  // Apply calcualted data
  setCSSDebounced({
    layout,
    zoomLevel,
  })
  window.dispatch({
    type: '@@LayoutUpdate/webview/useFixedResolution',
    value: window.getStore('config.poi.webview.width', -1) !== -1,
  })
}

adjustSize()

const changeBounds = () => {
  const {width, height, x, y} = remote.getCurrentWindow().getBounds()
  const borderX = width - window.innerWidth
  const borderY = height - window.innerHeight
  let newHeight = window.innerHeight
  let newWidth = window.innerWidth
  if (config.get('poi.layout', 'horizontal') === 'horizontal') {
    // Previous vertical
    newHeight = window.innerWidth / 800 * 480 + 30
    newWidth = window.innerWidth / 5 * 7
  } else {
    // Previous horizontal
    newHeight = window.innerWidth / 7 * 5 / 800 * 480 + 420
    newWidth = window.innerWidth / 7 * 5
  }
  remote.getCurrentWindow().setBounds({
    x,
    y,
    width: parseInt(newWidth + borderX),
    height: parseInt(newHeight + borderY),
  })
}

window.addEventListener('game.start', adjustSize)
window.addEventListener('resize', adjustSize)

config.on('config.set', (path, value) => {
  switch (path) {
  case 'poi.zoomLevel':
  case 'poi.panelMinSize':
  case 'poi.tabarea.double':
  case 'poi.webview.width':
  case 'poi.reverseLayout': {
    adjustSize()
    break
  }
  case 'poi.layout': {
    const current = remote.getCurrentWindow()
    const resizable = current.isResizable()
    const maximizable = current.isMaximizable()
    const fullscreenable = current.isFullScreenable()
    current.setResizable(true)
    current.setMaximizable(true)
    current.setFullScreenable(true)

    changeBounds()
    // window.dispatchEvent(new Event('resize'))

    current.setResizable(resizable)
    current.setMaximizable(maximizable)
    current.setFullScreenable(fullscreenable)

    adjustSize()
    break
  }
  default:
    break
  }
})

export const layoutResizeObserver = new ResizeObserver(entries => {
  let value = {}
  entries.forEach(entry => {
    const key = entry.target.tagName === 'POI-MAIN'
      ? 'window' : entry.target.tagName === 'WEBVIEW'
        ? 'webview' : entry.target.className.includes('miniship-fleet-content')
          ? 'minishippane' : entry.target.className.includes('ship-tab-container')
            ? 'shippane' : entry.target.className.includes('main-panel-content')
              ? 'mainpane': null
    value = {
      ...value,
      [key]: {
        width: entry.contentRect.width,
        height: entry.contentRect.height,
        ...key === 'webview' ? {
          useFixedResolution: window.getStore('config.poi.webview.width', -1) !== -1,
        } : {},
      },
    }
  })
  window.dispatch({
    type: '@@LayoutUpdate',
    value,
  })
})
