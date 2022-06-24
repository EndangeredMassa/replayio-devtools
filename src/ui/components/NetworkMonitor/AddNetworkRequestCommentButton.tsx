import { useAppDispatch } from "ui/setup/hooks";
import { createNetworkRequestComment } from "ui/actions/comments";
import { useGetRecordingId } from "ui/hooks/recordings";
import { useFeature } from "ui/hooks/settings";
import { AddCommentButton } from "../../../../packages/components";
import { RequestSummary } from "./utils";

export default function AddNetworkRequestCommentButton({
  request,
  className,
}: {
  request: RequestSummary;
  className?: string;
}) {
  const dispatch = useAppDispatch();
  const recordingId = useGetRecordingId();

  const addRequestComment = () => {
    dispatch(createNetworkRequestComment(request, recordingId));
  };

  return <AddCommentButton className={className} onClick={addRequestComment} />;
}
