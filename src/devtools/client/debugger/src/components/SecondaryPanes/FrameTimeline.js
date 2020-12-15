/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

//

import React, { Component } from "react";

import { connect } from "../../utils/connect";
import {
  getFramePositions,
  getSelectedFrame,
  getThreadContext,
  getThreadExecutionPoint,
} from "../../selectors";

import { getSelectedLocation } from "../../reducers/sources";

import actions from "../../actions";

import classnames from "classnames";
import "./FrameTimeline.css";

function getBoundingClientRect(element) {
  if (!element) {
    // $FlowIgnore
    return;
  }
  return element.getBoundingClientRect();
}

class FrameTimeline extends Component {
  _timeline;
  _marker;

  constructor(props) {
    super(props);
  }

  state = {
    scrubbing: false,
    scrubbingProgress: 0,
    lastDisplayIndex: 0,
  };

  componentDidUpdate(prevProps, prevState) {
    if (!document.body) {
      return;
    }

    // To please Flow.
    const bodyClassList = document.body.classList;

    if (this.state.scrubbing && !prevState.scrubbing) {
      document.addEventListener("mousemove", this.onMouseMove);
      document.addEventListener("mouseup", this.onMouseUp);
      bodyClassList.add("scrubbing");
    }
    if (!this.state.scrubbing && prevState.scrubbing) {
      document.removeEventListener("mousemove", this.onMouseMove);
      document.removeEventListener("mouseup", this.onMouseUp);
      bodyClassList.remove("scrubbing");
    }
  }

  getProgress(clientX) {
    const { width, left } = getBoundingClientRect(this._timeline);
    const progress = ((clientX - left) / width) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  getPosition(progress) {
    const { framePositions } = this.props;
    if (!framePositions) {
      return;
    }

    const numberOfPositions = framePositions.positions.length;
    const displayIndex = Math.floor((progress / 100) * numberOfPositions);

    // We cap the index to the actual existing indices in framePositions.
    // This way, we don't let the index reference an element that doesn't exist.
    // e.g. displayIndex = 3, framePositions.length = 3 => framePositions[3] is undefined
    const adjustedDisplayIndex = Math.min(displayIndex, numberOfPositions - 1);

    this.setState({ lastDisplayIndex: adjustedDisplayIndex });

    return framePositions.positions[adjustedDisplayIndex];
  }

  displayPreview(progress) {
    const { setPreviewPausedLocation } = this.props;

    const position = this.getPosition(progress);

    if (position) {
      setPreviewPausedLocation(position.location);
    }
  }

  onMouseDown = event => {
    const progress = this.getProgress(event.clientX);
    this.setState({ scrubbing: true, scrubbingProgress: progress });
  };

  onMouseUp = event => {
    const { seekToPosition, clearPreviewPausedLocation } = this.props;

    const progress = this.getProgress(event.clientX);
    const position = this.getPosition(progress);
    this.setState({ scrubbing: false });

    if (position) {
      seekToPosition(position.point, position.time);
      clearPreviewPausedLocation();
    }
  };

  onMouseMove = event => {
    const progress = this.getProgress(event.clientX);

    this.displayPreview(progress);
    this.setState({ scrubbingProgress: progress });
  };

  getVisibleProgress() {
    const { scrubbing, scrubbingProgress, lastDisplayIndex } = this.state;
    const { framePositions, selectedLocation, executionPoint } = this.props;

    if (!framePositions) {
      return 0;
    }

    if (scrubbing || !selectedLocation) {
      return scrubbingProgress;
    }

    // If we stepped using the debugger commands and the executionPoint is null
    // because it's being loaded, just show the last progress.
    if (!executionPoint) {
      return;
    }

    const filteredPositions = framePositions.positions.filter(
      position => BigInt(position.point) <= BigInt(executionPoint)
    );

    // Check if the current executionPoint's corresponding index is similar to the
    // last index that we stopped scrubbing on. If it is, just use the same progress
    // value that we had while scrubbing so instead of snapping to the executionPoint's
    // progress.
    if (lastDisplayIndex == filteredPositions.length - 1) {
      return scrubbingProgress;
    }

    return Math.floor((filteredPositions.length / framePositions.positions.length) * 100);
  }

  renderMarker() {
    return <div className="frame-timeline-marker" ref={r => (this._marker = r)} />;
  }

  renderProgress() {
    const progress = this.getVisibleProgress();

    return (
      <div
        className="frame-timeline-progress"
        style={{ width: `${progress}%`, maxWidth: "calc(100% - 2px)" }}
      />
    );
  }

  renderTimeline() {
    return (
      <div
        className="frame-timeline-bar"
        onMouseDown={this.onMouseDown}
        ref={r => (this._timeline = r)}
      >
        {this.renderProgress()}
        {this.renderMarker()}
      </div>
    );
  }

  render() {
    const { scrubbing } = this.state;
    const { framePositions } = this.props;

    if (!framePositions) {
      return null;
    }

    return (
      <div className={classnames("frame-timeline-container", { scrubbing })}>
        {this.renderTimeline()}
      </div>
    );
  }
}

const mapStateToProps = state => {
  const thread = getThreadContext(state).thread;
  const selectedFrame = getSelectedFrame(state, thread);
  const executionPoint = getThreadExecutionPoint(state, thread);

  return {
    framePositions: getFramePositions(state),
    selectedLocation: getSelectedLocation(state),
    selectedFrame,
    executionPoint,
  };
};

export default connect(mapStateToProps, {
  seekToPosition: actions.seekToPosition,
  setPreviewPausedLocation: actions.setPreviewPausedLocation,
  clearPreviewPausedLocation: actions.clearPreviewPausedLocation,
})(FrameTimeline);
