"use client";

import { redirect } from "next/navigation";
import { useSuspenseGetConnections } from "@services/setup/hooks";
import { getCookie } from "cookies-next/client";
import { useAllTeams } from "src/core/providers/all-teams-context";
import { useAuth } from "src/core/providers/auth.provider";
import { useSelectedTeamId } from "src/core/providers/selected-team-context";
import { TEAM_STATUS } from "src/core/types";
import { safeArray } from "src/core/utils/safe-array";

import { getSetupCookieName } from "./_components/setup-step-tracker";
import { getStepByPath, SETUP_STEPS } from "./_config/setup-steps";

export default function Setup() {
    const { userId } = useAuth();
    const { teams } = useAllTeams();
    const { teamId } = useSelectedTeamId();
    const connections = useSuspenseGetConnections(teamId);

    if (userId === undefined) {
        return null;
    }

    // Decide where onboarding continues for the selected team:
    // - The "last step" cookie is per-user, not per-team, so blindly resuming
    //   it after creating/deleting workspaces lands on a step that belongs to
    //   another team's onboarding state.
    // - If the selected team has no git connection yet, the right place is
    //   always the git-connection step. Do that when another team is already
    //   active (adding a workspace) OR when a last-step cookie exists (a
    //   returning user stranded on a connection-less team, e.g. the only
    //   surviving workspace after a deletion). Genuine first-time signups
    //   have neither, so they keep the original flow from the first step.
    const hasActiveTeam = teams.some(
        (team) => team.status === TEAM_STATUS.ACTIVE,
    );
    const hasCodeManagementConnection = safeArray(connections).some(
        (connection) =>
            connection.category === "CODE_MANAGEMENT" &&
            connection.hasConnection,
    );
    const lastStep = getCookie(getSetupCookieName(userId)) as
        string | undefined;

    if (!hasCodeManagementConnection && (hasActiveTeam || lastStep)) {
        redirect("/setup/connecting-git-tool");
    }

    if (userId) {
        const isValidLastStep = lastStep && getStepByPath(lastStep);

        if (isValidLastStep) {
            redirect(lastStep);
        }
    }

    redirect(SETUP_STEPS[0].path);
}
