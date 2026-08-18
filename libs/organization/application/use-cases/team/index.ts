import { CreateTeamUseCase } from './create.use-case';
import { CreateTeamWithMemberUseCase } from './create-with-member.use-case';
import { ListTeamsWithIntegrationsUseCase } from './list-with-integrations.use-case';
import { ListTeamsUseCase } from './list.use-case';

export const UseCases = [
    CreateTeamUseCase,
    CreateTeamWithMemberUseCase,
    ListTeamsUseCase,
    ListTeamsWithIntegrationsUseCase,
];
