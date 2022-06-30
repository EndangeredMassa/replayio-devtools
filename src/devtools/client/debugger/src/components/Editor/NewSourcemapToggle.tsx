import { ReactNode } from "react";
import { getSelectedSourceDetails } from "ui/reducers/sources";
import { useAppDispatch, useAppSelector } from "ui/setup/hooks";
import { selectSource } from "../../actions/sources";
import { getContext, getSelectedSourceId } from "../../selectors";

const Notice = ({ children }: { children: ReactNode }) => {
  return <div className="rounded bg-neutral-800 p-2 text-white shadow">{children}</div>;
};

const Warning = ({ children }: { children: ReactNode }) => {
  return <div className="rounded bg-yellow-200 p-2 text-black shadow">{children}</div>;
};

const NewSourcemapToggle = () => {
  const selectedSourceDetails = useAppSelector(getSelectedSourceDetails);
  const selectedSourceId = useAppSelector(getSelectedSourceId);
  const cx = useAppSelector(getContext);
  const dispatch = useAppDispatch();

  if (selectedSourceDetails === null) {
    return null;
  }

  console.log(selectedSourceDetails);

  return (
    <>
      <div className="absolute inset-x-1/2 -top-24 flex w-fit -translate-x-1/2 transform">
        {selectedSourceDetails?.canonicalSource ? (
          <Warning>
            This is not the canonical form of this source; it might be harder to work with.&nbsp;
            <span
              className="cursor-pointer underline"
              onClick={() => dispatch(selectSource(cx, selectedSourceDetails.canonicalSource!))}
            >
              Switch to the canonical version
            </span>
            .
          </Warning>
        ) : null}
      </div>
      <div className="absolute inset-x-1/2 -top-8 flex w-fit -translate-x-1/2 transform">
        {selectedSourceDetails?.generated.length ? (
          <Notice>
            This source generated {selectedSourceDetails.generated.length} other source(s)
          </Notice>
        ) : null}
        {selectedSourceDetails?.generatedFrom.length ? (
          <Notice>
            This source was generated from {selectedSourceDetails.generatedFrom.length} other
            source(s)
          </Notice>
        ) : null}
        {selectedSourceDetails?.prettyPrintedFrom ? (
          <Notice>
            This source was pretty-printed, you can also&nbsp;
            <span
              className="cursor-pointer underline"
              onClick={() => dispatch(selectSource(cx, selectedSourceDetails.prettyPrintedFrom!))}
            >
              view the source without pretty-printing
            </span>
          </Notice>
        ) : null}
        {selectedSourceDetails?.prettyPrintedTo ? (
          <Notice>
            <span
              className="cursor-pointer underline"
              onClick={() => dispatch(selectSource(cx, selectedSourceDetails.prettyPrintedTo!))}
            >
              Switch to the pretty-printed version of this source
            </span>
          </Notice>
        ) : null}
      </div>
    </>
  );
};

export default NewSourcemapToggle;
