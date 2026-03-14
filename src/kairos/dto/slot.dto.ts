import { QuoteResult } from '../../engine/types';

export class SlotDto {
  start: Date;
  end: Date;
  staffId: string;
  quote: QuoteResult;
}

export class DaySlotsDto {
  date: string; // ISO yyyy-mm-dd
  slots: SlotDto[];
}
