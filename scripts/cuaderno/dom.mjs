// Functions in this file execute inside the official browser page through CDP.
export function inspectPortal() {
    const url = new URL(location.href);
    // RENIEC's security page (ID Perú / 2FA) blocks automated access from some networks,
    // e.g. datacenter IPs. It must never be bypassed: stop and tell the holder.
    const pageText = document.body?.innerText ?? '';
    if (/actividad no autorizada ha sido detectada/i.test(pageText)) {
        const caseNumber = pageText.match(/n[uú]mero de caso:?\s*(\d+)/i)?.[1];
        return {
            state: 'login',
            blocked: true,
            message: `RENIEC bloqueó el ingreso automático desde este equipo${caseNumber ? ` (caso ${caseNumber})` : ''}. No reintentes desde aquí; usa el conector en tu computadora.`,
        };
    }
    if (
        url.origin !== 'https://apps.oece.gob.pe' ||
        !url.pathname.startsWith('/cuaderno-obra/')
    ) {
        return {
            state: 'intervention',
            message:
                'Completa la autenticación oficial en el navegador del conector.',
        };
    }
    const text = document.body.innerText;
    // The portal keeps the page but shows "Tu sesión ha expirado" when its token ends.
    const expired = [
        ...document.querySelectorAll('.modal-content, mat-dialog-container'),
    ].some(
        (element) =>
            element.getClientRects().length &&
            /sesi[oó]n ha expirado/i.test(element.innerText),
    );
    if (expired) {
        return {
            state: 'login',
            message: 'La sesión de OECE expiró. Vuelve a conectar tu cuenta.',
        };
    }
    if (document.querySelector('input[formcontrolname="clave"]')) {
        // Official validation text (wrong password, locked account…), when present.
        const notice = [
            ...document.querySelectorAll(
                'mat-error, .mat-error, .alert, .text-danger, simple-snack-bar, .mat-mdc-snack-bar-label, .swal2-html-container, .p-toast-detail',
            ),
        ]
            .map((element) => element.innerText.trim())
            .find(Boolean);
        return {
            state: 'login',
            message: notice?.slice(0, 300) ?? null,
        };
    }
    if (url.pathname.includes('terminos-y-condiciones')) {
        return {
            state: 'intervention',
            message:
                'Lee y acepta los términos oficiales en el navegador del conector.',
        };
    }
    if (url.pathname.includes('seleccionar-login')) {
        const choices = [
            ...document.querySelectorAll('input[type="radio"]'),
        ].map((radio, index) => {
            let container = radio.parentElement;
            while (
                container?.parentElement &&
                (container.innerText.trim().length < 40 ||
                    container.querySelectorAll('input[type="radio"]').length !==
                        1)
            ) {
                container = container.parentElement;
            }
            return {
                index,
                label: container?.innerText.trim().slice(0, 4000) ?? '',
            };
        });
        return { state: 'selection', choices };
    }
    const identity = {};
    for (const row of document.querySelectorAll(
        'utils-info-row, .utils-info-row',
    )) {
        const label = row
            .querySelector('section-label, .section-label')
            ?.innerText.trim();
        const value = row
            .querySelector('section-value, .section-value')
            ?.innerText.trim();
        if (/Entidad contratante/i.test(label ?? '')) identity.entidad = value;
        if (/^Obra/i.test(label ?? '')) identity.obra = value;
    }
    identity.codigo_cui =
        identity.obra?.match(/CUI\s*(?:N[°ºo.]*)?\s*(\d{7})/i)?.[1] ?? null;
    const rows = [...document.querySelectorAll('tr.mat-row, mat-row')]
        .map((row) => {
            const read = (name) =>
                row.querySelector(`.mat-column-${name}`)?.innerText.trim() ??
                '';
            return {
                numero: read('num'),
                titulo: read('titulo'),
                tipo: read('tipo'),
                fecha_oficial: read('fecha'),
                usuario: read('usuario'),
                rol: read('rol'),
                estado: read('estado'),
            };
        })
        .filter((row) => /^\d+$/.test(row.numero));
    const total = text.match(/Lista total de asientos:\s*(\d[\d, .]*)/i)?.[1];
    if (
        url.pathname.endsWith('/bandeja-asientos') &&
        identity.entidad &&
        identity.obra &&
        total !== undefined
    ) {
        return {
            state: 'ready',
            identity,
            rows,
            total: Number(total.replace(/\D/g, '')),
        };
    }
    // A restored inbox with an expired token keeps the header but never loads the list
    // ("Lista total de asientos:" without a number and no filter form).
    if (url.pathname.endsWith('/bandeja-asientos') && identity.entidad) {
        return {
            state: 'intervention',
            authenticated: true,
            stale: true,
            message: 'La bandeja de OECE no cargó.',
        };
    }
    // After 2FA the portal lands on /bandeja, whose menu links to "Lista de asientos".
    // 2FA screens show a code input instead.
    const codeInput = document.querySelector(
        'input[autocomplete="one-time-code"], input[formcontrolname*="codigo" i], input[formcontrolname*="otp" i], input[maxlength="6"]',
    );
    const loggedIn =
        url.pathname.endsWith('/bandeja') ||
        Boolean(document.querySelector('a[href$="/bandeja-asientos"]')) ||
        /cerrar sesi[oó]n/i.test(text);
    return {
        state: 'intervention',
        authenticated: loggedIn && !codeInput,
        message:
            'Completa el segundo factor o la selección del cuaderno en el navegador del conector.',
    };
}

