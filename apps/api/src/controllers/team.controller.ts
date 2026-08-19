import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Inject,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';

import {
    Action,
    ResourceType,
} from '@libs/identity/domain/permissions/enums/permissions.enum';
import {
    CheckPolicies,
    PolicyGuard,
} from '@libs/identity/infrastructure/adapters/services/permissions/policy.guard';
import { checkPermissions } from '@libs/identity/infrastructure/adapters/services/permissions/policy.handlers';
import { CreateTeamWithMemberUseCase } from '@libs/organization/application/use-cases/team/create-with-member.use-case';
import { DeleteTeamUseCase } from '@libs/organization/application/use-cases/team/delete.use-case';
import { ListTeamsWithIntegrationsUseCase } from '@libs/organization/application/use-cases/team/list-with-integrations.use-case';
import { ListTeamsUseCase } from '@libs/organization/application/use-cases/team/list.use-case';
import { CreateTeamDto } from '@libs/organization/dtos/create-team.dto';
import { TeamQueryDto } from '@libs/organization/dtos/teamId-query.dto';
import { UserRequest } from '@libs/core/infrastructure/config/types/http/user-request.type';
import { REQUEST } from '@nestjs/core';
import {
    ApiBearerAuth,
    ApiCreatedResponse,
    ApiNoContentResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { ApiStandardResponses } from '../docs/api-standard-responses.decorator';
import { ApiArrayResponseDto } from '../dtos/api-response.dto';
import {
    TeamListResponseDto,
    TeamResponseDto,
} from '../dtos/team-response.dto';

@ApiTags('Team')
@ApiBearerAuth('jwt')
@ApiStandardResponses()
@Controller('team')
export class TeamController {
    constructor(
        private readonly listTeamsUseCase: ListTeamsUseCase,
        private readonly listTeamsWithIntegrationsUseCase: ListTeamsWithIntegrationsUseCase,
        private readonly createTeamWithMemberUseCase: CreateTeamWithMemberUseCase,
        private readonly deleteTeamUseCase: DeleteTeamUseCase,

        @Inject(REQUEST)
        private readonly request: UserRequest,
    ) {}

    @Get('/')
    @ApiOperation({
        summary: 'List teams',
        description: 'Return teams for the authenticated organization.',
    })
    @ApiOkResponse({ type: TeamListResponseDto })
    public async list() {
        return await this.listTeamsUseCase.execute();
    }

    @Get('/list-with-integrations')
    @ApiOperation({
        summary: 'List teams with integrations',
        description: 'Return teams and their integration status.',
    })
    @ApiOkResponse({ type: ApiArrayResponseDto })
    public async listWithIntegrations() {
        return await this.listTeamsWithIntegrationsUseCase.execute();
    }

    @Post('/')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Create,
            resource: ResourceType.OrganizationSettings,
        }),
    )
    @ApiOperation({
        summary: 'Create team',
        description:
            'Create an additional team in the authenticated organization and ' +
            'attach the acting user as its leader, so each team can connect a ' +
            'different GitHub organization.',
    })
    @ApiCreatedResponse({ type: TeamResponseDto })
    public async createTeam(@Body() body: CreateTeamDto) {
        const team = await this.createTeamWithMemberUseCase.execute({
            teamName: body.name,
            actorUser: this.request.user,
        });

        return team.toJson();
    }

    @Delete('/')
    @UseGuards(PolicyGuard)
    @CheckPolicies(
        checkPermissions({
            action: Action.Delete,
            resource: ResourceType.OrganizationSettings,
        }),
    )
    @ApiOperation({
        summary: 'Delete team',
        description:
            'Soft-delete an additional team (workspace), disconnecting its git ' +
            'integration and deactivating its members. The last remaining team ' +
            'of the organization cannot be deleted.',
    })
    @ApiNoContentResponse({ description: 'Team deleted' })
    public async deleteTeam(@Query() query: TeamQueryDto) {
        const organizationId = this.request.user?.organization?.uuid;

        if (!organizationId) {
            throw new BadRequestException(
                'Organization not found in request',
            );
        }

        await this.deleteTeamUseCase.execute({
            teamId: query.teamId,
            organizationId,
        });
    }
}
