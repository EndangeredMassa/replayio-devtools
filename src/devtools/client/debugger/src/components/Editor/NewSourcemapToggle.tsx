import { getSelectedSourceDetails } from "ui/reducers/sources";
import { useAppSelector } from "ui/setup/hooks";

const NewSourcemapToggle = () => {
  const selectedSourceDetails = useAppSelector(getSelectedSourceDetails);
  console.log({ selectedSourceDetails });
  return <h1>New Sourcemap Toggle</h1>;
};

export default NewSourcemapToggle;
