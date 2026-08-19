import { Module, forwardRef } from '@nestjs/common';

import { PlatformModule } from '@libs/platform/modules/platform.module';

import { DeleteTeamUseCase } from '../application/use-cases/team/delete.use-case';
import { TeamModule } from './team.module';
import { TeamMembersModule } from './teamMembers.module';

@Module({
    imports: [
        forwardRef(() => TeamModule),
        forwardRef(() => TeamMembersModule),
        forwardRef(() => PlatformModule),
    ],
    providers: [DeleteTeamUseCase],
    exports: [DeleteTeamUseCase],
})
export class TeamDeletionModule {}
