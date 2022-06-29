import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { newSource } from "@replayio/protocol";
// sourceId: SourceId;
// kind: SourceKind;
// url?: string;
// generatedSourceIds?: SourceId[];
// contentHash?: string;

interface SourceDetails {
  generated: string[];
  generatedFrom: string[];
  prettyPrinted: string | undefined;
  unprettyPrinted: string | undefined;
}

export interface SourcesState {
  sources: newSource[];
  sourcesBySomeKeyWeMadeUp: Record<string, SourceDetails>;
}

const initialState: SourcesState = {
  sources: [],
  sourcesBySomeKeyWeMadeUp: {},
};

const keyForNewSource = (source: newSource) => {
  return `${source.url}:${source.contentHash}`;
};

const sourcesSlice = createSlice({
  name: "sources",
  initialState,
  reducers: {
    addSource: (state, action: PayloadAction<newSource>) => {
      state.sources.push(action.payload);
      state.sourcesBySomeKeyWeMadeUp[keyForNewSource(action.payload)] = {
        generated: action.payload.generatedSourceIds || [],
        generatedFrom: [],
        prettyPrinted:
          action.payload.kind === "prettyPrinted" ? action.payload.sourceId : undefined,
        unprettyPrinted:
          action.payload.kind !== "prettyPrinted" ? action.payload.sourceId : undefined,
      };
    },
  },
});

export const { addSource } = sourcesSlice.actions;
export default sourcesSlice.reducer;
