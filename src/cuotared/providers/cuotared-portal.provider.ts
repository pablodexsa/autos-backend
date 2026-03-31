import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { chromium, Frame, Page } from 'playwright';
import type {
  CuotaRedConsultInput,
  CuotaRedConsultResult,
  CuotaRedProvider,
} from '../interfaces/cuotared-provider.interface';
import { CuotaRedLeadStatus } from '../enums/cuotared-lead-status.enum';

@Injectable()
export class CuotaRedPortalProvider implements CuotaRedProvider {
  private readonly logger = new Logger(CuotaRedPortalProvider.name);

  private readonly loginUrl =
    process.env.CUOTARED_LOGIN_URL ||
    'https://loan.cuotared.ampf.org.ar/IndexIframe.aspx';

  private readonly username = process.env.CUOTARED_USERNAME || '';
  private readonly password = process.env.CUOTARED_PASSWORD || '';
  private readonly timeoutMs = Number(process.env.CUOTARED_TIMEOUT_MS || 45000);
  private readonly headless =
    String(process.env.CUOTARED_HEADLESS ?? 'true').toLowerCase() === 'true';
  private readonly debug =
    String(process.env.CUOTARED_DEBUG ?? 'true').toLowerCase() === 'true';

private lastClientName: {
  firstName: string;
  lastName: string;
  fullName: string;
} | null = null;

