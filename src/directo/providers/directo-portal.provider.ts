import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { chromium, Page } from 'playwright';
import type {
  DirectoConsultInput,
  DirectoConsultResult,
  DirectoProvider,
} from '../interfaces/directo-provider.interface';
import { DirectoLeadStatus } from '../enums/directo-lead-status.enum';

@Injectable()
export class DirectoPortalProvider implements DirectoProvider {
  private readonly logger = new Logger(DirectoPortalProvider.name);

  private readonly loginUrl =
    process.env.DIRECTO_LOGIN_URL ||
    'https://minegocio.directo.com.ar/login?utm_source=Web&utm_medium=Login&utm_campaign=Institucional&utm_content=iniciarSesion';

  private readonly username = process.env.DIRECTO_USERNAME || '';
  private readonly password = process.env.DIRECTO_PASSWORD || '';
  private readonly timeoutMs = Number(process.env.DIRECTO_TIMEOUT_MS || 45000);
  private readonly headless =
    String(process.env.DIRECTO_HEADLESS ?? 'true').toLowerCase() === 'true';
  private readonly debug =
    String(process.env.DIRECTO_DEBUG ?? 'false').toLowerCase() === 'true';

  async consult(input: DirectoConsultInput): Promise<DirectoConsultResult> {
    if (!this.username || !this.password) {
      throw new InternalServerErrorException(
        'Faltan DIRECTO_USERNAME o DIRECTO_PASSWORD en variables de entorno.',
      );
    }

    const browser = await chromium.launch({
      headless: this.headless,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(this.timeoutMs);

    try {
      this.logger.log(`Iniciando consulta Directo para DNI ${input.dni}`);

      await this.login(page);
      await this.selectMotoSale(page);
      await this.fillDocumentStep(page, input.dni, input.gender);
      const fullName = await this.confirmValidatedPerson(page);
      const result = await this.readFinalResult(page, fullName);

      this.logger.log(
        `Consulta Directo finalizada para DNI ${input.dni}. Estado: ${result.status}`,
      );

      return result;
    } catch (error: any) {
      await this.dumpDebug(page, '99-general-error').catch(() => undefined);

      this.logger.error(
        `Error consultando Directo para DNI ${input.dni}: ${error?.message || error}`,
        error?.stack,
      );

      return {
        success: false,
        status: DirectoLeadStatus.ERROR,
        fullName: null,
        maxApprovedAmount: null,
        message:
          error?.message ||
          'No se pudo completar la consulta automática en Directo.',
        externalReference: null,
        rawResponse: {
          error: error?.message || String(error),
        },
      };
    } finally {
      await page.close().catch(() => undefined);
      await context.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }

  private async login(page: Page): Promise<void> {
    await page.goto(this.loginUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.timeoutMs,
    });

    await page.waitForTimeout(3000);

    await this.dumpDebug(page, '01-login-page-loaded');

    await this.fillFirst(
      page,
      [
        'input[name="username"]',
        'input[name="user"]',
        'input[name="email"]',
        'input[name="login"]',
        'input[name="document"]',
        'input[id="username"]',
        'input[id="user"]',
        'input[id="email"]',
        'input[id="login"]',
        'input[id*="user"]',
        'input[id*="mail"]',
        'input[id*="login"]',
        'input[autocomplete="username"]',
        'input[type="email"]',
        'input[type="text"]',
      ],
      this.username,
      'usuario',
    );

    await this.fillFirst(
      page,
      [
        'input[name="password"]',
        'input[name="pass"]',
        'input[id="password"]',
        'input[id="pass"]',
        'input[id*="pass"]',
        'input[autocomplete="current-password"]',
        'input[type="password"]',
      ],
      this.password,
      'contraseña',
    );

    await this.dumpDebug(page, '02-login-filled');

    await this.clickFirst(page, [
      'button[type="submit"]',
      'button:has-text("Ingresar")',
      'button:has-text("Iniciar sesión")',
      'button:has-text("Iniciar sesion")',
      'button:has-text("Continuar")',
      'button:has-text("Entrar")',
      'input[type="submit"]',
    ]);

    await page.waitForTimeout(4000);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    await this.dumpDebug(page, '03-after-login-submit');
  }

  private async selectMotoSale(page: Page): Promise<void> {
    await this.waitForAny(page, [
      'text=Moto',
      'label:has-text("Moto")',
      'button:has-text("Continuar")',
      'text=tipo de venta',
      'text=Tipo de venta',
    ]);

    await this.dumpDebug(page, '10-sale-type-screen');

    const motoHandled = await this.trySelectMoto(page);

    if (!motoHandled) {
      throw new Error(
        'No se pudo seleccionar el tipo de venta "Moto". Revisar selectores del portal.',
      );
    }

    await this.clickFirst(page, [
      'button:has-text("Continuar")',
      'button:has-text("CONTINUAR")',
      'button[type="submit"]',
      'text=Continuar',
    ]);

    await page.waitForLoadState('networkidle').catch(() => undefined);
    await this.dumpDebug(page, '11-after-sale-type');
  }

  private async fillDocumentStep(
    page: Page,
    dni: string,
    gender: 'M' | 'F',
  ): Promise<void> {
    await this.waitForAny(page, [
      'input[placeholder*="12345678"]',
      'input[placeholder*="Ej:"]',
      'input[type="text"]',
      'text=DNI',
      'text=Documento',
    ]);

    await this.dumpDebug(page, '20-document-step');

    await this.fillFirst(
      page,
      [
        'input[placeholder*="12345678"]',
        'input[placeholder*="Ej:"]',
        'input[placeholder*="Documento"]',
        'input[placeholder*="DNI"]',
        'input[name="dni"]',
        'input[id*="dni"]',
        'input[type="text"]',
      ],
      dni,
      'dni',
    );

    await this.selectGender(page, gender);

    await this.clickFirst(page, [
      'button:has-text("Continuar")',
      'button:has-text("CONTINUAR")',
      'button[type="submit"]',
      'text=Continuar',
    ]);

    await page.waitForLoadState('networkidle').catch(() => undefined);
    await this.dumpDebug(page, '21-after-document-step');
  }

  private async confirmValidatedPerson(page: Page): Promise<string | null> {
    await this.waitForAny(page, [
      'text=Validá la identidad de tu cliente',
      'text=Valida la identidad de tu cliente',
      'text=¿Es el nombre de tu cliente?',
      'text=No es el nombre de mi cliente',
    ]);

    await this.dumpDebug(page, '30-confirm-person');

    const bodyText = await page.locator('body').innerText();
    const lines = bodyText
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);

    const candidateName =
      lines.find((line) => {
        if (line.length < 5) return false;
        if (line.length > 80) return false;

        const upper = line.toUpperCase() === line;
        const hasLetters = /[A-ZÁÉÍÓÚÑ]/.test(line);

        const blacklist = [
          'CONTINUAR',
          'VOLVER',
          'DNI',
          'GÉNERO',
          'GENERO',
          'TIPO DE VENTA',
          'MOTO',
          'LO SENTIMOS',
          'OFERTA',
          'VALIDÁ LA IDENTIDAD DE TU CLIENTE',
          'VALIDA LA IDENTIDAD DE TU CLIENTE',
          'NO ES EL NOMBRE DE MI CLIENTE',
        ];

        return upper && hasLetters && !blacklist.includes(line.toUpperCase());
      }) || null;

    await this.clickFirst(page, [
      'button:has-text("Continuar")',
      'button:has-text("CONTINUAR")',
      'button[type="submit"]',
      'text=Continuar',
    ]);

    await page.waitForTimeout(6000);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await this.dumpDebug(page, '31-after-confirm-person');

    return candidateName;
  }

  private async readFinalResult(
    page: Page,
    fullName: string | null,
  ): Promise<DirectoConsultResult> {
    await this.waitForAny(page, [
      'text=Lo sentimos',
      'text=no encontramos una oferta',
      'text=oferta para tu cliente',
      'text=monto máximo',
      'text=monto',
      'text=Tu cliente puede acceder',
      'text=podés continuar',
    ]);

    await this.dumpDebug(page, '40-final-result');

    const bodyText = await page.locator('body').innerText();
    const normalizedText = bodyText.replace(/\s+/g, ' ').trim();

    const rejected =
      /lo sentimos/i.test(normalizedText) ||
      /no encontramos una oferta/i.test(normalizedText);

    if (rejected) {
      return {
        success: true,
        status: DirectoLeadStatus.REJECTED,
        fullName,
        maxApprovedAmount: null,
        message:
          'En este momento no encontramos una oferta para tu cliente. Podés intentarlo en otro momento y seguro te vamos a ayudar.',
        externalReference: null,
        rawResponse: {
          finalScreenText: bodyText,
        },
      };
    }

    const stillInIdentityStep =
      /validá la identidad de tu cliente/i.test(normalizedText) ||
      /valida la identidad de tu cliente/i.test(normalizedText) ||
      /no es el nombre de mi cliente/i.test(normalizedText);

    if (stillInIdentityStep) {
      throw new Error(
        'La navegación quedó detenida en la pantalla de validación de identidad y no avanzó al resultado final.',
      );
    }

    const maxApprovedAmount = this.extractCurrency(normalizedText);

    if (maxApprovedAmount !== null) {
      return {
        success: true,
        status: DirectoLeadStatus.APPROVED,
        fullName,
        maxApprovedAmount,
        message: 'Cliente apto para crédito.',
        externalReference: null,
        rawResponse: {
          finalScreenText: bodyText,
        },
      };
    }

    throw new Error(
      'No se pudo interpretar el resultado final de Directo. Revisar textos/selectores de la pantalla final.',
    );
  }

  private extractCurrency(text: string): number | null {
    const matches = text.match(/\$\s?[\d\.\,]+/g) || [];

    if (!matches.length) {
      const plainMatches = text.match(/\b\d{5,}(?:[\.\,]\d{2})?\b/g) || [];
      const parsedPlain = plainMatches
        .map((m) => this.parseMoney(m))
        .filter((n): n is number => n !== null)
        .sort((a, b) => b - a);

      return parsedPlain.length ? parsedPlain[0] : null;
    }

    const parsed = matches
      .map((m) => this.parseMoney(m))
      .filter((n): n is number => n !== null)
      .sort((a, b) => b - a);

    return parsed.length ? parsed[0] : null;
  }

  private parseMoney(value: string): number | null {
    const cleaned = value.replace(/[^\d,\.]/g, '');

    if (!cleaned) return null;

    if (cleaned.includes(',') && cleaned.includes('.')) {
      const normalized = cleaned.replace(/\./g, '').replace(',', '.');
      const num = Number(normalized);
      return Number.isFinite(num) ? num : null;
    }

    if (cleaned.includes('.') && !cleaned.includes(',')) {
      const normalized = cleaned.replace(/\./g, '');
      const num = Number(normalized);
      return Number.isFinite(num) ? num : null;
    }

    if (cleaned.includes(',') && !cleaned.includes('.')) {
      const normalized = cleaned.replace(',', '.');
      const num = Number(normalized);
      return Number.isFinite(num) ? num : null;
    }

    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  private async trySelectMoto(page: Page): Promise<boolean> {
    const selectors = [
      'label:has-text("Moto")',
      'text=Moto',
      '[role="radio"]:has-text("Moto")',
      '[role="button"]:has-text("Moto")',
      '.MuiFormControlLabel-root:has-text("Moto")',
    ];

    for (const selector of selectors) {
      const locator = page.locator(selector).first();

      try {
        if (await locator.count()) {
          await locator.click({ timeout: 3000 });
          return true;
        }
      } catch {
        // sigue con el próximo selector
      }
    }

    const radioMoto = page
      .locator('input[type="radio"][value*="moto" i]')
      .first();
    if (await radioMoto.count()) {
      await radioMoto.check().catch(() => undefined);
      return true;
    }

    const select = page.locator('select').first();
    if (await select.count()) {
      const options = await select.locator('option').allTextContents();
      const motoOption = options.find((opt) => /moto/i.test(opt));
      if (motoOption) {
        await select.selectOption({ label: motoOption }).catch(() => undefined);
        return true;
      }
    }

    return false;
  }

  private async selectGender(page: Page, gender: 'M' | 'F'): Promise<void> {
    const labels =
      gender === 'M'
        ? ['Masculino', 'MASCULINO', 'Hombre', 'Male', 'M']
        : ['Femenino', 'FEMENINO', 'Mujer', 'Female', 'F'];

    for (const label of labels) {
      const selectors = [
        `label:has-text("${label}")`,
        `text=${label}`,
        `[role="radio"]:has-text("${label}")`,
        `[role="button"]:has-text("${label}")`,
      ];

      for (const selector of selectors) {
        const locator = page.locator(selector).first();
        if (await locator.count()) {
          await locator.click({ timeout: 2000 }).catch(() => undefined);
          return;
        }
      }
    }

    const directValue = gender === 'M' ? '3' : '2';
    const directRadio = page
      .locator(`input[type="radio"][value="${directValue}"]`)
      .first();

    if (await directRadio.count()) {
      await directRadio.check().catch(() => undefined);
      return;
    }

    const radios = page.locator('input[type="radio"]');
    const radioCount = await radios.count();

    if (radioCount >= 2) {
      const index = gender === 'M' ? 1 : 0;
      await radios.nth(index).check().catch(() => undefined);
      return;
    }

    const select = page.locator('select').nth(0);
    if (await select.count()) {
      const options = await select.locator('option').allTextContents();
      const option = options.find((opt) =>
        labels.some((label) => opt.toLowerCase().includes(label.toLowerCase())),
      );
      if (option) {
        await select.selectOption({ label: option }).catch(() => undefined);
        return;
      }
    }

    throw new Error(
      `No se pudo seleccionar el género ${gender}. Revisar selectores del portal.`,
    );
  }

  private normalizeDigits(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private async fillFirst(
    page: Page,
    selectors: string[],
    value: string,
    fieldLabel = 'campo',
  ): Promise<void> {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();

      try {
        const count = await locator.count();
        if (!count) continue;

        await locator
          .waitFor({ state: 'visible', timeout: 2000 })
          .catch(() => undefined);

        await locator.fill(value, { timeout: 3000 });

        const currentValue = await locator.inputValue().catch(() => '');

        const ok =
          fieldLabel === 'dni'
            ? this.normalizeDigits(currentValue) === this.normalizeDigits(value)
            : currentValue === value;

        if (ok) {
          return;
        }
      } catch {
        // sigue con el próximo selector
      }
    }

    const inputs = await page
      .locator('input')
      .evaluateAll((elements) =>
        elements.map((el) => ({
          type: el.getAttribute('type'),
          name: el.getAttribute('name'),
          id: el.getAttribute('id'),
          placeholder: el.getAttribute('placeholder'),
          autocomplete: el.getAttribute('autocomplete'),
          value: (el as HTMLInputElement).value,
        })),
      )
      .catch(() => []);

    this.logger.error(
      `No se encontró un campo para completar ${fieldLabel}. Inputs detectados: ${JSON.stringify(inputs)}`,
    );

    await this.dumpDebug(page, `fill-error-${fieldLabel}`);

    throw new Error(`No se encontró un campo para completar ${fieldLabel}: ${value}`);
  }

  private async clickFirst(page: Page, selectors: string[]): Promise<void> {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();

      try {
        const count = await locator.count();
        if (!count) continue;

        await locator.click({ timeout: 5000 });
        return;
      } catch {
        // sigue con el próximo selector
      }
    }

    await this.dumpDebug(page, 'click-error');

    throw new Error(
      `No se encontró ningún botón/acción compatible. Selectores probados: ${selectors.join(' | ')}`,
    );
  }

  private async waitForAny(
    page: Page,
    selectors: string[],
    timeout = 6000,
  ): Promise<void> {
    for (const selector of selectors) {
      try {
        await page.locator(selector).first().waitFor({
          state: 'visible',
          timeout,
        });
        return;
      } catch {
        // sigue
      }
    }

    await this.dumpDebug(page, 'wait-for-any-error');

    throw new Error(
      `No apareció ningún selector esperado. Selectores probados: ${selectors.join(' | ')}`,
    );
  }

  private async dumpDebug(page: Page, label: string): Promise<void> {
    if (!this.debug) return;

    try {
      const fs = await import('fs');
      const path = await import('path');

      const dir = path.join(process.cwd(), 'tmp', 'directo-debug');
      fs.mkdirSync(dir, { recursive: true });

      const safeLabel = label.replace(/[^a-zA-Z0-9-_]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const screenshotPath = path.join(dir, `${timestamp}-${safeLabel}.png`);
      const htmlPath = path.join(dir, `${timestamp}-${safeLabel}.html`);

      await page
        .screenshot({ path: screenshotPath, fullPage: true })
        .catch(() => undefined);

      const html = await page.content().catch(() => '');
      fs.writeFileSync(htmlPath, html, 'utf8');

      this.logger.log(`Debug guardado: ${screenshotPath}`);
      this.logger.log(`HTML guardado: ${htmlPath}`);
    } catch (error: any) {
      this.logger.warn(
        `No se pudo guardar debug ${label}: ${error?.message || error}`,
      );
    }
  }
}