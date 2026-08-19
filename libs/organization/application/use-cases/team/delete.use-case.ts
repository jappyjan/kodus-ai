import {
    BadRequestException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { IUseCase } from '@libs/core/domain/interfaces/use-case.interface';
import { STATUS } from '@libs/core/infrastructure/config/types/database/status.type';
import { createLogger } from '@libs/core/log/logger';
import {
    ITeamService,
    TEAM_SERVICE_TOKEN,
} from '@libs/organization/domain/team/contracts/team.service.contract';
import {
    ITeamMemberService,
    TEAM_MEMBERS_SERVICE_TOKEN,
} from '@libs/organization/domain/teamMembers/contracts/teamMembers.service.contracts';
import { DeleteIntegrationAndRepositoriesUseCase } from '@libs/platform/application/use-cases/codeManagement/delete-integration-and-repositories.use-case';

/**
 * Deletes an additional team (workspace) created for multi-org setups.
 *
 * The team is soft-deleted (status REMOVED) — the same mechanism the product
 * already uses to retire records — after disconnecting its git integration
 * and deactivating its memberships, so no webhook/review pipeline keeps
 * operating on it. The organization's last remaining team can never be
 * deleted.
 */
@Injectable()
export class DeleteTeamUseCase implements IUseCase {
    private readonly logger = createLogger(DeleteTeamUseCase.name);

    constructor(
        @Inject(TEAM_SERVICE_TOKEN)
        private readonly teamService: ITeamService,

        @Inject(TEAM_MEMBERS_SERVICE_TOKEN)
        private readonly teamMembersService: ITeamMemberService,

        private readonly deleteIntegrationAndRepositoriesUseCase: DeleteIntegrationAndRepositoriesUseCase,
    ) {}

    public async execute(payload: {
        teamId: string;
        organizationId: string;
    }): Promise<void> {
        const { teamId, organizationId } = payload;

        const team = await this.teamService.findOne({ uuid: teamId });

        if (
            !team ||
            team.status === STATUS.REMOVED ||
            team.organization?.uuid !== organizationId
        ) {
            throw new NotFoundException('api.team.not_found');
        }

        const remainingTeams = await this.teamService.find(
            { organization: { uuid: organizationId } },
            [STATUS.ACTIVE, STATUS.PENDING],
        );

        if (remainingTeams.length <= 1) {
            throw new BadRequestException('api.team.cannot_delete_last_team');
        }

        // Disconnect the team's git integration and drop its repository
        // selection so webhooks/reviews stop targeting it. Best-effort: a
        // team without integration simply has nothing to clean up, and a
        // cleanup hiccup must not block the deletion itself.
        try {
            await this.deleteIntegrationAndRepositoriesUseCase.execute({
                organizationId,
                teamId,
            });
        } catch (error) {
            this.logger.warn({
                message:
                    'Integration cleanup failed while deleting team; proceeding with team deletion',
                context: DeleteTeamUseCase.name,
                error,
                metadata: { organizationId, teamId },
            });
        }

        const members = await this.teamMembersService.findManyByRelations({
            organizationId,
            teamId,
        });

        if (members?.length) {
            await this.teamMembersService.deleteMembers(members);
        }

        await this.teamService.update(
            { uuid: teamId },
            { status: STATUS.REMOVED },
        );

        this.logger.log({
            message: 'Team deleted',
            context: DeleteTeamUseCase.name,
            metadata: { organizationId, teamId, name: team.name },
        });
    }
}
