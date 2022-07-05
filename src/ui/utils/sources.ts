import { EntityId } from "@reduxjs/toolkit";
import { newSource, SourceKind } from "@replayio/protocol";
import groupBy from "lodash/groupBy";
import omit from "lodash/omit";
import { SourceDetails } from "ui/reducers/sources";
import newGraph from "./graph";

const fullSourceDetails = (
  attributes: Partial<SourceDetails> & {
    id: string;
    kind: SourceKind;
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
    url: undefined,
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
  const prettyPrinted = newGraph("prettyPrinted");
  const canonical = newGraph("canonical");

  // Canonical links can go across multiple links
  const findCanonicalId = (id: string) => {
    let current = id;
    let nextNode = canonical.from(current)?.[0];

    while (nextNode && nextNode !== current) {
      current = nextNode;
      nextNode = canonical.from(current)?.[0];
    }

    return current;
  };

  const generated = newGraph("generated");
  const backLinkGeneratedSource = (source: newSource) => {
    source.generatedSourceIds?.map(generatedId => {
      generated.connectNode(source.sourceId, generatedId);
    });
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

  scriptSources.forEach(source => {
    backLinkGeneratedSource(source);
  });

  const htmlSources = byKind["html"] || [];
  htmlSources.forEach(source => {
    backLinkGeneratedSource(source);
  });

  const inlineScripts = byKind["inlineScript"] || [];
  inlineScripts.forEach(source => {
    backLinkGeneratedSource(source);
    canonical.connectNode(source.sourceId, generated.to(source.sourceId)![0]);
  });

  const sourceMapped = byKind["sourceMapped"] || [];
  sourceMapped.forEach(source => {
    backLinkGeneratedSource(source);
    canonical.connectNode(generated.from(source.sourceId)![0], source.sourceId);
  });

  const otherSources = byKind["other"] || [];

  otherSources.forEach(source => {
    backLinkGeneratedSource(source);
  });

  const prettyPrintedSources = byKind["prettyPrinted"] || [];
  prettyPrintedSources.forEach(source => {
    // We handle pretty-printed (pp) files and their generated links a little
    // differently. Because Replay makes the pp sources, their structure is
    // predictable. All pp sources will have one generatedSourceId, and it will
    // be the minified source.
    const nonPrettyPrintedVersionId = source.generatedSourceIds![0];
    prettyPrinted.connectNode(nonPrettyPrintedVersionId, source.sourceId);
    canonical.connectNode(source.sourceId, nonPrettyPrintedVersionId);
  });

  newSources.forEach(source => {
    returnValue[source.sourceId] = fullSourceDetails({
      ...omit(source, "sourceId", "generatedSourceIds"),
      id: source.sourceId,
      prettyPrinted: prettyPrinted.from(source.sourceId)?.[0],
      prettyPrintedFrom: prettyPrinted.to(source.sourceId)?.[0],
      generated: generated.from(source.sourceId) || [],
      generatedFrom: generated.to(source.sourceId) || [],
      canonicalId: findCanonicalId(source.sourceId),
    });
  });

  return returnValue;
};
