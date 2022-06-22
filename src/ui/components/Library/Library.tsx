import React, { useEffect, useState } from "react";
import { connect, ConnectedProps } from "react-redux";
import useAuth0 from "ui/utils/useAuth0";
import LogRocket from "ui/utils/logrocket";
import hooks from "ui/hooks";
import * as actions from "ui/actions/app";
import { Workspace } from "ui/types";
import { UIState } from "ui/state";
import * as selectors from "ui/reducers/app";
import { useGetUserInfo } from "ui/hooks/users";

import LoadingScreen from "../shared/LoadingScreen";
import { FilterBar } from "./FilterBar";
import Sidebar from "./Sidebar";
import { LibraryContext, useFilters, View } from "./useFilters";
import LaunchButton from "../shared/LaunchButton";
import { trackEvent } from "ui/utils/telemetry";
import styles from "./Library.module.css";
import {
  downloadReplay,
  firstReplay,
  isTeamLeaderInvite,
  singleInvitation,
} from "ui/utils/onboarding";
import { useRouter } from "next/router";
import { LibraryContent } from "./LibraryContent";
import { useGetTestParams } from "./Content/TestRuns/TestRunsViewer";
import { useGetWorkspace } from "ui/hooks/workspaces";
import { useAppSelector } from "ui/setup/hooks";

function isUnknownWorkspaceId(
  id: string | null,
  workspaces: Workspace[],
  pendingWorkspaces?: Workspace[]
) {
  const associatedWorkspaces = [{ id: null }, ...workspaces];

  // Add the pending workspaces, if any.
  if (pendingWorkspaces) {
    associatedWorkspaces.push(...pendingWorkspaces);
  }

  return !associatedWorkspaces.map(ws => ws.id).includes(id);
}

function LibraryLoader(props: PropsFromRedux) {
  const { setModal } = props;
  const auth = useAuth0();
  const { userSettings, loading: userSettingsLoading } = hooks.useGetUserSettings();
  const userInfo = hooks.useGetUserInfo();
  const { workspaces, loading: loading1 } = hooks.useGetNonPendingWorkspaces();
  const { pendingWorkspaces, loading: loading2 } = hooks.useGetPendingWorkspaces();
  const { nags, loading: loading3 } = useGetUserInfo();
  const dismissNag = hooks.useDismissNag();
  const workspaceId = useAppSelector(selectors.getWorkspaceId);
  const { workspace, loading: loading4 } = useGetWorkspace(workspaceId);

  useEffect(() => {
    if (!userInfo.loading && !userSettingsLoading) {
      LogRocket.createSession({ userInfo, auth0User: auth.user, userSettings });
    }
  }, [auth, userInfo, userSettings, userSettingsLoading]);

  // TODO [jaril] Fix react-hooks/exhaustive-deps
  useEffect(function handleOnboardingModals() {
    if (singleInvitation(pendingWorkspaces?.length || 0, workspaces.length)) {
      trackEvent("onboarding.team_invite");
      setModal("single-invite");
    } else if (downloadReplay(nags, dismissNag)) {
      trackEvent("onboarding.download_replay_prompt");
      setModal("download-replay");
    } else if (firstReplay(nags)) {
      trackEvent("onboarding.demo_replay_prompt");
      setModal("first-replay");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading1 || loading2 || loading3 || loading4) {
    return <LoadingScreen />;
  }

  return <Library {...{ ...props, workspaces, pendingWorkspaces, currentWorkspace: workspace }} />;
}

type LibraryProps = PropsFromRedux & {
  currentWorkspace?: Workspace;
  workspaces: Workspace[];
  pendingWorkspaces?: Workspace[];
};

function Library({
  setWorkspaceId,
  currentWorkspaceId,
  workspaces,
  pendingWorkspaces,
  currentWorkspace,
}: LibraryProps) {
  const router = useRouter();
  const { testRunId } = useGetTestParams();
  const { displayedString, setDisplayedText, setAppliedText, filter } = useFilters();
  const [view, setView] = useState<View>(
    testRunId || currentWorkspace?.isTest ? "test-runs" : "recordings"
  );
  const updateDefaultWorkspace = hooks.useUpdateDefaultWorkspace();

  // TODO [jaril] Fix react-hooks/exhaustive-deps
  useEffect(function handleDeletedTeam() {
    // After rendering null, update the workspaceId to display the user's library
    // instead of the non-existent team.
    if (![{ id: null }, ...workspaces].some(ws => ws.id === currentWorkspaceId)) {
      setWorkspaceId(null);
      updateDefaultWorkspace({ variables: { workspaceId: null } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setView(currentWorkspace?.isTest ? "test-runs" : "recordings");
  }, [currentWorkspace]);

  // FIXME [ryanjduffy]: Backwards compatibility for ?replayinvite=true flow
  if (isTeamLeaderInvite()) {
    router.replace("/team/new");
    return null;
  }

  // Handle cases where the default workspace ID in prefs is for a team
  // that the user is no longer a part of. This occurs when the user is removed
  // from a team that is stored as their default library team in prefs. We return
  // null here, and reset the currentWorkspaceId to the user's library in `handleDeletedTeam`.
  // This also handles cases where the selected ID actually corresponds to a pending team.
  if (isUnknownWorkspaceId(currentWorkspaceId, workspaces, pendingWorkspaces)) {
    return <LoadingScreen />;
  }

  const handleSetView = (view: View) => {
    setView(view);
    // If switching to test/test run view, we should clear the recording filters.
    if (view !== "recordings") {
      setAppliedText("");
    }
  };

  return (
    <LibraryContext.Provider
      value={{
        filter,
        view,
        setView: handleSetView,
        setAppliedText,
      }}
    >
      <main className="flex flex-row w-full h-full">
        <Sidebar nonPendingWorkspaces={workspaces} />
        <div className="flex flex-col flex-grow overflow-x-hidden">
          <div className={`flex h-16 flex-row items-center space-x-3 p-4 ${styles.libraryHeader}`}>
            <FilterBar displayedString={displayedString} setDisplayedText={setDisplayedText} />
            <LaunchButton />
          </div>
          <div className={`flex flex-grow flex-col overflow-hidden p-4 ${styles.libraryWrapper}`}>
            <LibraryContent />
          </div>
        </div>
      </main>
    </LibraryContext.Provider>
  );
}

const connector = connect(
  (state: UIState) => ({
    currentWorkspaceId: selectors.getWorkspaceId(state),
  }),
  {
    setWorkspaceId: actions.setWorkspaceId,
    setModal: actions.setModal,
  }
);
type PropsFromRedux = ConnectedProps<typeof connector>;
export default connector(LibraryLoader);
