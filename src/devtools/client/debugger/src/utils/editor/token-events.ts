/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import { SourceLocation } from "@replayio/protocol";
import isEqual from "lodash/isEqual";

type $FixTypeLater = any;

function isValidToken(target: HTMLElement | null) {
  if (!target || !target.innerText || target.closest(".toggle-widget")) {
    return false;
  }

  const tokenText = target.innerText.trim();
  const cursorPos = target.getBoundingClientRect();

  // exclude literal tokens where it does not make sense to show a preview
  const invalidType = ["cm-atom", ""].includes(target.className);
  if (invalidType) {
    return false;
  }

  // exclude syntax where the expression would be a syntax error
  const invalidToken = tokenText === "" || tokenText.match(/^[(){}\|&%,.;=<>\+-/\*\s](?=)/);
  if (invalidToken) {
    return false;
  }

  // exclude codemirror elements that are not tokens
  const invalidTarget =
    (target.parentElement && !target.parentElement.closest(".CodeMirror-line")) ||
    cursorPos.top == 0;
  if (invalidTarget) {
    return false;
  }

  const invalidClasses = [
    "editor-mount",
    "CodeMirror-gutter-wrapper",
    "CodeMirror-line",
    "CodeMirror-gutter-elt",
    "cm-tag",
    "cm-string",
    "cm-keyword",
  ];
  if (invalidClasses.some(className => target.classList.contains(className))) {
    return false;
  }

  // @ts-expect-error "role" doesn't exist on NamedNodeMap?
  if (target.attributes.role?.value == "presentation") {
    return false;
  }

  const invalidContainers = [".popover", ".breakpont-panel", ".panel-editor"];
  if (invalidContainers.some(selector => target.closest(selector))) {
    return false;
  }

  return true;
}

function dispatch(codeMirror: $FixTypeLater, eventName: string, data: any) {
  codeMirror.constructor.signal(codeMirror, eventName, data);
}

function invalidLeaveTarget(target: HTMLElement | null) {
  if (!target || target.closest(".popover")) {
    return true;
  }

  return false;
}

export function onTokenMouseOver(codeMirror: $FixTypeLater) {
  let prevTokenPos: SourceLocation | null = null;

  function onMouseLeave(event: MouseEvent) {
    if (invalidLeaveTarget(event.relatedTarget as HTMLElement)) {
      return addMouseLeave(event.target as HTMLElement);
    }

    prevTokenPos = null;
    dispatch(codeMirror, "tokenleave", event);
  }

  function addMouseLeave(target: HTMLElement) {
    target.addEventListener("mouseleave", onMouseLeave, {
      capture: true,
      once: true,
    });
  }

  return (enterEvent: MouseEvent) => {
    const target = enterEvent.target as HTMLElement;

    if (!isValidToken(target)) {
      return;
    }

    const tokenPos = getTokenLocation(codeMirror, target);

    if (!isEqual(prevTokenPos, tokenPos)) {
      addMouseLeave(target);

      dispatch(codeMirror, "tokenenter", {
        event: enterEvent,
        target,
        tokenPos,
      });
      prevTokenPos = tokenPos;
    }
  };
}

export function getTokenLocation(codeMirror: $FixTypeLater, tokenEl: HTMLElement): SourceLocation {
  const { left, top, width, height } = tokenEl.getBoundingClientRect();
  const { line, ch } = codeMirror.coordsChar({
    left: left + width / 2,
    top: top + height / 2,
  });

  return {
    line: line + 1,
    column: ch,
  };
}
