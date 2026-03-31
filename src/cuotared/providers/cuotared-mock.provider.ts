import { Injectable } from '@nestjs/common';
import {
  CuotaRedConsultInput,
  CuotaRedConsultResult,
  CuotaRedProvider,
} from '../interfaces/cuotared-provider.interface';
import { CuotaRedLeadStatus } from '../enums/cuotared-lead-status.enum';

@Injectable()
export class CuotaRedMockProvider implements CuotaRedProvider {
  async consult(input: CuotaRedConsultInput): Promise<CuotaRedConsultResult> {
    const lastDigit = Number(input.dni.slice(-1));

    if (Number.isNaN(lastDigit)) {
      return {
        success: false,
        status: CuotaRedLeadStatus.ERROR,
        fullName: '',
        maxApprovedAmount: null,
        message: 'DNI inválido para consulta.',
        rawResponse: { reason: 'invalid_dni' },
      };
    }

    if (lastDigit % 2 === 0) {
      return {
        success: true,
        status: CuotaRedLeadStatus.APPROVED,
        fullName: 'Cliente Validado Mock',
        maxApprovedAmount: 8000000,
        message: 'Cliente apto para crédito en Cuota Red.',
        rawResponse: {
          provider: 'mock',
          approved: true,
          dni: input.dni,
          gender: input.gender,
        },
      };
    }

    return {
      success: true,
      status: CuotaRedLeadStatus.REJECTED,
      fullName: 'Cliente Validado Mock',
      maxApprovedAmount: null,
      message: 'El cliente no cumple con las políticas crediticias.',
      rawResponse: {
        provider: 'mock',
        approved: false,
        dni: input.dni,
        gender: input.gender,
      },
    };
  }
}