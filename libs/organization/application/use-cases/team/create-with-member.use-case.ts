import {
    BadRequestException,
    Inject,
    Injectable,
    InternalServerErrorException,
} from '@nestjs/common';

import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { STATUS } from '@libs/core/infrastructure/config/types/database/status.type';
import { createLogger } from '@libs/core/log/logger';
import {
    IProfileService,
    PROFILE_SERVICE_TOKEN,
} from '@libs/identity/domain/profile/contracts/profile.service.contract';
import { IUser } from '@libs/identity/domain/user/interfaces/user.interface';
import {
    ITeamService,
    TEAM_SERVICE_TOKEN,
} from '@libs/organization/domain/team/contracts/team.service.contract';
import { TeamEntity } from '@libs/organization/domain/team/entities/team.entity';
import {
    ITeamMemberService,
    TEAM_MEMBERS_SERVICE_TOKEN,
} from '@libs/organization/domain/teamMembers/contracts/teamMembers.service.contracts';
import { TeamMemberRole } from '@libs/organization/domain/teamMembers/enums/teamMemberRole.enum';

import { CreateTeamUseCase } from './create.use-case';

/**
 * Creates an additional team for an already-existing organization and wires
 * the acting user to it the same way signup wires the founding owner:
 * team row + initial parameters (via {@link CreateTeamUseCase}) followed by a
 * `team_leader` membership. Without the membership the creator cannot use the
 * new team (per-team GitHub integrations, member lookups and non-owner team
 * lists all key off `team_member`).
 *
 * The new team is activated immediately (signup leaves the first team
 * `PENDING` until repositories are chosen) so it can be selected in the
 * workspace switcher right away; its onboarding is still gated by the
 * per-team `platform_configs.finishOnboard` parameter, which drives the
 * setup flow where the user connects that team's own GitHub org.
 */
@Injectable()
export class CreateTeamWithMemberUseCase implements IUseCase {
    private readonly logger = createLogger(CreateTeamWithMemberUseCase.name);

    constructor(
        private readonly createTeamUseCase: CreateTeamUseCase,

        @Inject(TEAM_SERVICE_TOKEN)
        private readonly teamService: ITeamService,

        @Inject(TEAM_MEMBERS_SERVICE_TOKEN)
        private readonly teamMembersService: ITeamMemberService,

        @Inject(PROFILE_SERVICE_TOKEN)
        private readonly profileService: IProfileService,
    ) {}

    public async execute(payload: {
        teamName: string;
        actorUser: Partial<IUser>;
    }): Promise<TeamEntity> {
        const { teamName, actorUser } = payload;
        const userId = actorUser?.uuid;
        const organizationId = actorUser?.organization?.uuid;

        if (!userId) {
            throw new BadRequestException('User not found in request');
        }

        if (!organizationId) {
            throw new BadRequestException(
                'Organization not found in request',
            );
        }

        const team = await this.createTeamUseCase.execute({
            teamName,
            organizationId,
            actorUserId: userId,
        });

        if (!team?.uuid) {
            throw new InternalServerErrorException('Team creation failed');
        }

        await this.attachActorAsMember(team, actorUser, organizationId);

        const activatedTeam = await this.activateTeam(team);

        return activatedTeam;
    }

    /**
     * Activate the team and VERIFY the state landed. A team stuck in
     * PENDING is invisible to the ACTIVE-only guards in the app and was
     * the source of onboarding redirect loops, so a silent no-op update
     * gets one retry and a loud error instead of passing unnoticed.
     */
    private async activateTeam(team: TeamEntity): Promise<TeamEntity> {
        for (let attempt = 1; attempt <= 2; attempt++) {
            await this.teamService.update(
                { uuid: team.uuid },
                { status: STATUS.ACTIVE },
            );

            const updatedTeam = await this.teamService.findById(team.uuid);

            if (updatedTeam?.status === STATUS.ACTIVE) {
                return updatedTeam;
            }

            this.logger.error({
                message: `Team activation attempt ${attempt} did not persist ACTIVE status`,
                context: CreateTeamWithMemberUseCase.name,
                metadata: {
                    teamId: team.uuid,
                    statusAfter: updatedTeam?.status,
                },
            });
        }

        throw new InternalServerErrorException(
            'Team was created but could not be activated',
        );
    }

    /**
     * Mirrors the signup membership wiring (`SignUpUseCase` +
     * `teamMembersService.create`). Idempotent for the user/team pair so a
     * retried request after a partial failure cannot duplicate the member.
     */
    private async attachActorAsMember(
        team: TeamEntity,
        actorUser: Partial<IUser>,
        organizationId: string,
    ): Promise<void> {
        const existingMember = await this.teamMembersService.findOne({
            user: { uuid: actorUser.uuid },
            team: { uuid: team.uuid },
        });

        if (existingMember) {
            return;
        }

        const name = await this.resolveMemberName(actorUser);

        const member = await this.teamMembersService.create({
            name,
            status: true,
            teamRole: TeamMemberRole.TEAM_LEADER,
            user: { uuid: actorUser.uuid },
            organization: { uuid: organizationId },
            team: { uuid: team.uuid },
        });

        if (!member?.uuid) {
            throw new InternalServerErrorException(
                'Failed to create team member',
            );
        }
    }

    private async resolveMemberName(
        actorUser: Partial<IUser>,
    ): Promise<string> {
        try {
            const profile = await this.profileService.findOne({
                user: { uuid: actorUser.uuid },
            });

            if (profile?.name) {
                return profile.name;
            }
        } catch (error) {
            this.logger.warn({
                message: 'Failed to load profile name for new team member',
                context: CreateTeamWithMemberUseCase.name,
                error,
                metadata: { userId: actorUser.uuid },
            });
        }

        return actorUser.email?.split('@')[0] || 'Member';
    }
}
