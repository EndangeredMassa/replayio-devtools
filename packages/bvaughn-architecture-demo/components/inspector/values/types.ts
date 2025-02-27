import {
  Object as ProtocolObject,
  PauseId as ProtocolPauseId,
  Value as ProtocolValue,
} from "@replayio/protocol";

export type ObjectPreviewRendererProps = {
  object: ProtocolObject;
  pauseId: ProtocolPauseId;
  protocolValue: ProtocolValue;
};
