/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import { newSource } from "@replayio/protocol";
import { ThreadFront } from "protocol/thread";
import { bindActionCreators } from "redux";
import type { UIStore } from "ui/actions";
import { initialBreakpointsState } from "ui/reducers/breakpoints";
import { addSources, allSourcesReceived } from "ui/reducers/sources";

import actions from "../actions";
import * as selectors from "../selectors";
import { verifyPrefSchema } from "../utils/prefs";

import { setupCommands, clientCommands } from "./commands";
import { setupEvents } from "./events";

export async function loadInitialState() {
  const breakpoints = initialBreakpointsState();

  return {
    breakpoints,
  };
}

let boundActions: typeof actions;
let store: UIStore;

async function setupDebugger() {
  const sources: newSource[] = [];
  await ThreadFront.findSources(newSource => {
    sources.push(newSource);
  });
  store.dispatch(addSources(sources));
  store.dispatch(allSourcesReceived());
}

export function bootstrap(_store: UIStore) {
  store = _store;
  boundActions = bindActionCreators(actions, store.dispatch);

  setupDebugger();

  verifyPrefSchema();
  setupCommands();
  setupEvents({ actions: boundActions });
}

export function onConnect() {
  return { store, actions: boundActions, selectors, client: clientCommands };
}
