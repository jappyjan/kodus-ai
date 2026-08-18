import { STATUS } from '@libs/core/infrastructure/config/types/database/status.type';
import { TeamMemberRole } from '@libs/organization/domain/teamMembers/enums/teamMemberRole.enum';

import { CreateTeamWithMemberUseCase } from '../create-with-member.use-case';

describe('CreateTeamWithMemberUseCase', () => {
    const buildUseCase = (overrides?: {
        createdTeam?: any;
        existingMember?: any;
        profile?: any;
    }) => {
        const createdTeam = overrides?.createdTeam ?? {
            uuid: 'team-1',
            name: 'Attraccess',
            organization: { uuid: 'org-1' },
            status: STATUS.PENDING,
        };

        const createTeamUseCase = {
            execute: jest.fn().mockResolvedValue(createdTeam),
        };
        const teamService = {
            update: jest.fn().mockResolvedValue(undefined),
            findById: jest.fn().mockResolvedValue({
                ...createdTeam,
                status: STATUS.ACTIVE,
            }),
        };
        const teamMembersService = {
            findOne: jest
                .fn()
                .mockResolvedValue(overrides?.existingMember ?? undefined),
            create: jest.fn().mockResolvedValue({ uuid: 'member-1' }),
        };
        const profileService = {
            findOne: jest.fn().mockResolvedValue(
                overrides && 'profile' in overrides
                    ? overrides.profile
                    : { name: 'Jan Jappy' },
            ),
        };

        const useCase = new CreateTeamWithMemberUseCase(
            createTeamUseCase as any,
            teamService as any,
            teamMembersService as any,
            profileService as any,
        );

        return {
            useCase,
            createTeamUseCase,
            teamService,
            teamMembersService,
            profileService,
        };
    };

    const actorUser = {
        uuid: 'user-1',
        email: 'jan@example.com',
        organization: { uuid: 'org-1' },
    };

    it('creates the team, attaches the actor as leader and activates it', async () => {
        const {
            useCase,
            createTeamUseCase,
            teamService,
            teamMembersService,
        } = buildUseCase();

        const team = await useCase.execute({
            teamName: 'Attraccess',
            actorUser,
        });

        expect(createTeamUseCase.execute).toHaveBeenCalledWith({
            teamName: 'Attraccess',
            organizationId: 'org-1',
            actorUserId: 'user-1',
        });

        expect(teamMembersService.create).toHaveBeenCalledWith({
            name: 'Jan Jappy',
            status: true,
            teamRole: TeamMemberRole.TEAM_LEADER,
            user: { uuid: 'user-1' },
            organization: { uuid: 'org-1' },
            team: { uuid: 'team-1' },
        });

        expect(teamService.update).toHaveBeenCalledWith(
            { uuid: 'team-1' },
            { status: STATUS.ACTIVE },
        );

        expect(team.uuid).toBe('team-1');
        expect(team.status).toBe(STATUS.ACTIVE);
    });

    it('falls back to the email prefix when no profile name exists', async () => {
        const { useCase, teamMembersService } = buildUseCase({
            profile: null,
        });

        await useCase.execute({ teamName: 'Attraccess', actorUser });

        expect(teamMembersService.create).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'jan' }),
        );
    });

    it('does not duplicate the membership when one already exists', async () => {
        const { useCase, teamMembersService } = buildUseCase({
            existingMember: { uuid: 'member-1' },
        });

        await useCase.execute({ teamName: 'Attraccess', actorUser });

        expect(teamMembersService.create).not.toHaveBeenCalled();
    });

    it('rejects when the request user has no organization', async () => {
        const { useCase, createTeamUseCase } = buildUseCase();

        await expect(
            useCase.execute({
                teamName: 'Attraccess',
                actorUser: { uuid: 'user-1', email: 'jan@example.com' },
            }),
        ).rejects.toThrow('Organization not found in request');

        expect(createTeamUseCase.execute).not.toHaveBeenCalled();
    });

    it('throws when the membership creation fails', async () => {
        const { useCase, teamMembersService } = buildUseCase();
        teamMembersService.create.mockResolvedValue(new Error('db down'));

        await expect(
            useCase.execute({ teamName: 'Attraccess', actorUser }),
        ).rejects.toThrow('Failed to create team member');
    });
});
