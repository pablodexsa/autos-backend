import { CuotaRedGender } from '../enums/cuotared-gender.enum';
import { CuotaRedLeadStatus } from '../enums/cuotared-lead-status.enum';

export type CuotaRedConsultInput = {
  dni: string;
  gender: CuotaRedGender;
};

export type CuotaRedConsultResult = {
  success: boolean;
  status: CuotaRedLeadStatus;
  maxApprovedAmount?: number | null;
  message?: string | null;
  rawResponse?: any;
  firstName?: string;
  lastName?: string;
  fullName?: string;
};

export interface CuotaRedProvider {
  consult(input: CuotaRedConsultInput): Promise<CuotaRedConsultResult>;
}