// Structural outline of the current page, used to map detail/PDF/registration screens.
export function outlinePortal() {
    if (location.origin !== 'https://apps.oece.gob.pe') return null;
    const clip = (value, size = 120) =>
        (value ?? '').replace(/\s+/g, ' ').trim().slice(0, size) || undefined;
    const attributes =
        /^(formcontrolname|name|type|role|aria-label|placeholder|href|routerlink|mattooltip|title|maxlength|accept|multiple|disabled|download|target)$/i;
    const describe = (element) => ({
        tag: element.tagName.toLowerCase(),
        id: element.id || undefined,
        classes: clip(
            typeof element.className === 'string' ? element.className : '',
            200,
        ),
        attrs: Object.fromEntries(
            [...element.attributes]
                .filter((attribute) => attributes.test(attribute.name))
                .map((attribute) => [
                    attribute.name,
                    clip(attribute.value, 200),
                ]),
        ),
        // Input values are never captured; only visible labels and button texts.
        text: ['input', 'textarea', 'select'].includes(
            element.tagName.toLowerCase(),
        )
            ? clip(
                  element.labels?.[0]?.innerText ??
                      element
                          .closest('mat-form-field')
                          ?.querySelector('mat-label')?.innerText,
              )
            : clip(element.innerText),
    });
    const columns = new Set();
    for (const cell of document.querySelectorAll('[class*="mat-column-"]')) {
        for (const name of cell.classList) {
            if (name.startsWith('mat-column-')) columns.add(name);
        }
    }
    return {
        path: location.pathname + location.search,
        title: clip(document.title),
        headings: [
            ...document.querySelectorAll(
                'h1, h2, h3, h4, mat-card-title, .mat-card-title, mat-dialog-title, .modal-title',
            ),
        ]
            .map((element) => clip(element.innerText))
            .filter(Boolean)
            .slice(0, 60),
        controls: [
            ...document.querySelectorAll(
                'input, textarea, select, mat-select, button, a, [role="button"], [role="tab"], mat-checkbox, mat-radio-button, iframe, embed, object',
            ),
        ]
            .filter((element) => element.getClientRects().length)
            .slice(0, 400)
            .map(describe),
        infoRows: [
            ...document.querySelectorAll('utils-info-row, .utils-info-row'),
        ]
            .map((row) =>
                clip(
                    row.querySelector('section-label, .section-label')
                        ?.innerText,
                ),
            )
            .filter(Boolean),
        table: {
            columns: [...columns],
            headers: [...document.querySelectorAll('th, mat-header-cell')]
                .map((element) => clip(element.innerText))
                .filter(Boolean),
            rows: document.querySelectorAll('tr.mat-row, mat-row').length,
            firstRowActions: [
                ...(document
                    .querySelector('tr.mat-row, mat-row')
                    ?.querySelectorAll('button, a, mat-icon') ?? []),
            ].map(describe),
        },
        dialogs: document.querySelectorAll(
            'mat-dialog-container, .cdk-overlay-pane, .modal.show',
        ).length,
    };
}

export function fillLogin({ usuario, password }) {
    if (
        location.origin !== 'https://apps.oece.gob.pe' ||
        !location.pathname.endsWith('/login')
    )
        return false;
    const userInput = document.querySelector(
        'input[formcontrolname="usuario"]',
    );
    const passwordInput = document.querySelector(
        'input[formcontrolname="clave"]',
    );
    if (!userInput || !passwordInput) return false;
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    ).set;
    for (const [input, value] of [
        [userInput, usuario],
        [passwordInput, password],
    ]) {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const radios = [...document.querySelectorAll('input[type="radio"]')];
    if (radios.length !== 2) return false;
    radios[1].click();
    const button = [...document.querySelectorAll('button')].find((item) =>
        /^Ingresar$/i.test(item.innerText.trim()),
    );
    if (!button || button.disabled) return false;
    button.click();
    return true;
}

