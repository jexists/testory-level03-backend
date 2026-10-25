import { NotFoundException, ParseIntPipe } from '@nestjs/common';
import { MSG } from '../../shared/constants/messages';

export const IdPipe = new ParseIntPipe({ exceptionFactory: () => new NotFoundException(MSG.ITEM_NOT_FOUND) });
