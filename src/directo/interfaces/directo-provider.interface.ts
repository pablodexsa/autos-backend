import { DirectoGender } from '../enums/directo-gender.enum';
import { DirectoLeadStatus } from '../enums/directo-lead-status.enum';

export type DirectoConsultInput = {
  dni: string;
  gender: DirectoGender;
  saleType: 'moto';
};

export type DirectoConsultResult = {
  success: boolean;
  status: DirectoLeadStatus;
  fullName?: string | null;
  maxApprovedAmount?: number | null;
  message?: string | null;
  externalReference?: string | null;
  rawResponse?: any;
};

export interface DirectoProvider {
  consult(input: DirectoConsultInput): Promise<DirectoConsultResult>;
}