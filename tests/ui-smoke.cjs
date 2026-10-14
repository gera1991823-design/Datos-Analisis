/* Exercise the real app scripts with isolated Firebase/Storage fixtures.
   No Firebase request is allowed to reach the network. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
fs.mkdirSync(output, { recursive: true });
const files = ['index.html', 'reservas.html', 'carpetas.html', 'Reclamos.html',
  'Solicitudes MD.html', 'Analisis de surtido.html', 'actualizar carpetas.html'];
const fixture = fs.readFileSync(path.join(__dirname, 'firebase-fixture.mjs'), 'utf8');
const result = { mode: 'isolated fixtures; no live Firebase', viewports: [], flows: [], baselineIssues: [] };
const slug = name => name.replace(/\.html$/, '').replace(/[^a-zA-Z0-9]/g, '-');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
});

async function installRoutes(context) {
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:')) return route.continue();
    let body = '', contentType = 'text/javascript';
    if (/www\.gstatic\.com\/firebasejs\/.+\/firebase-/.test(url)) body = fixture;
    else if (/xlsx\.full\.min\.js/.test(url)) body = fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'));
    else if (/flatpickr\.min\.js/.test(url)) body = fs.readFileSync(require.resolve('flatpickr/dist/flatpickr.min.js'));
    else if (/flatpickr.*l10n\/es\.js/.test(url)) body = fs.readFileSync(require.resolve('flatpickr/dist/l10n/es.js'));
    else if (/flatpickr\.min\.css/.test(url)) { contentType = 'text/css'; body = fs.readFileSync(require.resolve('flatpickr/dist/flatpickr.min.css')); }
    else if (/fonts\.googleapis/.test(url)) contentType = 'text/css';
    else if (/tesseract/.test(url)) body = 'window.Tesseract = {};';
    // All other external calls, including Firebase REST/Storage, are blocked.
    await route.fulfill({ status: 200, contentType, body });
  });
}
async function load(page, base, file) {
  await page.goto(base + encodeURIComponent(file), { waitUntil: 'networkidle' });
  if (file !== 'index.html' && file !== 'actualizar carpetas.html') await page.locator('#tbody tr[data-id]').first().waitFor();
  if (file === 'actualizar carpetas.html') await page.waitForFunction(() => !document.getElementById('dbStatus').textContent.includes('Conectando'));
}
async function count(page) { return page.locator('#tbody tr[data-id]').count(); }
async function exportFile(page, button, file) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator(button).click();
  const download = await downloadPromise;
  const target = path.join(output, slug(file) + '.xlsx');
  await download.saveAs(target);
  const book = XLSX.readFile(target);
  assert(book.SheetNames.length > 0);
  assert(XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]]).length > 0, file + ' empty export');
}
async function waitWrite(page, name) {
  await page.waitForFunction(name => window.__writes.some(w => w.kind === 'update' && w.name === name), name);
}
function workbookBuffer(rows) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Datos');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}
async function uploadViaButton(page, button, payload) {
  const pending = page.waitForEvent('filechooser');
  await button.click();
  await (await pending).setFiles(payload);
}
async function additionalFlows(page, file) {
  if (file === 'carpetas.html') {
    await page.locator('#fDivision').selectOption('AGRO');
    assert.equal(await count(page), 1);
    await page.locator('#clearFiltersBtn').click();
    await page.locator('#fFechaRange').fill('01/01/2020 - 31/01/2020');
    assert.equal(await count(page), 0);
    await page.locator('#clearFiltersBtn').click();
    await page.locator('#notifBell').click();
    assert(await page.locator('#notifPanel').isVisible());
    await page.locator('#notifCloseBtn').click();
    const row = page.locator('#tbody tr[data-id="fixture-1"]');
    await uploadViaButton(page, row.locator('[data-action="uppacking"]'), {
      name: 'packing.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: workbookBuffer([{ PartNumber: 'RE68316', Quantidade: 2 }]) });
    await row.locator('[data-action="delpacking"]').waitFor();
    assert(await page.evaluate(() => window.__uploads.some(u => u.name === 'packing.xlsx')));
    await uploadViaButton(page, row.locator('[data-action="upatts"]'), {
      name: 'DUA-prueba.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nfixture') });
    await row.locator('[data-action="delatt"]').waitFor();
    assert(await page.evaluate(() => window.__uploads.some(u => u.name === 'DUA-prueba.pdf')));
    await row.locator('[data-action="delatt"]').click();
    await row.locator('[data-action="delatt"]').waitFor({ state: 'detached' });
    await row.locator('[data-action="delpacking"]').click();
    await row.locator('[data-action="delpacking"]').waitFor({ state: 'detached' });
    await page.locator('#factura').fill('987654');
    await page.locator('#carpeta').fill('00555_2026');
    await page.locator('#addBtn').click();
    await page.waitForFunction(() => window.__writes.some(w => w.kind === 'add' && w.name === 'rows' && w.row.factura === '987654'));
    result.flows.push({ file, checks: 'division/date filters, notifications panel, packing and PDF upload/delete, create, audit', result: 'PASS' });
  } else if (file === 'Reclamos.html') {
    await uploadViaButton(page, page.locator('#importBtn'), {
      name: 'reclamos.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: workbookBuffer([{ Material: 'RE-IMPORTADO', Cantidad: 3, Factura: '987654', 'Fecha de reclamo': '14/10/2026' }]) });
    await page.waitForFunction(() => window.__writes.some(w => w.kind === 'add' && w.name === 'reclamos' && w.row.material === 'RE-IMPORTADO'));
    await page.locator('#material').fill('RE-NUEVO');
    await page.locator('#addBtn').click();
    await page.waitForFunction(() => window.__writes.some(w => w.kind === 'add' && w.name === 'reclamos' && w.row.material === 'RE-NUEVO'));
    result.flows.push({ file, checks: 'XLSX import with date/header mapping and create', result: 'PASS' });
  } else if (file === 'Solicitudes MD.html') {
    await page.locator('#a_material').fill('RE-NUEVO');
    await page.locator('#a_centro').selectOption('S004');
    await page.locator('#a_sucursal_nombre').selectOption({ index: 1 });
    await page.locator('#a_nombre').selectOption({ index: 1 });
    assert((await page.locator('#a_responsable').inputValue()).length > 0);
    await page.locator('#addBtn').click();
    await page.waitForFunction(() => window.__writes.some(w => w.kind === 'add' && w.name === 'solicitudes' && w.row.material === 'RE-NUEVO'));
    result.flows.push({ file, checks: 'dependent centro/sucursal/nombre/responsable and create', result: 'PASS' });
  } else if (file === 'reservas.html') {
    await page.locator('a[data-section="cumplidas"]').click();
    assert.equal(await count(page), 1);
    assert((await page.locator('#tbody').textContent()).includes('AA58675'));
    await page.locator('a[data-section="pendientes"]').click();
    await page.locator('#material').fill('RE-NUEVO');
    await page.locator('#addBtn').click();
    await page.waitForFunction(() => window.__writes.some(w => w.kind === 'add' && w.name === 'reservas' && w.row.material === 'RE-NUEVO'));
    result.flows.push({ file, checks: 'pending/fulfilled navigation and create', result: 'PASS' });
  }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true,
    ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  try {
    for (const width of [1440, 1024, 768, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, acceptDownloads: true,
        locale: 'es-UY', reducedMotion: 'reduce' });
      await installRoutes(context);
      for (const file of files) {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => d.accept());
        await load(page, base, file);
        assert.deepEqual(errors, [], file + ' JS errors');
        const overflow = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert(overflow.scroll <= overflow.width + 2, `${file} overflow at ${width}: ${JSON.stringify(overflow)}`);
        // Every tool has a visible route to Inicio, including on mobile.
        if (file !== 'index.html') {
          const drawer = (file === 'carpetas.html' && width <= 1050) || (file === 'reservas.html' && width <= 980);
          if (drawer) await page.locator('#menuToggle').click();
          const links = page.locator('a[href="index.html"]');
          assert(await links.evaluateAll(items => items.some(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth;
          })), `${file} Inicio inaccessible at ${width}`);
          if (drawer) {
            await page.mouse.click(width - 20, 800);
            assert(!(await page.locator('body').getAttribute('class')).includes('mobileOpen'));
          }
        }
        if (file === 'index.html') {
          await page.locator('#appSearch').fill('GESTIÓN');
          assert.equal(await page.locator('.app-card:not([hidden])').count(), 1);
          await page.locator('#appSearch').fill('xxxx-no-existe');
          assert(await page.locator('#emptyState').isVisible());
          await page.locator('#appSearch').fill('');
          assert.equal(await page.locator('.app-card:not([hidden])').count(), 6);
        }
        await page.screenshot({ path: path.join(output, `${slug(file)}-${width}.png`), fullPage: true });
        result.viewports.push({ file, width, result: 'PASS' });
        if (width === 1440 && file !== 'index.html') {
          if (file === 'actualizar carpetas.html') {
            await page.locator('#facturas').fill('123456 | AGRO\n999999 | CONS');
            await page.locator('#carpeta').fill('00999_2026');
            await page.locator('#transporte').fill('VIA AEREA');
            await page.locator('#fecha').fill('2026-10-20');
            await page.locator('#searchBtn').click();
            await page.locator('#tbody tr.found').first().waitFor();
            assert.equal(await page.locator('#tbody tr.missing').count(), 1);
            await page.locator('#updateBtn').click();
            await waitWrite(page, 'rows');
            const write = await page.evaluate(() => window.__writes.find(w => w.kind === 'update' && w.name === 'rows'));
            assert.equal(write.row.carpeta, '00999_2026');
            assert.equal(write.row.transporte, 'VIA AEREA');
            result.flows.push({ file, checks: 'invoice match/missing, manual data, selective update, audit', result: 'PASS' });
          } else {
            const filter = file === 'Analisis de surtido.html' ? '#materialFilter' : '#q';
            const initial = await count(page);
            await page.locator(filter).fill('no-match');
            assert.deepEqual(errors, [], file + ' filter errors');
            if (file === 'Solicitudes MD.html') {
              // main already draws cache when view is empty; preserve and report it.
              assert.equal(await count(page), initial);
              result.baselineIssues.push('Solicitudes MD: zero matches display all rows (pre-existing in main; scripts preserved).');
              await page.locator(filter).fill('RE68316');
              assert.equal(await count(page), 1);
            } else assert.equal(await count(page), 0, file + ' filter did not apply');
            await page.locator('#clearFiltersBtn').click();
            assert.equal(await count(page), initial);
            await exportFile(page, file === 'Analisis de surtido.html' ? '#exportBtn' : '#exportXlsxBtn', file);
            await additionalFlows(page, file);
            if (file === 'Analisis de surtido.html') {
              await page.locator('#csvFile').setInputFiles({ name: 'S004.csv', mimeType: 'text/csv', buffer: Buffer.from('Material\nRE68316\nAA58675\n') });
              await page.waitForFunction(() => window.__writes.some(w => w.name === 'stock_centro'));
              await page.locator('#addRowBtn').click();
              assert(await page.locator('#tbody input[data-field="material"]').count() > initial);
            } else {
              const row = page.locator('#tbody tr[data-id]').first();
              await row.locator('[data-action="edit"]').click();
              const field = file === 'carpetas.html' ? 'carpeta' : file === 'Solicitudes MD.html' ? 'a_material' : 'material';
              // Dynamic row fields retain their original data-field hooks.
              const control = row.locator(`[data-field="${field === 'a_material' ? 'material' : field}"]`);
              await control.fill(file === 'carpetas.html' ? '00999_2026' : 'RE68316-EDIT');
              await row.locator('[data-action="cancel"]').click();
              assert.equal(await page.locator('#tbody [data-field="carpeta"]').count(), 0);
              await row.locator('[data-action="edit"]').click();
              await row.locator('[data-field="' + (file === 'carpetas.html' ? 'carpeta' : 'material') + '"]').fill(file === 'carpetas.html' ? '00999_2026' : 'RE68316-EDIT');
              await row.locator('[data-action="save"]').click();
              await waitWrite(page, file === 'carpetas.html' ? 'rows' : file === 'Reclamos.html' ? 'reclamos' : file === 'reservas.html' ? 'reservas' : 'solicitudes');
            }
            result.flows.push({ file, checks: 'filter/clear, XLSX export, edit/cancel/save or CSV/manual row', result: 'PASS' });
          }
        }
        await page.close();
      }
      await context.close();
    }
    result.result = 'PASS';
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await browser.close();
    server.close();
    fs.writeFileSync(path.join(output, 'ui.json'), JSON.stringify(result, null, 2));
  }
})().catch(error => { server.close(); console.error(error); process.exitCode = 1; });
