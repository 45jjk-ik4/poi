const { ROOT } = window
import React, { Component, Fragment } from 'react'
import { OverlayTrigger, Tooltip } from 'react-bootstrap'
import { connect } from 'react-redux'
import { join as joinString, range, get } from 'lodash'
import { join } from 'path-extra'
import { createSelector } from 'reselect'
import cls from 'classnames'
import FA from 'react-fontawesome'

const { i18n } = window

const __ = i18n.main.__.bind(i18n.main)

import { Avatar } from 'views/components/etc/avatar'
import { CountdownNotifierLabel } from './countdown-timer'
import {
  repairsSelector,
  constSelector,
  shipsSelector,
  miscSelector,
  inRepairShipsIdSelector,
  createDeepCompareArraySelector,
} from 'views/utils/selectors'
import { indexify, timeToString } from 'views/utils/tools'

import '../assets/repair-panel.css'

const inRepairShipsDataSelector = createSelector([
  inRepairShipsIdSelector,
  shipsSelector,
], (inRepairShipsId, ships) => inRepairShipsId.map((shipId) => ships[shipId])
)

const EmptyDock = ({ state }) => (
  <div className="empty-dock">
    <FA name={state === 0 ? 'bath' : 'lock'} />
  </div>
)

const getPanelDimension = width => {
  if (width > 700) {
    return 4
  }
  if (width > 350) {
    return 2
  }
  return 1
}

export default connect(
  createDeepCompareArraySelector([
    repairsSelector,
    constSelector,
    inRepairShipsDataSelector,
    miscSelector,
    state => get(state, 'config.poi.enableAvatar', true),
    state => getPanelDimension(get(state, 'layout.combinedpane.width', 250)),
  ], (repairs, {$ships}, inRepairShips, {canNotify}, enableAvatar, dimension) => ({
    repairs,
    $ships,
    inRepairShips,
    canNotify,
    enableAvatar,
    dimension,
  }))
)(class RepairPanel extends Component {
  getLabelStyle = (props, timeRemaining) => {
    return (
      timeRemaining > 600 ? 'primary' :
        timeRemaining > 60 ? 'warning' :
          timeRemaining >= 0 ? 'success' :
            'default'
    )
  }
  static basicNotifyConfig = {
    type: 'repair',
    title: __('Docking'),
    message: (names) => `${joinString(names, ', ')} ${__('repair completed')}`,
    icon: join(ROOT, 'assets', 'img', 'operation', 'repair.png'),
    preemptTime: 60,
  }
  render() {
    const {canNotify, repairs, $ships, inRepairShips, enableAvatar, dimension} = this.props
    // The reason why we use an array to pass in inRepairShips and indexify it
    // into ships, is because by passing an array we can make use of
    // createDeepCompareArraySelector which only deep compares arrays, and
    // by indexifying it into an object, it becomes easier to use.
    const ships = indexify(inRepairShips)
    return (
      <Fragment>
        {
          range(0, 4).map((i) => {
            const emptyRepair = {
              api_complete_time: 0,
              api_complete_time_str: '0',
              api_item1: 0,
              api_item2: 0,
              api_item3: 0,
              api_item4: 0,
              api_ship_id: 0,
              api_state: 0,
            }
            const dock = repairs[i] || emptyRepair
            const dockName =
              dock.api_state == -1 ? __('Locked') :
                dock.api_state == 0 ? __('Empty') :
                  i18n.resources.__($ships[ships[dock.api_ship_id].api_ship_id].api_name)
            const completeTime = dock.api_complete_time || -1
            let hpPercentage
            if (dock.api_state > 0) {
              hpPercentage = (100 * get(ships, [dock.api_ship_id, 'api_nowhp'])) / get(ships, [dock.api_ship_id, 'api_maxhp'])
            }
            return (
              <div key={i} className={cls('panel-item', 'ndock-item', {avatar : enableAvatar})} style={{ flexBasis: `${100 / dimension}%` }}>
                {
                  enableAvatar &&
                  <Fragment>
                    {
                      dock.api_state > 0
                        ? <Avatar
                          height={20}
                          mstId={get(ships, [dock.api_ship_id, 'api_ship_id'])}
                          isDamaged={hpPercentage <= 50}
                        />
                        : <EmptyDock state={dock.api_state} />
                    }
                  </Fragment>
                }
                <span className="ndock-name">{dockName}</span>

                <OverlayTrigger placement='left' overlay={
                  <Tooltip id={`ndock-finish-by-${i}`} style={dock.api_state < 0 && {display: 'none'}}>
                    <strong>{__("Finish by : ")}</strong>{timeToString(completeTime)}
                  </Tooltip>
                }>
                  <div>
                    <CountdownNotifierLabel
                      timerKey={`ndock-${i+1}`}
                      completeTime={completeTime}
                      getLabelStyle={this.getLabelStyle}
                      getNotifyOptions={() => canNotify && (completeTime >= 0) && {
                        ...this.constructor.basicNotifyConfig,
                        args: dockName,
                        completeTime: completeTime,
                      }}
                    />
                  </div>
                </OverlayTrigger>
              </div>
            )
          })
        }
      </Fragment>
    )
  }
})