export function selectNotebook({ index, label }) {
    if (
        location.origin !== 'https://apps.oece.gob.pe' ||
        !location.pathname.includes('seleccionar-login')
    )
        return false;
    const radio = [...document.querySelectorAll('input[type="radio"]')][index];
    if (!radio) return false;
    let container = radio.parentElement;
    while (
        container?.parentElement &&
        (container.innerText.trim().length < 40 ||
            container.querySelectorAll('input[type="radio"]').length !== 1)
    )
        container = container.parentElement;
    if (container?.innerText.trim().slice(0, 4000) !== label) return false;
    const button = [...document.querySelectorAll('button')].find((item) =>
        /^Siguiente$/i.test(item.innerText.trim()),
    );
    radio.click();
    if (!button || button.disabled) return false;
    button.click();
    return true;
}

export function changePage(direction) {
    if (
        location.origin !== 'https://apps.oece.gob.pe' ||
        !location.pathname.endsWith('/bandeja-asientos')
    )
        return false;
    const patterns =
        direction === 'next'
            ? /^(?:chevron_right|keyboard_arrow_right|navigate_next|siguiente|next page)$/i
            : /^(?:chevron_left|keyboard_arrow_left|navigate_before|anterior|previous page)$/i;
    const button = [...document.querySelectorAll('button, .pagination a')].find(
        (item) =>
            patterns.test(
                (item.getAttribute('aria-label') || item.innerText).trim(),
            ) &&
            !item.disabled &&
            item.getAttribute('aria-disabled') !== 'true' &&
            !item.closest('.disabled') &&
            item.getClientRects().length,
    );
    if (!button) return false;
    button.click();
    return true;
}

// Row actions of the official inbox (icons observed on 2026-10-06):
// fa-eye = "Ver detalle", fa-file-pdf = PDF, fa-paperclip = attachments.
export function clickRowAction({ numero, icon }) {
    if (
        location.origin !== 'https://apps.oece.gob.pe' ||
        !location.pathname.endsWith('/bandeja-asientos')
    )
        return false;
    const row = [...document.querySelectorAll('mat-row, tr.mat-row')].find(
        (item) =>
            item.querySelector('.mat-column-num')?.innerText.trim() ===
            String(numero),
    );
    const button = row?.querySelector(`.${icon}`)?.closest('button');
    if (!button) return false;
    button.click();
    return true;
}

