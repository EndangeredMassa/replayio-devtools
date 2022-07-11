import { Location, RecordingId } from "@replayio/protocol";
import { User } from "ui/types";

export interface CommentPosition {
  x: number;
  y: number;
}

export type CommentOptions = {
  position: CommentPosition | null;
  hasFrames: boolean;
  sourceLocation: Location | null;
  networkRequestId?: string;
};

export interface Remark {
  content: string;
  createdAt: string;
  hasFrames: boolean;
  id: string;
  // Unpublished remarks are only visible to their author.
  // Published comments are visible to everyone (who can view the recording).
  isPublished: boolean;
  point: string;
  recordingId: RecordingId;
  sourceLocation: Location | null;
  time: number;
  updatedAt: string;
  user: User;
}

export interface Comment extends Remark {
  position: CommentPosition | null;
  networkRequestId: string | null;
  primaryLabel?: string;
  replies: Reply[];
  secondaryLabel?: string;
}

export interface Reply extends Remark {
  parentId: string;
}
