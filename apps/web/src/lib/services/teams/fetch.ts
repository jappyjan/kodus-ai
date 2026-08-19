import { authorizedFetch } from "@services/fetch";
import { axiosAuthorized } from "src/core/utils/axios";

import { TEAMS_PATHS } from ".";
import { Team, TeamWithIntegrations } from "./types";

export const getTeams = () =>
    authorizedFetch<Team[]>(TEAMS_PATHS.LIST_ALL, {
        next: { tags: ["teams-list"] },
    });

export const getTeamsWithIntegrations = async (): Promise<
    { data: TeamWithIntegrations[] } | { error: string }
> => {
    try {
        const response = await axiosAuthorized.fetcher(
            TEAMS_PATHS.LIST_WITH_INTEGRATIONS,
        );

        return response;
    } catch (error: any) {
        return { error: error.response?.status || "Unknown error" };
    }
};

export const createTeam = async (
    name: string,
): Promise<{ data: Team } | { error: string }> => {
    try {
        const response = await axiosAuthorized.post<{
            statusCode: number;
            data: Team;
        }>(TEAMS_PATHS.CREATE, { name });

        return response;
    } catch (error: any) {
        return {
            error:
                error.response?.data?.message ||
                error.response?.status ||
                "Unknown error",
        };
    }
};

export const deleteTeam = async (
    teamId: string,
): Promise<{ ok: true } | { error: string }> => {
    try {
        await axiosAuthorized.deleted(TEAMS_PATHS.DELETE, {
            params: { teamId },
        });

        return { ok: true };
    } catch (error: any) {
        return {
            error:
                error.response?.data?.message ||
                error.response?.status ||
                "Unknown error",
        };
    }
};
