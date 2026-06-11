import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';

@Injectable()
export class BcraService {
  private readonly baseUrl =
    process.env.BCRA_API_BASE_URL ||
    'https://api.bcra.gob.ar/centraldedeudores/v1.0';

  private readonly httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  normalizeCuitCuil(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  validateCuitCuil(value: string): string {
    const normalized = this.normalizeCuitCuil(value);

    if (!/^\d{11}$/.test(normalized)) {
      throw new BadRequestException(
        'El CUIT/CUIL debe tener 11 dígitos numéricos',
      );
    }

    return normalized;
  }

  async getDebtorInfo(cuitCuil: string) {
    const normalized = this.validateCuitCuil(cuitCuil);
    const url = `${this.baseUrl}/Deudas/${normalized}`;

    try {
      const response = await axios.get(url, {
        httpsAgent: this.httpsAgent,
        timeout: 15000,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Kairos/1.0',
        },
      });

      return {
        success: true,
        statusCode: response.status,
        cuitCuil: normalized,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        statusCode: error?.response?.status || 500,
        cuitCuil: normalized,
        message: error?.message || 'Error consultando BCRA',
        data: error?.response?.data || null,
      };
    }
  }

  summarizeDebtorInfo(result: any): string {
    if (!result?.success) {
      return 'ERROR';
    }

    const data = result.data;

    const results =
      data?.results ||
      data?.Results ||
      data?.deudas ||
      data?.Deudas ||
      data?.data ||
      [];

    if (!Array.isArray(results) || results.length === 0) {
      return 'SIN_DEUDA_INFORMADA';
    }

    const worstSituation = results.reduce((max: number, item: any) => {
      const value = Number(
        item.situacion ||
          item.Situacion ||
          item.situation ||
          item.Situation ||
          0,
      );

      return value > max ? value : max;
    }, 0);

    if (!worstSituation) {
      return 'CON_DEUDA_SIN_SITUACION';
    }

    return `SITUACION_${worstSituation}`;
  }
}