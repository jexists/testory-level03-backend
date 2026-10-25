import { SetMetadata } from '@nestjs/common';
import type { Role } from '../../shared/types';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
