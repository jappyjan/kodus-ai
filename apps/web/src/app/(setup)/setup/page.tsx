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

    // The "last step" cookie is per-user, not per-team, so resuming it for a
    // freshly created additional team would jump into the previous team's
    // onboarding position. When the org already has an active team and the
    // selected team has no git connection yet, start that team's onboarding
    // at the git-connection step. (No active team = first-time signup — keep
    // the original flow starting at the first step.)
    const hasActiveTeam = teams.some(
        (team) => team.status === TEAM_STATUS.ACTIVE,
    );
    const hasCodeManagementConnection = safeArray(connections).some(
        (connection) =>
            connection.category === "CODE_MANAGEMENT" &&
            connection.hasConnection,
    );

    if (hasActiveTeam && !hasCodeManagementConnection) {
        redirect("/setup/connecting-git-tool");
    }

    if (userId) {
        const lastStep = getCookie(getSetupCookieName(userId)) as
            string | undefined;
        const isValidLastStep = lastStep && getStepByPath(lastStep);

        if (isValidLastStep) {
            redirect(lastStep);
        }
    }

    redirect(SETUP_STEPS[0].path);
}
