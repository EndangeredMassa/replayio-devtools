import {
  createEntityAdapter,
  createSelector,
  createSlice,
  EntityState,
  PayloadAction,
} from "@reduxjs/toolkit";
import { newSource, SourceKind } from "@replayio/protocol";
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
      // Always keep the raw protocol information
      sourcesAdapter.addOne(state.sources, action.payload);

      if (action.payload.kind === "prettyPrinted") {
        const id = action.payload.sourceId;
        // This is confusing because we turn things around when pretty printing
        const prettyPrintedFrom = action.payload.generatedSourceIds![0]!;
        // Unclear to me if we should consider pretty-printing to be a source transformation?
        // state.generated[id] = uniq([...(state.generated[id] || []), prettyPrintedFrom]);
        state.prettyPrintedFrom[id] = prettyPrintedFrom;
        state.prettyPrintedTo[prettyPrintedFrom] = id;

        sourceDetailsAdapter.upsertOne(state.sourceDetails, {
          ...omit(action.payload, "sourceId", "generatedSourceIds"),
          id: prettyPrintedFrom,
          // This source was pretty printed, and (I think) therefore not
          // generated from eval, so we can safely assume that we have a url...
          // for now at least.
          url: action.payload.url!,
        });
      } else {
        const id = action.payload.sourceId;
        if (action.payload.generatedSourceIds) {
          // Link this to the sources it generated
          state.generated[id] = uniq([
            ...(state.generated[id] || []),
            ...action.payload.generatedSourceIds,
          ]);
          // Link each source it generated back to this
          action.payload.generatedSourceIds.map(generatedSourceId => {
            state.generatedFrom[generatedSourceId] = uniq([
              ...(state.generatedFrom[generatedSourceId] || []),
              id,
            ]);
          });
        }
        sourceDetailsAdapter.upsertOne(state.sourceDetails, {
          ...omit(action.payload, "sourceId", "generatedSourceIds"),
          id: action.payload.sourceId,
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
  (state: UIState) => state.newSources.generated,
  (state: UIState) => state.newSources.generatedFrom,
  (state: UIState) => state.newSources.prettyPrintedFrom,
  (state: UIState) => state.newSources.prettyPrintedTo,
  (
    selectedSourceId,
    sourceDetails,
    generated,
    generatedFrom,
    prettyPrintedFrom,
    prettyPrintedTo
  ) => {
    if (!selectedSourceId) {
      return null;
    }
    const beforePrettyPrinting = prettyPrintedFrom[selectedSourceId];
    const details = sourceDetailsSelectors.selectById(
      sourceDetails,
      beforePrettyPrinting || selectedSourceId
    );

    if (!details) {
      return null;
    }

    let canonicalSource;
    if (beforePrettyPrinting !== undefined) {
      // For the purposes of demonstration, let's say that prettyPrinted files
      // are the canonical ones already. I have not yet confirmed if this is
      // reliably the case, and I suspect that it is not. In fact, I suspect the
      // logic is:
      // - Go find the canonical source for the non-pretty-printed version, and
      //   then see if that canonical source also has a pretty-printed version.
      canonicalSource = null;
    } else if (details.kind === "html") {
      // HTML files are always the original, canonical source AFAIK
      canonicalSource = null;
    } else if (details.kind === "inlineScript") {
      // HTML files are the canonical source for inline scripts
      canonicalSource = generatedFrom[selectedSourceId]![0] || null;
    } else if (details.kind === "scriptSource") {
      // This might be a file referenced directly, but if there's a pretty-printed version, we would prefer that.
      canonicalSource = prettyPrintedTo[selectedSourceId] || null;
    } else if (details.kind === "sourceMapped") {
      // This might be a sourceMapped file, but we still want the PP version if possible
      canonicalSource = prettyPrintedTo[selectedSourceId] || null;
    } else if (details.kind === "other") {
      // I don't know what to do here yet, probably generatedFrom?
      canonicalSource = generatedFrom[selectedSourceId]![0] || null;
    }

    return {
      ...details,
      canonicalSource,
      generated: generated[selectedSourceId] || [],
      generatedFrom: generatedFrom[selectedSourceId] || [],
      prettyPrintedFrom: prettyPrintedFrom[selectedSourceId],
      prettyPrintedTo: prettyPrintedTo[selectedSourceId],
    };
  }
);

export const { addSource } = sourcesSlice.actions;
export default sourcesSlice.reducer;
