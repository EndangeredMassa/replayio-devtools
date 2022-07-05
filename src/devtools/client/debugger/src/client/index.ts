/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

import { ThreadFront } from "protocol/thread";
import { bindActionCreators } from "redux";
import type { UIStore } from "ui/actions";
import { addSource, allSourcesReceived } from "ui/reducers/sources";

import actions from "../actions";
import { initialBreakpointsState } from "../reducers/breakpoints";
import * as selectors from "../selectors";
import { asyncStore, verifyPrefSchema } from "../utils/prefs";

import { setupCommands, clientCommands, prepareSourcePayload } from "./commands";
import { setupEvents } from "./events";

export async function loadInitialState() {
  // @ts-expect-error missing `pendingBreakpoints` field
  const pendingBreakpoints = await asyncStore.pendingBreakpoints;
  const breakpoints = initialBreakpointsState();

  return {
    pendingBreakpoints,
    breakpoints,
  };
}

let boundActions: typeof actions;
let store: UIStore;

type $FixTypeLater = any;

async function setupDebugger() {
  const sourceInfos: $FixTypeLater[] = [];
  await ThreadFront.findSources(newSource => {
    // @ts-expect-error `sourceMapURL` doesn't exist?
    const { sourceId, url, sourceMapURL } = newSource;
    sourceInfos.push({
      type: "generated",
      data: prepareSourcePayload({
        actor: sourceId,
        url,
        sourceMapURL,
      }),
    });

    // Can also probably just shove these into an array right here and dispatch
    // them all at the end.
    store.dispatch(addSource(newSource));
  });
  await store.dispatch(actions.newQueuedSources(sourceInfos));
  store.dispatch({ type: "SOURCES_LOADED" });

  // This fires off the coercing of sources into a more workable form
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
