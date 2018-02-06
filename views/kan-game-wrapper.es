import React, { Component } from 'react'
import { remote } from 'electron'
import { connect } from 'react-redux'
import WebView from 'react-electron-web-view'
import { get, debounce } from 'lodash'

import { PoiAlert } from './components/info/alert'
import PoiMapReminder from './components/info/map-reminder'
import { PoiControl } from './components/info/control'
import { layoutResizeObserver } from 'views/services/layout'

const config = remote.require('./lib/config')
const poiControlHeight = 30
const getTitlebarHeight = () => {
  if (document.querySelector('title-bar') && getComputedStyle(document.querySelector('title-bar')).display === 'none') {
    return 0
  } else {
    return config.get('poi.useCustomTitleBar', process.platform === 'win32' || process.platform === 'linux') ? 29 : 0
  }
}

export const KanGameWrapper = connect((state, props) => ({
  configWebviewWidth: get(state, 'config.poi.webview.width', -1),
  zoomLevel: get(state, 'config.poi.zoomLevel', 1),
  layout: get(state, 'config.poi.layout', 'horizontal'),
  muted: get(state, 'config.poi.content.muted', false),
}))(class kanGameWrapper extends Component {
  state = {
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
  }

  setWindowSize = () => {
    this.setState({
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    })
    try {
      document.querySelector('kan-game webview').executeJavaScript('window.align()')
    } catch(e) {
      return
    }
  }

  componentDidMount = () => {
    this.setWindowSizeDebounced = debounce(this.setWindowSize, 200)
    window.addEventListener('resize', this.setWindowSizeDebounced)
    layoutResizeObserver.observe(document.querySelector('kan-game webview'))
  }

  componentWillUnmount = () => {
    window.removeEventListener('resize', this.setWindowSizeDebounced)
    layoutResizeObserver.unobserve(document.querySelector('kan-game webview'))
  }

  componentDidUpdate = () => {
    const { width, height } = this.webviewWrapper.getBoundingClientRect()
    this.props.dispatch({
      type: '@@LayoutUpdate/webview/size',
      value: {
        width,
        height,
      },
    })
  }

  render () {
    const { configWebviewWidth , zoomLevel, layout, muted } = this.props
    const { windowHeight, windowWidth } = this.state
    const useFixedResolution = configWebviewWidth !== -1
    const isHorizontal = layout === 'horizontal'
    const titleBarHeight = getTitlebarHeight()
    const zoomedPoiControlHeight = Math.floor(poiControlHeight * zoomLevel)
    let webviewWidth = configWebviewWidth
    let webviewHeight = Math.min(windowHeight - zoomedPoiControlHeight - titleBarHeight , Math.round(configWebviewWidth / 800.0 * 480.0))
    if (!useFixedResolution) {
      if (isHorizontal) {
        webviewHeight = windowHeight - zoomedPoiControlHeight - titleBarHeight
        webviewWidth = Math.round(webviewHeight / 480.0 * 800.0)
      } else {
        webviewWidth = windowWidth
        webviewHeight = Math.round(webviewWidth / 800.0 * 480.0)
      }
    }
    return (
      <kan-game style={{
        flexBasis: (isHorizontal ? webviewWidth : webviewHeight + zoomedPoiControlHeight),
        flexGrow: 0,
        flexShrink: 1,
        ... isHorizontal ? {
          height: webviewHeight + zoomedPoiControlHeight,
        } : {
          width: '100%',
        },
      }}>
        <div id="webview-wrapper"
          className="webview-wrapper"
          ref={e => this.webviewWrapper = e}
          style={{
            maxWidth: webviewWidth,
          }}>
          <WebView
            src={config.get('poi.homepage', 'http://www.dmm.com/netgame/social/application/-/detail/=/app_id=854854/')}
            plugins
            disablewebsecurity
            webpreferences="allowRunningInsecureContent=no"
            preload="./assets/js/webview-preload.js"
            style={{
              width: '100%',
              paddingTop: '60%',
              position: 'relative',
              display: webviewWidth > -0.00001 && webviewWidth < 0.00001 ? 'none' : null,
            }}
            muted={muted}
          />
        </div>
        <poi-info style={{ flexBasis: poiControlHeight }}>
          <poi-control><PoiControl /></poi-control>
          <poi-alert><PoiAlert id='poi-alert' /></poi-alert>
          <poi-map-reminder><PoiMapReminder id='poi-map-reminder'/></poi-map-reminder>
        </poi-info>
      </kan-game>
    )
  }
})
