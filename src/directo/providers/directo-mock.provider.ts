import { Injectable } from '@nestjs/common';
import {
  DirectoConsultInput,
  DirectoConsultResult,
  DirectoProvider,
} from '../interfaces/directo-provider.interface';
import { DirectoLeadStatus } from '../enums/directo-lead-status.enum';

@Injectable()
export class DirectoMockProvider implements DirectoProvider {
  async consult(input: DirectoConsultInput): Promise<DirectoConsultResult> {
    const lastDigit = Number(input.dni.slice(-1));

    if (Number.isNaN(lastDigit)) {
      return {
        success: false,
        status: DirectoLeadStatus.ERROR,
        fullName: null,
        maxApprovedAmount: null,
        message: 'DNI inválido para consulta.',
        externalReference: null,
        rawResponse: { reason: 'invalid_dni' },
      };
    }

    if (lastDigit % 2 === 0) {
      return {
        success: true,
        status: DirectoLeadStatus.APPROVED,
        fullName: 'Cliente Validado Mock',
        maxApprovedAmount: 3500000,
        message: 'Cliente apto para crédito.',
        externalReference: null,
        rawResponse: {
          provider: 'mock',
          approved: true,
          dni: input.dni,
          gender: input.gender,
          saleType: input.saleType,
        },
      };
    }

    return {
      success: true,
      status: DirectoLeadStatus.REJECTED,
      fullName: 'Cliente Validado Mock',
      maxApprovedAmount: null,
      message:
        'En este momento no encontramos una oferta para tu cliente. Podés intentarlo en otro momento y seguro te vamos a ayudar.',
      externalReference: null,
      rawResponse: {
        provider: 'mock',
        approved: false,
        dni: input.dni,
        gender: input.gender,
        saleType: input.saleType,
      },
    };
  }
}