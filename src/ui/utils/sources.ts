import { newSource, SourceKind } from "@replayio/protocol";
import groupBy from "lodash/groupBy";

interface FullSourceDetails {
  canonicalId: string;
  contentHash: string | undefined;
  correspondingSourceIds: string[];
  generated: string[];
  generatedFrom: string[];
  id: string;
  kind: SourceKind;
  prettyPrinted: string | undefined;
  prettyPrintedFrom: string | undefined;
  url: string;
}

const fullSourceDetails = (
  attributes: Partial<FullSourceDetails> & {
    id: string;
    kind: SourceKind;
    url: string;
  }
): FullSourceDetails => {
  return {
    canonicalId: attributes.id,
    contentHash: undefined,
    correspondingSourceIds: [],
    generated: [],
    generatedFrom: [],
    prettyPrinted: undefined,
    prettyPrintedFrom: undefined,
    ...attributes,
  };
};

export const keyForSource = (source: newSource): string => {
  return `${source.url!}:${source.contentHash}`;
};

export const newSourcesToCompleteSourceDetails = (
  newSources: newSource[]
): { [key: string]: FullSourceDetails | undefined } => {
  // Sources are processed by kind. So first we go through the whole list once
  // just to group things properly.
  const byKind = groupBy(newSources, source => source.kind);

  // Process scriptSources first. Generally speaking, all other resources will
  // be related to a scriptSource *somehow*. There are exceptions. For instance,
  // the pretty-printed version of a sourceMapped source will not have a direct
  // link to a scriptSource (though it must have a transitive link through the
  // sourceMapped source)
  const scriptSources = byKind["scriptSource"] || [];

  const returnValue: { [key: string]: FullSourceDetails | undefined } = {};

  const generatedFromMap: { [key: string]: string[] | undefined } = {};
  // Backlink generated sources
  const backLinkGeneratedSource = (source: newSource) => {
    source.generatedSourceIds?.map(generatedId => {
      if (!generatedFromMap[generatedId]) {
        generatedFromMap[generatedId] = [];
      }
      generatedFromMap[generatedId]!.push(source.sourceId);
    });
  };

  const correspondingSourcesMap: { [key: string]: string[] | undefined } = {};
  const addToCorrespondingSources = (source: newSource) => {
    const key = keyForSource(source);
    if (!correspondingSourcesMap[key]) {
      correspondingSourcesMap[key] = [];
    }
    correspondingSourcesMap[key]!.push(source.sourceId);
  };

  scriptSources.map(source => {
    returnValue[source.sourceId] = fullSourceDetails({
      contentHash: source.contentHash!,
      generated: source.generatedSourceIds || [],
      id: source.sourceId,
      kind: source.kind,
      url: source.url!,
    });

    backLinkGeneratedSource(source);
    addToCorrespondingSources(source);
  });

  const htmlSources = byKind["html"] || [];
  htmlSources.map(source => {
    returnValue[source.sourceId] = fullSourceDetails({
      canonicalId: source.sourceId,
      contentHash: source.contentHash!,
      generated: source.generatedSourceIds || [],
      generatedFrom: generatedFromMap[source.sourceId] || [],
      id: source.sourceId,
      kind: source.kind,
      url: source.url!,
    });

    backLinkGeneratedSource(source);
    addToCorrespondingSources(source);
  });

  const inlineScripts = byKind["inlineScript"] || [];
  inlineScripts.map(source => {
    returnValue[source.sourceId] = {
      canonicalId: generatedFromMap[source.sourceId]![0],
      contentHash: source.contentHash!,
      correspondingSourceIds: [],
      generated: source.generatedSourceIds || [],
      generatedFrom: generatedFromMap[source.sourceId] || [],
      id: source.sourceId,
      kind: source.kind,
      prettyPrinted: undefined,
      prettyPrintedFrom: undefined,
      url: source.url!,
    };

    source.generatedSourceIds?.map(generatedId => {
      returnValue[generatedId]!.generatedFrom = [
        ...returnValue[generatedId]!.generatedFrom,
        source.sourceId,
      ];
    });

    // Backlink generated sources
    source.generatedSourceIds?.map(generatedId => {
      generatedFromMap[generatedId] = [...(generatedFromMap[generatedId] || []), source.sourceId];
    });

    // Check for corresponding sources
    const key = keyForSource(source);
    if (!correspondingSourcesMap[key]) {
      correspondingSourcesMap[key] = [];
    }
    correspondingSourcesMap[key] = [...(correspondingSourcesMap[key] || []), source.sourceId];
  });

  const sourceMapped = byKind["sourceMapped"] || [];
  sourceMapped.map(source => {
    returnValue[source.sourceId] = {
      canonicalId: source.sourceId,
      contentHash: source.contentHash!,
      correspondingSourceIds: [],
      generated: source.generatedSourceIds || [],
      generatedFrom: generatedFromMap[source.sourceId] || [],
      id: source.sourceId,
      kind: source.kind,
      prettyPrinted: undefined,
      prettyPrintedFrom: undefined,
      url: source.url!,
    };

    // Link generated sources
    source.generatedSourceIds?.map(generatedId => {
      returnValue[generatedId]!.generatedFrom.push(source.sourceId);
      returnValue[generatedId]!.canonicalId = source.sourceId;
    });

    backLinkGeneratedSource(source);
    addToCorrespondingSources(source);
  });

  const otherSources = byKind["other"] || [];
  otherSources.map(source => {
    returnValue[source.sourceId] = {
      canonicalId: source.sourceId,
      contentHash: source.contentHash!,
      correspondingSourceIds: [],
      generated: source.generatedSourceIds || [],
      generatedFrom: generatedFromMap[source.sourceId] || [],
      id: source.sourceId,
      kind: source.kind,
      prettyPrinted: undefined,
      prettyPrintedFrom: undefined,
      url: source.url!,
    };

    // Link generated sources
    source.generatedSourceIds?.map(generatedId => {
      returnValue[generatedId]!.generatedFrom.push(source.sourceId);
    });

    backLinkGeneratedSource(source);
    addToCorrespondingSources(source);
  });

  const prettyPrinted = byKind["prettyPrinted"] || [];
  prettyPrinted.map(source => {
    returnValue[source.sourceId] = fullSourceDetails({
      canonicalId: source.generatedSourceIds![0],
      id: source.sourceId,
      kind: source.kind,
      prettyPrinted: undefined,
      prettyPrintedFrom: source.generatedSourceIds![0]!,
      url: source.url!,
    });

    // We handle pretty-printed (pp) files and their generated links a little
    // differently Because Replay makes the pp sources, their
    // structure is predictable.  All pp sources will have one
    // generatedSourceId, and it will be the minified source.
    returnValue[source.generatedSourceIds![0]!]!.prettyPrinted = source.sourceId;
    addToCorrespondingSources(source);
  });

  // if we see an evaled script or an excerpted script we can mark it as
  // transitive and call the protocol to get its mapped location for first and
  // last location and BOOM!
  // Oh, ya know what, you only need *one* location because the source will
  // always be the same!
  // Ah, drat, for some reason eval'ed sources in particular are not linked!
  // That is not a huge problem for this, but eventually it *could* be.

  return returnValue;
};
