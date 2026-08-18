import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTeamDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    @ApiProperty({
        example: 'Attraccess',
        description: 'Name of the team to create.',
    })
    name: string;
}