// Official detail page: /operaciones/detalle-asiento/{uuid}, values in utils-info-row.
export function readDetail() {
    if (location.origin !== 'https://apps.oece.gob.pe') return null;
    const match = location.pathname.match(
        /\/detalle-asiento\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    if (!match) return null;
    const values = {};
    for (const row of document.querySelectorAll(
        'utils-info-row, .utils-info-row',
    )) {
        const label = row
            .querySelector('section-label, .section-label')
            ?.innerText.trim()
            .replace(/:$/, '');
        if (label)
            values[label] =
                row
                    .querySelector('section-value, .section-value')
                    ?.innerText.trim() ?? '';
    }
    if (!values['Título']) return null;
    return { external_id: match[1].toLowerCase(), values };
}

// Official "Cambiar a otra obra" link: returns to the notebook selection screen.
export function followSwitchLink() {
    if (location.origin !== 'https://apps.oece.gob.pe') return false;
    const link = document.querySelector('a[href$="/seleccionar-login"]');
    if (!link) return false;
    link.click();
    return true;
}

export function clickNewEntry() {
    if (location.origin !== 'https://apps.oece.gob.pe') return false;
    const button = [...document.querySelectorAll('button')].find((item) =>
        /^Nuevo asiento$/i.test(item.innerText.trim()),
    );
    if (!button) return false;
    button.click();
    return true;
}

// Uses the portal's own "Lista de asientos" link so Angular keeps the selected notebook.
export function followInboxLink() {
    if (location.origin !== 'https://apps.oece.gob.pe') return false;
    const link = document.querySelector('a[href$="/bandeja-asientos"]');
    if (!link) return false;
    link.click();
    return true;
}

export function clearFilters() {
    if (
        location.origin !== 'https://apps.oece.gob.pe' ||
        !location.pathname.endsWith('/bandeja-asientos')
    )
        return false;
    const button = [...document.querySelectorAll('button')].find((item) =>
        /^Limpiar$/i.test(item.innerText.trim()),
    );
    if (button) button.click();
    return Boolean(button);
}

// Lists the visible fields and buttons of the current official screen so Costos can
// render them as its own form (2FA code, terms, trusted device…). Text values are not read.
export function describeScreen() {
    if (location.origin !== 'https://apps.oece.gob.pe') {
        return { path: null, text: '', fields: [] };
    }
    const clip = (value, size = 160) =>
        (value ?? '').replace(/\s+/g, ' ').trim().slice(0, size);
    const shown = (element) =>
        Boolean(
            (
                element.closest('mat-checkbox, mat-radio-button, label') ??
                element
            ).getClientRects().length,
        ) && getComputedStyle(element).visibility !== 'hidden';
    for (const element of document.querySelectorAll('[data-costos-ref]')) {
        element.removeAttribute('data-costos-ref');
    }
    const dialog = document.querySelector('mat-dialog-container, .modal.show');
    const scope = dialog ?? document;
    const fields = [];
    for (const element of scope.querySelectorAll(
        'input, textarea, select, button',
    )) {
        if (fields.length >= 60 || !shown(element)) continue;
        const tag = element.tagName.toLowerCase();
        const type = (element.getAttribute('type') || 'text').toLowerCase();
        if (
            tag === 'input' &&
            ['hidden', 'file', 'submit', 'image'].includes(type)
        )
            continue;
        const label = clip(
            tag === 'button'
                ? element.innerText || element.getAttribute('aria-label')
                : element.labels?.[0]?.innerText ||
                      element
                          .closest('mat-form-field')
                          ?.querySelector('mat-label, label')?.innerText ||
                      element.closest('mat-checkbox, mat-radio-button, label')
                          ?.innerText ||
                      element.getAttribute('aria-label') ||
                      element.getAttribute('placeholder') ||
                      element.getAttribute('formcontrolname') ||
                      element.name,
        );
        // Icon-only menu buttons are not useful as form actions.
        if (tag === 'button' && (!label || /^(menu|close)$/i.test(label)))
            continue;
        const ref = fields.length + 1;
        element.setAttribute('data-costos-ref', String(ref));
        fields.push({
            ref,
            kind:
                tag === 'button'
                    ? 'button'
                    : tag === 'select'
                      ? 'select'
                      : tag === 'textarea'
                        ? 'text'
                        : ['checkbox', 'radio'].includes(type)
                          ? type
                          : type === 'password'
                            ? 'password'
                            : 'text',
            label,
            inputType: tag === 'input' ? type : null,
            maxLength: element.maxLength > 0 ? element.maxLength : null,
            required: Boolean(element.required),
            checked: ['checkbox', 'radio'].includes(type)
                ? element.checked
                : null,
            options:
                tag === 'select'
                    ? [...element.options].map((option) => ({
                          value: option.value,
                          label: clip(option.text, 120),
                      }))
                    : null,
        });
    }
    const textSource =
        dialog ??
        document.querySelector('form')?.closest('mat-card, .card, main') ??
        document.querySelector('main, mat-card') ??
        document.body;
    return {
        path: location.pathname,
        text: clip(textSource.innerText, 1500),
        fields,
    };
}

export async function applyScreen({ fields, submit }) {
    if (location.origin !== 'https://apps.oece.gob.pe') return 'screen_changed';
    const find = (ref) => document.querySelector(`[data-costos-ref="${ref}"]`);
    for (const field of fields) {
        const element = find(field.ref);
        if (!element) return 'screen_changed';
        const type = (element.getAttribute('type') || '').toLowerCase();
        if (['checkbox', 'radio'].includes(type)) {
            if (element.checked !== Boolean(field.checked)) element.click();
            continue;
        }
        const prototype =
            element.tagName === 'TEXTAREA'
                ? HTMLTextAreaElement.prototype
                : element.tagName === 'SELECT'
                  ? HTMLSelectElement.prototype
                  : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(
            element,
            field.value ?? '',
        );
        for (const name of ['input', 'change', 'blur']) {
            element.dispatchEvent(new Event(name, { bubbles: true }));
        }
    }
    if (submit) {
        // Let Angular run change detection so the button enables after the new values.
        await new Promise((resolve) => setTimeout(resolve, 300));
        const button = find(submit);
        if (!button) return 'screen_changed';
        if (button.disabled) return 'submit_disabled';
        button.click();
    }
    return 'ok';
}
