import React from "react";
import { Workspace } from "ui/types";
import Invitations from "./Invitations";
import NewTeamButton from "./NewTeamButton";
import SidebarFooter from "./SidebarFooter";
import TeamButton from "./TeamButton";
import "./Sidebar.css";

export default function Sidebar({ nonPendingWorkspaces }: { nonPendingWorkspaces: Workspace[] }) {
  const workspaces = [{ id: null, name: "Your Library", members: [] }, ...nonPendingWorkspaces];

  // This corresponds with tailwind colors: thumb is gray-500 and track is gray-800
  const scrollbarStyle = { scrollbarColor: "#6B7280 #1F2937" };

  return (
    <div className="flex flex-col bg-gray-800 text-gray-300 w-64">
      <div className="p-4">
        <img className="w-8 h-8" src="/images/logo.svg" />
      </div>
      <div
        className="library-sidebar flex flex-col flex-grow text-sm overflow-auto"
        style={scrollbarStyle}
      >
        <Invitations />
        {workspaces.map(w => (
          <TeamButton key={w.id} id={w.id} text={w.name} />
        ))}
        <NewTeamButton />
      </div>
      <SidebarFooter />
    </div>
  );
}