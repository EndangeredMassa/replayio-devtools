import {
  createEntityAdapter,
  createSelector,
  createSlice,
  EntityState,
  PayloadAction,
} from "@reduxjs/toolkit";
import { newSource, SourceKind } from "@replayio/protocol";
import { getSelectedSourceId } from "devtools/client/debugger/src/selectors";
import { UIState } from "ui/state";

interface SourceDetails {
  contentHash?: string;
  id: string;
  kind: SourceKind;
  url: string;
}
const sourceDetailsAdapter = createEntityAdapter<SourceDetails>();
const sourcesAdapter = createEntityAdapter<newSource>({ selectId: source => source.sourceId });

export interface SourcesState {
  generated: { [key: string]: string[] | undefined };
  generatedFrom: { [key: string]: string[] | undefined };
  prettyPrintedFrom: { [key: string]: string | undefined };
  prettyPrintedTo: { [key: string]: string | undefined };
  sourceDetails: EntityState<SourceDetails>;
  sources: EntityState<newSource>;
}

const initialState: SourcesState = {
  generated: {},
  generatedFrom: {},
  prettyPrintedFrom: {},
  prettyPrintedTo: {},
  sourceDetails: sourceDetailsAdapter.getInitialState(),
  sources: sourcesAdapter.getInitialState(),
};

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    addSource: (state, action: PayloadAction<newSource>) => {
      // Store the raw protocol information. Once we have recieved all sources
      // we will run over this and build it into the shape we want.
      sourcesAdapter.addOne(state.sources, action.payload);
    },
  },
});

export const getSelectedSourceDetails = createSelector(
  (state: UIState) => state.newSources.sourceDetails,
  getSelectedSourceId,
  (sourceDetails, id) => {
    if (id === null || id === undefined) {
      return null;
    }

    return sourceDetails.entities[id];
  }
);

export const { addSource } = sourcesSlice.actions;
export default sourcesSlice.reducer;
