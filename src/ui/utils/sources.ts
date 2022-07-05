import { EntityId } from "@reduxjs/toolkit";
import { newSource, SourceKind } from "@replayio/protocol";
import groupBy from "lodash/groupBy";
import { SourceDetails } from "ui/reducers/sources";
import newGraph from "./graph";

const fullSourceDetails = (
  attributes: Partial<SourceDetails> & {
    id: string;
    kind: SourceKind;
    url: string;
  }
): SourceDetails => {
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
): Record<EntityId, SourceDetails> => {
  const returnValue: Record<EntityId, SourceDetails> = {};

  let log = false;
  const maybeLog = (args: any) => {
    if (log) {
      console.log(args);
    }
  };

  // Sources are processed by kind. So first we go through the whole list once
  // just to group things properly.
  const byKind = groupBy(newSources, source => source.kind);

  // Process scriptSources first. Generally speaking, all other resources will
  // be related to a scriptSource *somehow*. There are exceptions. For instance,
  // the pretty-printed version of a sourceMapped source will not have a direct
  // link to a scriptSource (though it must have a transitive link through the
  // sourceMapped source)
  const scriptSources = byKind["scriptSource"] || [];

  const generated = newGraph();
  const backLinkGeneratedSource = (source: newSource) => {
    source.generatedSourceIds?.map(generatedId => {
      generated.connectNode(source.sourceId, generatedId);
    });
  };

  const prettyPrinted = newGraph();

  const canonical = newGraph();

  // Similar to generatedFromMap, rather than searching by the canonicalID, we
  // can use this map to do a reverse lookup.
  const canonicalSourcesMap: Record<string, string[] | undefined> = {};
  const addCanonicalLink = (replace: string, replaceWith: string) => {
    const existingCanonical = [...(canonicalSourcesMap[replace] || []), replaceWith];
    existingCanonical.forEach(sourceId => {
      returnValue[sourceId]!.canonicalId = replaceWith;
    });
    maybeLog(`Replace ${replace}(${existingCanonical}) -> ${replaceWith}`);
    canonicalSourcesMap[replaceWith] = existingCanonical;
    if (replace !== replaceWith) {
      delete canonicalSourcesMap[replace];
    }
  };

  const lookupCanonicalSourceId = (sourceId: string) => {
    let candidate = sourceId;

    while (returnValue[candidate] && returnValue[candidate].canonicalId !== candidate) {
      // Keep following the links
      candidate = returnValue[candidate].canonicalId;
    }

    maybeLog(`Lookup ${sourceId} => ${candidate}`);
    return candidate;
  };

  const correspondingSourcesMap: Record<string, string[] | undefined> = {};
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
    canonicalSourcesMap[source.sourceId] = [source.sourceId];
  });

  const obj = (o: object) => {
    return JSON.stringify(o, null, 2);
  };

  maybeLog(`after scriptSources: ${obj(returnValue)}, ${obj(canonicalSourcesMap)}`);

  const htmlSources = byKind["html"] || [];
  htmlSources.map(source => {
    returnValue[source.sourceId] = fullSourceDetails({
      contentHash: source.contentHash!,
      generated: source.generatedSourceIds || [],
      generatedFrom: generatedFromMap[source.sourceId] || [],
      id: source.sourceId,
      kind: source.kind,
      url: source.url!,
    });

    backLinkGeneratedSource(source);
    addToCorrespondingSources(source);
    addCanonicalLink(source.sourceId, source.sourceId);
  });

  maybeLog(`after html: ${obj(returnValue)}, ${obj(canonicalSourcesMap)}`);

  const inlineScripts = byKind["inlineScript"] || [];
  inlineScripts.map(source => {
    const canonicalId = lookupCanonicalSourceId(generatedFromMap[source.sourceId]![0]);
    returnValue[source.sourceId] = fullSourceDetails({
      canonicalId,
      contentHash: source.contentHash,
      generated: source.generatedSourceIds || [],
      generatedFrom: generatedFromMap[source.sourceId] || [],
      id: source.sourceId,
      kind: source.kind,
      url: source.url!,
    });

    source.generatedSourceIds?.map(generatedId => {
      returnValue[generatedId]!.generatedFrom.push(source.sourceId);
    });

    backLinkGeneratedSource(source);
    addToCorrespondingSources(source);
    addCanonicalLink(source.sourceId, canonicalId);
  });

  maybeLog(`after inlineScripts: ${obj(returnValue)}, ${obj(canonicalSourcesMap)}`);

  const sourceMapped = byKind["sourceMapped"] || [];
  sourceMapped.map(source => {
    // If this source was source-mapped, then it must be the canonical source
    // for the things it generated?

    const canonicalId = lookupCanonicalSourceId(source.sourceId);
    returnValue[source.sourceId] = fullSourceDetails({
      canonicalId,
      contentHash: source.contentHash,
      generated: source.generatedSourceIds || [],
      generatedFrom: generatedFromMap[source.sourceId] || [],
      id: source.sourceId,
      kind: source.kind,
      url: source.url!,
    });

    // Link generated sources
    source.generatedSourceIds?.map(generatedId => {
      returnValue[generatedId]!.generatedFrom.push(source.sourceId);
      addCanonicalLink(generatedId, canonicalId);
    });

    backLinkGeneratedSource(source);
    addToCorrespondingSources(source);
  });

  maybeLog(`after sourceMapped: ${obj(returnValue)}, ${obj(canonicalSourcesMap)}`);

  const otherSources = byKind["other"] || [];
  otherSources.map(source => {
    returnValue[source.sourceId] = fullSourceDetails({
      generated: source.generatedSourceIds || [],
      generatedFrom: generatedFromMap[source.sourceId] || [],
      id: source.sourceId,
      kind: source.kind,
      url: source.url!,
    });

    // Link generated sources
    source.generatedSourceIds?.map(generatedId => {
      returnValue[generatedId]!.generatedFrom.push(source.sourceId);
    });

    backLinkGeneratedSource(source);
    addToCorrespondingSources(source);
  });

  log = true;
  maybeLog(`after other: ${obj(returnValue)}, ${obj(canonicalSourcesMap)}`);

  const prettyPrinted = byKind["prettyPrinted"] || [];
  prettyPrinted.map(source => {
    // We handle pretty-printed (pp) files and their generated links a little
    // differently. Because Replay makes the pp sources, their structure is
    // predictable. All pp sources will have one generatedSourceId, and it will
    // be the minified source.
    const nonPrettyPrintedVersion = returnValue[source.generatedSourceIds![0]];
    const canonicalId = lookupCanonicalSourceId(nonPrettyPrintedVersion.id);
    maybeLog(`canonical for ${source.sourceId}: ${canonicalId}`);
    returnValue[source.sourceId] = fullSourceDetails({
      canonicalId,
      id: source.sourceId,
      kind: source.kind,
      prettyPrintedFrom: source.generatedSourceIds![0]!,
      generatedFrom: generatedFromMap[source.generatedSourceIds![0]] || [],
      url: source.url!,
    });

    maybeLog(`Handling backlinks for pretty-printed ${source.sourceId}`);
    nonPrettyPrintedVersion.prettyPrinted = source.sourceId;
    addToCorrespondingSources(source);
    addCanonicalLink(nonPrettyPrintedVersion.id, source.sourceId);
  });

  maybeLog(`after pp: ${obj(returnValue)}, ${obj(canonicalSourcesMap)}`);

  // if we see an evaled script or an excerpted script we can mark it as
  // transitive and call the protocol to get its mapped location for first and
  // last location and BOOM!
  // Oh, ya know what, you only need *one* location because the source will
  // always be the same!
  // Ah, drat, for some reason eval'ed sources in particular are not linked!
  // That is not a huge problem right now, but eventually it *could* be.

  return returnValue;
};