  async consult(input: CuotaRedConsultInput): Promise<CuotaRedConsultResult> {
    if (!this.username || !this.password) {
      throw new InternalServerErrorException(
        'Faltan CUOTARED_USERNAME o CUOTARED_PASSWORD en variables de entorno.',
      );
    }

    this.lastClientName = null;

    const browser = await chromium.launch({
      headless: this.headless,
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(this.timeoutMs);

    try {
      this.logger.log(`Iniciando consulta CuotaRed para DNI ${input.dni}`);

      await this.login(page);
      await this.clickNuevaSolicitud(page);

      const target = await this.getBaseFrame(page);

      await this.stepDocumento(target, page, input.dni, input.gender);
      await this.stepCredito(target, page);
      await this.stepPreview(target, page);

      const result = await this.readResult(target, page);

      this.logger.log(
        `Consulta CuotaRed finalizada para DNI ${input.dni}. Estado: ${result.status}`,
      );

      return result;
    } catch (error: any) {
      await this.dumpDebug(page, '99-general-error').catch(() => undefined);

      this.logger.error(
        `Error consultando CuotaRed para DNI ${input.dni}: ${error?.message || error}`,
        error?.stack,
      );

      return {
        success: false,
        status: CuotaRedLeadStatus.ERROR,
        maxApprovedAmount: null,
        message:
          error?.message ||
          'No se pudo completar la consulta automática en Cuota Red.',
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
      '#txtLogin',
      'input[name="txtLogin"]',
      'input[id*="txtLogin"]',
      'input[placeholder*="Usuario"]',
      'input[name="username"]',
      'input[name="user"]',
      'input[id*="user"]',
      'input[type="text"]',
    ],
    this.username,
    'usuario',
  );

  await this.fillFirst(
    page,
    [
      '#txtPassword',
      'input[name="txtPassword"]',
      'input[id*="txtPassword"]',
      'input[placeholder*="Password"]',
      'input[name="password"]',
      'input[id*="pass"]',
      'input[type="password"]',
    ],
    this.password,
    'contraseña',
  );

  await this.dumpDebug(page, '02-login-filled');

  // 1) intento normal por botón
  const clicked = await this.tryClick(page, [
    '#btnLogin',
    'button[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Ingresar")',
    'button:has-text("Entrar")',
    'input[type="submit"]',
    'input[value*="Login"]',
    '.btn.btn-primary',
  ]);

  // 2) fallback robusto para WebForms: submit del form
  if (!clicked) {
    await page.evaluate(() => {
      const form =
        (document.querySelector('form[name="ctl01"]') as HTMLFormElement | null) ||
        (document.querySelector('form[action*="Login.aspx"]') as HTMLFormElement | null) ||
        (document.forms[0] as HTMLFormElement | undefined);

      if (!form) {
        throw new Error('No se encontró el formulario de login.');
      }

      form.submit();
    });
  }

  await page.waitForTimeout(5000);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await this.dumpDebug(page, '03-after-login-submit');
}

  private async clickNuevaSolicitud(page: Page): Promise<void> {
    await this.dumpDebug(page, '10-before-nueva-solicitud');

    const directLinkSelectors = [
      'a[href="SolicitudAltaPorPasos0.aspx"][target="basefrm"]',
      'a[href*="SolicitudAltaPorPasos0.aspx"][target="basefrm"]',
      'a.nav-link[target="basefrm"]:has(i.now-ui-icons.media-1_button-play)',
      'li.nav-item a[target="basefrm"]:has(i.now-ui-icons.media-1_button-play)',
      'a[data-original-title="nueva solicitud"]',
      'a[title="nueva solicitud"]',
      'li[tooltip="nueva solicitud"] a[target="basefrm"]',
      'i.now-ui-icons.media-1_button-play',
    ];

    for (const selector of directLinkSelectors) {
      const locator = page.locator(selector).first();

      try {
        if (await locator.count()) {
          await locator.click({ timeout: 5000 });
          await page.waitForTimeout(2500);
          await this.dumpDebug(page, '12-after-nueva-solicitud');
          return;
        }
      } catch {
        // seguir
      }
    }

    throw new Error('No se pudo hacer click en el acceso de nueva solicitud.');
  }

  private async getBaseFrame(page: Page): Promise<Frame> {
    for (let i = 0; i < 20; i++) {
      const frame = page
        .frames()
        .find((f) => /SolicitudAltaPorPasos0\.aspx/i.test(f.url()));

      if (frame) {
        this.logger.log(`Usando basefrm con URL: ${frame.url()}`);
        return frame;
      }

      await page.waitForTimeout(500);
    }

    const fallback = page
      .frames()
      .find((f) => /ClienteBusqueda\.aspx|SolicitudAltaPorPasos/i.test(f.url()));

    if (fallback) {
      this.logger.log(`Usando frame fallback: ${fallback.url()}`);
      return fallback;
    }

    throw new Error('No se encontró el iframe basefrm con la nueva solicitud.');
  }

  private async stepDocumento(
    target: Page | Frame,
    page: Page,
    dni: string,
    gender: 'M' | 'F',
  ): Promise<void> {
    await this.waitForAny(
      target,
      [
        'text=/documento/i',
        'text=/sexo/i',
        'input[placeholder*="Documento"]',
        'input[placeholder*="documento"]',
        'input[aria-label*="Documento"]',
        'input[aria-label*="documento"]',
        'input[id*="Documento"]',
        'input[id*="documento"]',
        'input[name*="Documento"]',
        'input[name*="documento"]',
        'input[id*="dni"]',
        'input[name*="dni"]',
        'input[type="text"]',
      ],
      'pantalla documento',
    );

    await this.dumpDebug(page, '20-document-step');

    await this.fillFirst(
      target,
      [
        'input[placeholder*="Documento"]',
        'input[placeholder*="documento"]',
        'input[aria-label*="Documento"]',
        'input[aria-label*="documento"]',
        'input[id*="Documento"]',
        'input[id*="documento"]',
        'input[name*="Documento"]',
        'input[name*="documento"]',
        'input[id*="dni"]',
        'input[name*="dni"]',
        'input[type="text"]',
      ],
      dni,
      'dni',
    );

    await this.selectGender(target, gender);
    await this.fillPhoneStep(target);

    const nextOk = await this.tryClick(target, [
      'button:has-text("Siguiente")',
      'button:has-text("Continuar")',
      'input[value*="Siguiente"]',
      'input[value*="Continuar"]',
      'text=/siguiente/i',
      'text=/continuar/i',
    ]);

    if (!nextOk) {
      await this.dumpDebug(page, '21-next-document-not-found');
      throw new Error(
        'No apareció ningún selector esperado para continuar desde documento.',
      );
    }

    await page.waitForTimeout(1500);
    await this.dumpDebug(page, '22-after-document-step');

    const bodyText = await target.locator('body').innerText().catch(() => '');

    if (/debe seleccionar el sexo del cliente/i.test(bodyText)) {
      await this.tryClick(target, [
        'button:has-text("OK")',
        'button:has-text("Aceptar")',
        'text=/^OK$/i',
      ]);

      throw new Error('No se pudo seleccionar correctamente el sexo del cliente.');
    }
  }

private async stepCredito(target: Page | Frame, page: Page): Promise<void> {
  await this.waitForAny(
    target,
    [
      'text=/tipo de credito/i',
      'text=/tipo de crédito/i',
      'text=/politica comercial/i',
      'text=/política comercial/i',
      'select',
    ],
    'pantalla crédito',
    8000,
  );

  await this.dumpDebug(page, '30-credit-step');

  await this.selectPolitica(target);

  const nextOk = await this.tryClick(target, [
    'button:has-text("Siguiente")',
    'button:has-text("Continuar")',
    'input[value*="Siguiente"]',
    'input[value*="Continuar"]',
    'text=/siguiente/i',
    'text=/continuar/i',
  ]);

  if (!nextOk) {
    await this.dumpDebug(page, '31-next-credit-not-found');
    throw new Error(
      'No apareció ningún selector esperado para continuar desde crédito.',
    );
  }

  await page.waitForTimeout(2500);
  await this.dumpDebug(page, '32-after-credit-step');
}

private async stepPreview(target: Page | Frame, page: Page): Promise<void> {
  await this.waitForAny(
    target,
    [
      'text=/verificacion/i',
      'text=/verificación/i',
      'text=/tipo credito/i',
      'text=/tipo crédito/i',
      'text=/articulo/i',
      'text=/artículo/i',
      'button:has-text("Siguiente")',
      'input[value*="Siguiente"]',
    ],
    'pantalla preview',
    8000,
  );

  await this.dumpDebug(page, '40-preview-step');

  this.lastClientName = await this.extractClientName(target).catch(() => ({
    firstName: '',
    lastName: '',
    fullName: '',
  }));

  const nextOk = await this.tryClick(target, [
    'button:has-text("Siguiente")',
    'input[value*="Siguiente"]',
    'text=/siguiente/i',
    'button:has-text("Confirmar")',
    'input[value*="Confirmar"]',
    'text=/confirmar/i',
  ]);

  if (!nextOk) {
    await this.dumpDebug(page, '41-preview-next-not-found');
    throw new Error(
      'No apareció ningún selector esperado para continuar desde preview.',
    );
  }

  await page.waitForTimeout(4000);
  await this.dumpDebug(page, '42-after-preview');
}

private async readResult(
  target: Page | Frame,
  page: Page,
): Promise<CuotaRedConsultResult> {
  await this.dumpDebug(page, '50-before-read-result');

const clientName =
  this.lastClientName ||
  (await this.extractClientName(target).catch(() => ({
    firstName: '',
    lastName: '',
    fullName: '',
  })));

  for (let i = 0; i < 8; i++) {
    const targetText = await target.locator('body').innerText().catch(() => '');
    const pageText = await page.locator('body').innerText().catch(() => '');

    const combinedText = `${targetText}\n${pageText}`;
    const normalized = this.normalizeText(combinedText);

    if (
      normalized.includes('NO CUMPLE CON LAS POLITICAS CREDITICIAS') ||
      normalized.includes('NO CUMPLE CON LAS POLITICAS') ||
      normalized.includes('POLITICAS CREDITICIAS')
    ) {
      await this.tryClick(page, [
        'button:has-text("OK")',
        'button:has-text("Aceptar")',
        'text=/^OK$/i',
      ]).catch(() => undefined);

      return {
        success: true,
        status: CuotaRedLeadStatus.REJECTED,
        maxApprovedAmount: null,
        message: 'El cliente no cumple con las políticas crediticias.',
        firstName: clientName.firstName,
        lastName: clientName.lastName,
        fullName: clientName.fullName,
        rawResponse: { finalScreenText: combinedText },
      } as CuotaRedConsultResult;
    }

    const amount = this.extractCurrency(combinedText);

    if (amount !== null) {
      await this.tryClick(page, [
        'button:has-text("OK")',
        'button:has-text("Aceptar")',
        'text=/^OK$/i',
      ]).catch(() => undefined);

      return {
        success: true,
        status: CuotaRedLeadStatus.APPROVED,
        maxApprovedAmount: amount,
        message: 'Cliente aprobado.',
        firstName: clientName.firstName,
        lastName: clientName.lastName,
        fullName: clientName.fullName,
        rawResponse: { finalScreenText: combinedText },
      } as CuotaRedConsultResult;
    }

    await page.waitForTimeout(1000);
  }

  const targetText = await target.locator('body').innerText().catch(() => '');
  const pageText = await page.locator('body').innerText().catch(() => '');

  throw new Error(
    `No se pudo interpretar el resultado de Cuota Red. Texto detectado: ${`${targetText}\n${pageText}`.slice(0, 1000)}`,
  );
}


private async extractClientName(target: Page | Frame): Promise<{
  firstName: string;
  lastName: string;
  fullName: string;
}> {
  const inputs = target.locator('input');
  const count = await inputs.count().catch(() => 0);

  let firstName = '';
  let lastName = '';

  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);

    try {
      const value = (await input.inputValue().catch(() => '')).trim();
      if (!value) continue;

      const placeholder = (
        (await input.getAttribute('placeholder')) || ''
      ).toUpperCase();

      const nameAttr = (
        (await input.getAttribute('name')) || ''
      ).toUpperCase();

      const ariaLabel = (
        (await input.getAttribute('aria-label')) || ''
      ).toUpperCase();

      const idAttr = (
        (await input.getAttribute('id')) || ''
      ).toUpperCase();

      const hint = `${placeholder} ${nameAttr} ${ariaLabel} ${idAttr}`;

      if (!lastName && hint.includes('APELLIDO')) {
        lastName = value;
      }

      if (!firstName && hint.includes('NOMBRE')) {
        firstName = value;
      }
    } catch {
      // seguir
    }
  }

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`.trim(),
  };
}
  private extractCurrency(text: string): number | null {
    const matches = text.match(/\$\s?[\d\.\,]+/g) || [];
    if (!matches.length) return null;

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

private normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

private async selectPolitica(target: Page | Frame): Promise<void> {
  const desired = 'MOTO - MOTOS';
  const desiredNormalized = this.normalizeText(desired);

  const selects = target.locator('select');
  const count = await selects.count().catch(() => 0);

  if (count === 0) {
    throw new Error('No se encontraron combos en la pantalla de política comercial.');
  }

  // En esta pantalla normalmente:
  // 0 = Tipo de crédito
  // 1 = Política comercial
  const candidateIndexes = count >= 2 ? [1, 0] : [0];

  for (const idx of candidateIndexes) {
    const select = selects.nth(idx);

    try {
      const disabled = await select.isDisabled().catch(() => true);
      if (disabled) continue;

      const options = await select.locator('option').allTextContents();
      const normalizedOptions = options.map((o) => this.normalizeText(o));

      const matchIndex = normalizedOptions.findIndex(
        (o) => o === desiredNormalized,
      );

      if (matchIndex === -1) {
        continue;
      }

      // 1) si ya está seleccionado, listo
      const currentValueText = await select.evaluate((el) => {
        const s = el as HTMLSelectElement;
        return s.options[s.selectedIndex]?.text || '';
      });

      if (this.normalizeText(currentValueText) === desiredNormalized) {
        return;
      }

      // 2) seleccionar por label visible
      const visibleLabel = options[matchIndex].trim();

      await select.selectOption({ label: visibleLabel }).catch(() => undefined);

      // 3) disparar eventos
      await select.dispatchEvent('input').catch(() => undefined);
      await select.dispatchEvent('change').catch(() => undefined);
      await select.dispatchEvent('blur').catch(() => undefined);

      // 4) validar leyendo selectedIndex/text del propio select
      const selectedText = await select.evaluate((el) => {
        const s = el as HTMLSelectElement;
        return s.options[s.selectedIndex]?.text || '';
      });

      if (this.normalizeText(selectedText) === desiredNormalized) {
        return;
      }

      // 5) fallback por value
      const optionValue = await select
        .locator('option')
        .nth(matchIndex)
        .getAttribute('value');

      if (optionValue !== null) {
        await select.selectOption({ value: optionValue }).catch(() => undefined);
        await select.dispatchEvent('input').catch(() => undefined);
        await select.dispatchEvent('change').catch(() => undefined);
        await select.dispatchEvent('blur').catch(() => undefined);

        const selectedTextByValue = await select.evaluate((el) => {
          const s = el as HTMLSelectElement;
          return s.options[s.selectedIndex]?.text || '';
        });

        if (this.normalizeText(selectedTextByValue) === desiredNormalized) {
          return;
        }
      }

      // 6) fallback extremo
      const ok = await select.evaluate(
        (el, expected) => {
          const normalize = (v: string) =>
            String(v || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .toUpperCase();

          const s = el as HTMLSelectElement;
          const option = Array.from(s.options).find(
            (opt) => normalize(opt.text) === expected,
          );

          if (!option) return false;

          s.value = option.value;
          s.dispatchEvent(new Event('input', { bubbles: true }));
          s.dispatchEvent(new Event('change', { bubbles: true }));
          s.dispatchEvent(new Event('blur', { bubbles: true }));

          const selected = s.options[s.selectedIndex]?.text || '';
          return normalize(selected) === expected;
        },
        desiredNormalized,
      );

      if (ok) {
        return;
      }
    } catch {
      // probar siguiente candidato
    }
  }

  throw new Error('No se pudo seleccionar política comercial "MOTO - MOTOS".');
}

  private async selectGender(
    target: Page | Frame,
    gender: 'M' | 'F',
  ): Promise<void> {
    const expected = gender === 'M' ? 'MASCULINO' : 'FEMENINO';
    const selects = target.locator('select');
    const count = await selects.count().catch(() => 0);

    for (let i = 0; i < count; i++) {
      const select = selects.nth(i);

      try {
        const disabled = await select.isDisabled().catch(() => true);
        if (disabled) continue;

        const options = await select.locator('option').allTextContents();
        const normalizedOptions = options.map((o) => (o || '').trim().toUpperCase());

        if (!normalizedOptions.includes(expected)) continue;

        await select.selectOption({ label: expected }).catch(() => undefined);

        let selectedText = await select
          .locator('option:checked')
          .textContent()
          .catch(() => '');

        if ((selectedText || '').trim().toUpperCase() !== expected) {
          const optionHandles = await select.locator('option').elementHandles();

          for (const optionHandle of optionHandles) {
            const text = (
              await optionHandle.evaluate((el) => (el.textContent || '').trim())
            ).toUpperCase();

            if (text === expected) {
              const value = await optionHandle.evaluate(
                (el) => (el as HTMLOptionElement).value,
              );

              await select.selectOption({ value }).catch(() => undefined);
              break;
            }
          }

          selectedText = await select
            .locator('option:checked')
            .textContent()
            .catch(() => '');
        }

        await select.dispatchEvent('input').catch(() => undefined);
        await select.dispatchEvent('change').catch(() => undefined);
        await select.dispatchEvent('blur').catch(() => undefined);

        if ((selectedText || '').trim().toUpperCase() === expected) {
          return;
        }
      } catch {
        // seguir
      }
    }

    throw new Error(`No se pudo seleccionar el género ${gender}.`);
  }

  private async tryClick(
    target: Page | Frame,
    selectors: string[],
  ): Promise<boolean> {
    for (const selector of selectors) {
      const locator = target.locator(selector).first();

      try {
        const count = await locator.count();
        if (!count) continue;

        await locator.click({ timeout: 3000 });
        return true;
      } catch {
        // sigue
      }
    }

    return false;
  }

  private normalizeDigits(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private async fillFirst(
    target: Page | Frame,
    selectors: string[],
    value: string,
    fieldLabel = 'campo',
  ): Promise<void> {
    for (const selector of selectors) {
      const locator = target.locator(selector).first();

      try {
        const count = await locator.count();
        if (!count) continue;

        await locator.waitFor({ state: 'visible', timeout: 2000 }).catch(() => undefined);
        await locator.click({ timeout: 2000 }).catch(() => undefined);

        await locator.fill(value, { timeout: 3000 }).catch(async () => {
          await locator.press('Control+A').catch(() => undefined);
          await locator.type(value, { delay: 40 }).catch(() => undefined);
        });

        const currentValue = await locator.inputValue().catch(() => '');

        const ok =
          fieldLabel === 'dni'
            ? this.normalizeDigits(currentValue) === this.normalizeDigits(value)
            : currentValue === value;

        if (ok) {
          return;
        }
      } catch {
        // sigue
      }
    }

    const allInputs = target.locator('input');
    const totalInputs = await allInputs.count().catch(() => 0);

    for (let i = 0; i < totalInputs; i++) {
      const locator = allInputs.nth(i);

      try {
        const type = (await locator.getAttribute('type')) || 'text';
        const disabled = await locator.isDisabled().catch(() => true);
        const readonly = (await locator.getAttribute('readonly')) !== null;

        if (disabled || readonly) continue;
        if (['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(type)) continue;

        await locator.waitFor({ state: 'visible', timeout: 1000 }).catch(() => undefined);
        await locator.click({ timeout: 1000 }).catch(() => undefined);

        await locator.fill(value, { timeout: 2000 }).catch(async () => {
          await locator.press('Control+A').catch(() => undefined);
          await locator.type(value, { delay: 40 }).catch(() => undefined);
        });

        const currentValue = await locator.inputValue().catch(() => '');
        const ok =
          fieldLabel === 'dni'
            ? this.normalizeDigits(currentValue) === this.normalizeDigits(value)
            : currentValue === value;

        if (ok) {
          return;
        }
      } catch {
        // sigue
      }
    }

    const inputs = await target
      .locator('input')
      .evaluateAll((elements) =>
        elements.map((el) => ({
          type: el.getAttribute('type'),
          name: el.getAttribute('name'),
          id: el.getAttribute('id'),
          placeholder: el.getAttribute('placeholder'),
          autocomplete: el.getAttribute('autocomplete'),
          ariaLabel: el.getAttribute('aria-label'),
          value: (el as HTMLInputElement).value,
          readonly: el.hasAttribute('readonly'),
          disabled: (el as HTMLInputElement).disabled,
        })),
      )
      .catch(() => []);

    this.logger.error(
      `No se encontró un campo para completar ${fieldLabel}. Inputs detectados: ${JSON.stringify(inputs)}`,
    );

    throw new Error(`No se encontró un campo para completar ${fieldLabel}: ${value}`);
  }

  private async clickFirst(
    target: Page | Frame,
    selectors: string[],
  ): Promise<void> {
    const ok = await this.tryClick(target, selectors);

    if (!ok) {
      throw new Error(
        `No se encontró ningún botón/acción compatible. Selectores probados: ${selectors.join(' | ')}`,
      );
    }
  }

  private async waitForAny(
    target: Page | Frame,
    selectors: string[],
    stepLabel = 'pantalla',
    timeout = 6000,
  ): Promise<void> {
    for (const selector of selectors) {
      try {
        await target.locator(selector).first().waitFor({
          state: 'visible',
          timeout,
        });
        return;
      } catch {
        // sigue
      }
    }

    throw new Error(`No apareció ningún selector esperado en ${stepLabel}.`);
  }

private async fillPhoneStep(target: Page | Frame): Promise<void> {
  // 1) buscar el contenedor visual de "Teléfono"
  const phoneContainers = [
    'label:has-text("Teléfono")',
    'text=/^Teléfono$/i',
    'div:has-text("Teléfono")',
  ];

  for (const selector of phoneContainers) {
    try {
      const label = target.locator(selector).first();
      if (!(await label.count())) continue;

      // subimos al contenedor más cercano y buscamos inputs dentro de esa zona
      const container = label.locator('xpath=ancestor::div[1]');
      const inputs = container.locator('input');

      const count = await inputs.count().catch(() => 0);

      if (count >= 3) {
        const values = ['11', '9999', '9999'];

        for (let i = 0; i < 3; i++) {
          const input = inputs.nth(i);
          await input.click().catch(() => undefined);
          await input.fill(values[i]).catch(async () => {
            await input.press('Control+A').catch(() => undefined);
            await input.type(values[i], { delay: 30 }).catch(() => undefined);
          });
        }

        // validar
        const v0 = await inputs.nth(0).inputValue().catch(() => '');
        const v1 = await inputs.nth(1).inputValue().catch(() => '');
        const v2 = await inputs.nth(2).inputValue().catch(() => '');

        if (v0 === '11' && v1 === '9999' && v2 === '9999') {
          return;
        }
      }
    } catch {
      // seguir
    }
  }

  // 2) fallback: buscar grupos de exactamente 3 inputs consecutivos visibles
  const allInputs = target.locator('input');
  const count = await allInputs.count().catch(() => 0);

  const editableIndexes: number[] = [];

  for (let i = 0; i < count; i++) {
    const el = allInputs.nth(i);

    try {
      const disabled = await el.isDisabled().catch(() => true);
      const readonly = (await el.getAttribute('readonly')) !== null;
      const type = (await el.getAttribute('type')) || 'text';

      if (disabled || readonly) continue;
      if (['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(type)) continue;

      await el.waitFor({ state: 'visible', timeout: 500 }).catch(() => undefined);

      editableIndexes.push(i);
    } catch {
      // seguir
    }
  }

  for (let start = 0; start <= editableIndexes.length - 3; start++) {
    const trio = editableIndexes.slice(start, start + 3);
    const values = ['11', '9999', '9999'];

    let ok = true;

    for (let j = 0; j < 3; j++) {
      const input = allInputs.nth(trio[j]);

      try {
        await input.click().catch(() => undefined);
        await input.fill(values[j]).catch(async () => {
          await input.press('Control+A').catch(() => undefined);
          await input.type(values[j], { delay: 30 }).catch(() => undefined);
        });
      } catch {
        ok = false;
        break;
      }
    }

    if (!ok) continue;

    const v0 = await allInputs.nth(trio[0]).inputValue().catch(() => '');
    const v1 = await allInputs.nth(trio[1]).inputValue().catch(() => '');
    const v2 = await allInputs.nth(trio[2]).inputValue().catch(() => '');

    if (v0 === '11' && v1 === '9999' && v2 === '9999') {
      return;
    }
  }

  throw new Error('No se pudo completar correctamente el teléfono.');
}
  private async dumpDebug(page: Page, label: string): Promise<void> {
    if (!this.debug) return;

    try {
      const fs = await import('fs');
      const path = await import('path');

      const dir = path.join(process.cwd(), 'tmp', 'cuotared-debug');
      fs.mkdirSync(dir, { recursive: true });

      const safeLabel = label.replace(/[^a-zA-Z0-9-_]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      const screenshotPath = path.join(dir, `${timestamp}-${safeLabel}.png`);
      const htmlPath = path.join(dir, `${timestamp}-${safeLabel}.html`);

      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => undefined);

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