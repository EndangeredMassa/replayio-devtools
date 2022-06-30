import {
  createEntityAdapter,
  createSelector,
  createSlice,
  EntityState,
  PayloadAction,
} from "@reduxjs/toolkit";
import { newSource } from "@replayio/protocol";
import uniq from "lodash/uniq";
import omit from "lodash/omit";
import { getSelectedSourceId } from "devtools/client/debugger/src/selectors";
import { UIState } from "ui/state";
// sourceId: SourceId;
// kind: SourceKind;
// url?: string;
// generatedSourceIds?: SourceId[];
// contentHash?: string;

interface SourceDetails {
  id: string;
  contentHash?: string;
  generated: string[];
  generatedFrom: string[];
  url: string;
  prettyPrinted?: string;
  unprettyPrinted?: string;
}
const sourceDetailsAdapter = createEntityAdapter<SourceDetails>();
const sourcesAdapter = createEntityAdapter<newSource>();

export interface SourcesState {
  generated: { [key: string]: string[] | undefined };
  generatedBy: { [key: string]: string[] | undefined };
  sourceDetails: EntityState<SourceDetails>;
  sources: EntityState<newSource>;
}

const initialState: SourcesState = {
  generated: {},
  generatedBy: {},
  sourceDetails: sourceDetailsAdapter.getInitialState(),
  sources: sourcesAdapter.getInitialState(),
};

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    addSource: (state, action: PayloadAction<newSource>) => {
      // Always keep the raw protocol information
      sourcesAdapter.addOne(state.sources, action.payload);

      if (action.payload.kind === "prettyPrinted") {
        const generatedFrom = action.payload.generatedSourceIds![0]!;
        const existing = state.sourceDetails.entities[generatedFrom];
        sourceDetailsAdapter.upsertOne(state.sourceDetails, {
          ...omit(action.payload, "sourceId", "generatedSourceIds"),
          id: generatedFrom,
          prettyPrinted: action.payload.sourceId,
          // This source was pretty printed, and (I think) therefore not
          // generated from eval, so we can safely assume that we have a url...
          // for now at least.
          url: action.payload.url!,
          // Pretty-printing is always the last step. It never generates further
          // sources, even if the unprettyPrinted version did.
          generated: existing?.generated || [],
          // We ignore the `generatedSourceIds` that we get back from the
          // protocol for now, because pretty printed sources are just
          // *different*.
          generatedFrom: existing?.generatedFrom || [],
        });
      } else {
        const id = action.payload.sourceId;
        if (action.payload.generatedSourceIds) {
          // Link this to the sources it generated
          state.generatedBy[id] = uniq([
            ...(state.generatedBy[id] || []),
            ...action.payload.generatedSourceIds,
          ]);
          // Link each source it generated back to this
          action.payload.generatedSourceIds.map(generatedSourceId => {
            state.generated[generatedSourceId] = uniq([
              ...(state.generated[generatedSourceId] || []),
              id,
            ]);
          });
        }
        sourceDetailsAdapter.upsertOne(state.sourceDetails, {
          ...omit(action.payload, "sourceId", "generatedSourceIds"),
          id: action.payload.sourceId,
          // Do we need to go get this?
          generatedFrom: [],
          generated: action.payload.generatedSourceIds || [],
          // I don't have a good excuse as to why I am saying this exists even
          // though it is optional. Other than - we'll get to that later.
          url: action.payload.url!,
        });
      }
    },
  },
});

const sourceDetailsSelectors = sourceDetailsAdapter.getSelectors();

export const getSelectedSourceDetails = createSelector(
  getSelectedSourceId,
  (state: UIState) => state.newSources.sourceDetails,
  (selectedSourceId, sourceDetails) => {
    if (!selectedSourceId) {
      return null;
    }
    return sourceDetailsSelectors.selectById(sourceDetails, selectedSourceId);
  }
);

export const { addSource } = sourcesSlice.actions;
export default sourcesSlice.reducer;
