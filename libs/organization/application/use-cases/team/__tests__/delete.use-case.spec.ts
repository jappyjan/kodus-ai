import { STATUS } from '@libs/core/infrastructure/config/types/database/status.type';

import { DeleteTeamUseCase } from '../delete.use-case';

describe('DeleteTeamUseCase', () => {
    const buildUseCase = (overrides?: {
        team?: any;
        remainingTeams?: any[];
        members?: any[];
    }) => {
        const teamService = {
            findOne: jest.fn().mockResolvedValue(
                overrides && 'team' in overrides
                    ? overrides.team
                    : {
                          uuid: 'team-2',
                          name: 'Attraccess',
                          status: STATUS.ACTIVE,
                          organization: { uuid: 'org-1' },
                      },
            ),
            find: jest
                .fn()
                .mockResolvedValue(
                    overrides?.remainingTeams ?? [
                        { uuid: 'team-1' },
                        { uuid: 'team-2' },
                    ],
                ),
            update: jest.fn().mockResolvedValue(undefined),
        };
        const teamMembersService = {
            findManyByRelations: jest
                .fn()
                .mockResolvedValue(overrides?.members ?? [{ uuid: 'member-1' }]),
            deleteMembers: jest.fn().mockResolvedValue(undefined),
        };
        const deleteIntegrationAndRepositoriesUseCase = {
            execute: jest.fn().mockResolvedValue(undefined),
        };

        const useCase = new DeleteTeamUseCase(
            teamService as any,
            teamMembersService as any,
            deleteIntegrationAndRepositoriesUseCase as any,
        );

        return {
            useCase,
            teamService,
            teamMembersService,
            deleteIntegrationAndRepositoriesUseCase,
        };
    };

    it('disconnects the integration, deactivates members and marks the team removed', async () => {
        const {
            useCase,
            teamService,
            teamMembersService,
            deleteIntegrationAndRepositoriesUseCase,
        } = buildUseCase();

        await useCase.execute({ teamId: 'team-2', organizationId: 'org-1' });

        expect(
            deleteIntegrationAndRepositoriesUseCase.execute,
        ).toHaveBeenCalledWith({ organizationId: 'org-1', teamId: 'team-2' });
        expect(teamMembersService.deleteMembers).toHaveBeenCalledWith([
            { uuid: 'member-1' },
        ]);
        expect(teamService.update).toHaveBeenCalledWith(
            { uuid: 'team-2' },
            { status: STATUS.REMOVED },
        );
    });

    it('rejects deleting the last remaining team', async () => {
        const { useCase, teamService } = buildUseCase({
            remainingTeams: [{ uuid: 'team-2' }],
        });

        await expect(
            useCase.execute({ teamId: 'team-2', organizationId: 'org-1' }),
        ).rejects.toThrow('api.team.cannot_delete_last_team');

        expect(teamService.update).not.toHaveBeenCalled();
    });

    it('rejects when the team belongs to another organization', async () => {
        const { useCase } = buildUseCase({
            team: {
                uuid: 'team-2',
                name: 'Attraccess',
                status: STATUS.ACTIVE,
                organization: { uuid: 'org-OTHER' },
            },
        });

        await expect(
            useCase.execute({ teamId: 'team-2', organizationId: 'org-1' }),
        ).rejects.toThrow('api.team.not_found');
    });

    it('rejects when the team is already removed', async () => {
        const { useCase } = buildUseCase({
            team: {
                uuid: 'team-2',
                name: 'Attraccess',
                status: STATUS.REMOVED,
                organization: { uuid: 'org-1' },
            },
        });

        await expect(
            useCase.execute({ teamId: 'team-2', organizationId: 'org-1' }),
        ).rejects.toThrow('api.team.not_found');
    });

    it('still deletes the team when integration cleanup fails', async () => {
        const {
            useCase,
            teamService,
            deleteIntegrationAndRepositoriesUseCase,
        } = buildUseCase();
        deleteIntegrationAndRepositoriesUseCase.execute.mockRejectedValue(
            new Error('integration service down'),
        );

        await useCase.execute({ teamId: 'team-2', organizationId: 'org-1' });

        expect(teamService.update).toHaveBeenCalledWith(
            { uuid: 'team-2' },
            { status: STATUS.REMOVED },
        );
    });
});
