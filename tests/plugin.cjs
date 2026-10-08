const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const root = path.resolve('test-results');
fs.mkdirSync(root, { recursive: true });
const dbFile = path.join(root, 'storage.json');
fs.writeFileSync(dbFile, '{}');
const source = fs.readFileSync('plugin.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('local-anime-not-interested.json', 'utf8'));
assert.equal(manifest.payload, source);
assert.deepEqual(manifest.plugin.permissions.scopes, ['storage']);
const media = (id, title = 'Test Anime') => ({ id, type: 'ANIME', title: { userPreferred: title } });
const card = (id, label, type = 'anime') => `<div data-media-entry-card-container data-media-type="${type}" data-media-id="${id}" class="card"><div data-media-entry-card-body><div class="cover">${label}</div></div><div data-media-entry-card-title-section>${label}</div></div>`;

async function main() {
    const browser = await chromium.launch({ headless: true, ...(process.env.SEANIME_TEST_BROWSER ? { executablePath: process.env.SEANIME_TEST_BROWSER } : {}) });
    try {
        const page = await browser.newPage({ viewport: { width: 1040, height: 650 } });
        await page.setContent(`<!doctype html><html><head><style>body{background:#111114;color:#ddd;font:14px system-ui;padding:24px}h2{font-size:18px}.grid{display:flex;gap:18px}.card{position:relative;width:160px;flex:none}.cover{height:210px;background:linear-gradient(140deg,#293759,#855e6e);padding:18px;box-sizing:border-box;border-radius:10px} [data-media-entry-card-title-section]{padding-top:10px}section{margin-bottom:24px}</style></head><body><section data-search-page-container><h2>Search</h2><div class="grid" data-media-card-grid>${card(101, 'Marked anime')}${card(102, 'Another anime')}${card(101, 'Manga', 'manga')}</div><div data-media-card-lazy-grid class="grid" style="margin-top:20px"><div data-media-card-lazy-grid-item><div data-media-card-lazy-grid-item-content>${card(103, 'Lazy-grid anime')}</div></div></div></section><section data-discover-page-container><h2>Discover</h2><div class="grid">${card(101, 'Marked anime')}${card(104, 'Same title, other ID')}</div></section><section data-library><h2>Library</h2><div class="grid">${card(101, 'Library unchanged')}</div></section></body></html>`);
        await page.locator('[data-media-card-lazy-grid]').evaluate((el, html) => el.insertAdjacentHTML('beforeend', '<div data-media-card-lazy-grid-item><div data-media-card-lazy-grid-item-content>' + html + '</div></div>'), card(104, 'Interested lazy-grid anime'));
        await page.locator('[data-discover-page-container] .grid').evaluate((el, html) => el.insertAdjacentHTML('beforeend', html), card(102, 'Interested anime'));
        let nextElement = 0;
        let failSave = false;
        const messages = [];
        function runtime() {
            const actions = [], fields = [], handlers = new Map(), lifecycle = {}, owned = new Set();
            let render = null;
            const identify = async (selector, parentId) => page.evaluate(({ selector, parentId }) => {
                const host = parentId ? document.getElementById(parentId) : document;
                const nodes = host ? [...host.querySelectorAll(selector)] : [];
                return nodes.map(el => {
                    if (!el.id) el.id = 'ni-test-existing-' + (++window.niElementCounter || (window.niElementCounter = 1));
                    return { id: el.id, attributes: Object.fromEntries([...el.attributes].map(a => [a.name, a.value])) };
                });
            }, { selector, parentId });
            const wrap = (info) => info && ({ ...info,
                setAttribute: (name, value) => page.evaluate(({ id, name, value }) => document.getElementById(id)?.setAttribute(name, value), { id: info.id, name, value }),
                setText: text => page.evaluate(({ id, text }) => { const el = document.getElementById(id); if (el) el.textContent = text; }, { id: info.id, text }),
                setCssText: text => page.evaluate(({ id, text }) => { const el = document.getElementById(id); if (el) el.style.cssText = text; }, { id: info.id, text }),
                append: child => page.evaluate(({ id, child }) => { const el = document.getElementById(id); const c = document.getElementById(child); if (el && c) el.appendChild(c); }, { id: info.id, child: child.id }),
                remove: () => page.evaluate(id => document.getElementById(id)?.remove(), info.id),
                queryOne: async selector => wrap((await identify(selector, info.id))[0] || null),
                getParent: async () => wrap(await page.evaluate(id => {
                    const parent = document.getElementById(id)?.parentElement;
                    if (!parent) return null;
                    if (!parent.id) parent.id = 'ni-test-existing-' + (++window.niElementCounter || (window.niElementCounter = 1));
                    return { id: parent.id, attributes: Object.fromEntries([...parent.attributes].map(a => [a.name, a.value])) };
                }, info.id)),
            });
            const makeAction = (props) => {
                const action = { props, disabled: false, mounted: false, onClick: cb => action.click = cb, mount: () => action.mounted = true, setDisabled: value => action.disabled = value };
                actions.push(action); return action;
            };
            const component = name => (...args) => ({ name, args });
            const tray = Object.fromEntries(['text','stack','switch','input','button'].map(name => [name, component(name)]));
            Object.assign(tray, { render: cb => render = cb, update: () => render?.(), updateBadge: () => {}, onOpen: cb => lifecycle.open = cb });
            const ctx = {
                newTray: () => tray,
                fieldRef: value => { const field = { current: value, setValue: v => field.current = v, onValueChange: cb => field.change = cb }; fields.push(field); return field; },
                eventHandler: (key, cb) => { handlers.set(key, cb); return key; },
                action: { newMediaCardContextMenuItem: makeAction, newAnimePageDropdownItem: makeAction },
                screen: { onNavigate: cb => lifecycle.navigate = cb },
                toast: Object.fromEntries(['success','error','info','warning'].map(level => [level, message => messages.push({ level, message })])),
                dom: {
                    queryOne: async selector => wrap((await identify(selector))[0] || null),
                    createElement: async tagName => {
                        const id = 'ni-test-owned-' + (++nextElement);
                        await page.evaluate(({ id, tagName }) => { const el = document.createElement(tagName); el.id = id; document.body.appendChild(el); }, { id, tagName });
                        owned.add(id); return wrap({ id, attributes: {} });
                    },
                    observe: (selector, cb) => {
                        let active = true;
                        const refetch = async () => { if (active) await cb((await identify(selector)).map(wrap)); };
                        refetch(); lifecycle.refetch = refetch; return [() => active = false, refetch];
                    },
                    onReady: cb => lifecycle.ready = cb,
                    onMainTabReady: cb => lifecycle.main = cb,
                },
            };
            const sandbox = { $ui: { register: cb => cb(ctx) }, console: { error: () => {}, warn: () => {} },
                $storage: {
                    get: key => JSON.parse(fs.readFileSync(dbFile, 'utf8'))[key],
                    set: (key, value) => { if (failSave) throw Error('Simulated disk failure'); const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); db[key] = value; fs.writeFileSync(dbFile, JSON.stringify(db)); },
                },
            };
            vm.runInNewContext(source + '\ninit();', sandbox);
            return { actions, fields, handlers, lifecycle, owned, render: () => render(), cleanup: async () => { for (const id of owned) await page.evaluate(id => document.getElementById(id)?.remove(), id); } };
        }
        const pause = () => new Promise(resolve => setTimeout(resolve, 250));
        const stored = () => JSON.parse(fs.readFileSync(dbFile, 'utf8'))['anime-not-interested-v1'];
        const opacity = async (rootSelector, id, type = 'anime') => page.locator(`${rootSelector} [data-media-id="${id}"][data-media-type="${type}"] [data-media-entry-card-body]`).first().evaluate(el => getComputedStyle(el).opacity);
        const shown = async selector => page.locator(selector).evaluate(el => getComputedStyle(el).display !== 'none');
        let ui = runtime();
        ui.lifecycle.ready(); ui.lifecycle.main(); await pause();
        assert.equal(await page.locator('style[data-anime-not-interested-style]').count(), 1, 'Only one stylesheet after both ready events');
        ui.actions[0].click({ media: media(101, '<b>Title</b>') }); await pause();
        assert.equal(stored().entries[101].title, '<b>Title</b>');
        assert.equal(await opacity('[data-search-page-container]', 101), '0.28');
        assert.equal(await opacity('[data-discover-page-container]', 101), '0.28');
        assert.equal(await opacity('[data-search-page-container]', 102), '1');
        assert.equal(await opacity('[data-search-page-container]', 101, 'manga'), '1');
        assert.equal(await opacity('[data-library]', 101), '1');
        assert.equal(await page.locator('[data-search-page-container] [data-media-id="101"][data-media-type="anime"]').evaluate(el => getComputedStyle(el, '::after').content), '"Not interested"');
        ui.actions[0].click({ media: media(101, 'Translated title') }); await pause();
        assert.equal(Object.keys(stored().entries).length, 1, 'Title spelling does not duplicate a series');
        assert.equal(ui.actions[1].props.label, 'Mark as interested');
        assert.equal(ui.actions[3].props.label, 'Mark as interested');
        ui.actions[1].click({ media: media(102, 'Interested anime') }); await pause();
        const interestedStyle = async (root, id) => page.locator(`${root} [data-media-id="${id}"][data-media-type="anime"]`).first().evaluate(el => {
            const style = getComputedStyle(el);
            return { display: style.display, visibility: style.visibility, outlineColor: style.outlineColor, outlineWidth: style.outlineWidth, outlineStyle: style.outlineStyle, badge: getComputedStyle(el, '::after').content, badgeBorder: getComputedStyle(el, '::after').borderColor };
        });
        assert.equal(stored().entries[102].status, 'interested');
        for (const root of ['[data-search-page-container]', '[data-discover-page-container]']) {
            const look = await interestedStyle(root, 102);
            assert.equal(look.outlineColor, 'rgb(74, 222, 128)');
            assert.equal(look.outlineWidth, '2px');
            assert.equal(look.badge, '"Interested"');
            assert.equal(look.badgeBorder, 'rgb(74, 222, 128)');
            assert.equal(await opacity(root, 102), '1');
        }
        await page.locator('[data-discover-page-container] .grid').evaluate((el, html) => el.insertAdjacentHTML('beforeend', html), card(101, 'Loaded later'));
        assert.equal(await page.locator('[data-discover-page-container] [data-media-id="101"] [data-media-entry-card-body]').last().evaluate(el => getComputedStyle(el).opacity), '0.28', 'New cards receive CSS without polling');
        await page.screenshot({ path: path.join(root, 'dim-preview.png'), fullPage: true });
        ui.actions[0].click({ media: media(103, 'Lazy-grid anime') }); await pause();
        ui.actions[1].click({ media: media(104, 'Interested lazy-grid anime') }); await pause();
        await ui.lifecycle.refetch(); await pause();
        assert.equal(await page.locator('[data-media-card-lazy-grid-item] > [data-ni-slot-for="103"]').count(), 1);
        const negativeSlot = '[data-media-card-lazy-grid-item]:has(> [data-ni-slot-for="103"])';
        const positiveSlot = '[data-media-card-lazy-grid-item]:has(> [data-ni-slot-for="104"])';
        ui.fields[1].change(true); await pause();
        assert.equal(await shown('[data-search-page-container] [data-media-id="101"][data-media-type="anime"]'), false);
        assert.equal(await shown(negativeSlot), false);
        assert.equal(await shown(positiveSlot), true, 'Interested lazy-grid slot is not hidden');
        assert.equal((await interestedStyle('[data-search-page-container]', 102)).badge, '"Interested"');
        assert.equal((await interestedStyle('[data-search-page-container]', 102)).display === 'none', false);
        assert.equal((await interestedStyle('[data-search-page-container]', 102)).visibility, 'visible');
        await page.screenshot({ path: path.join(root, 'interested-hide-preview.png'), fullPage: true });
        // Switching from a hidden negative mark to interested makes all copies visible.
        ui.actions[1].click({ media: media(101) }); await pause();
        assert.equal(await shown('[data-search-page-container] [data-media-id="101"][data-media-type="anime"]'), true);
        assert.equal((await interestedStyle('[data-search-page-container]', 101)).badge, '"Interested"');
        ui.handlers.get('ni-undo')(); await pause();
        assert.equal(await shown('[data-search-page-container] [data-media-id="101"][data-media-type="anime"]'), false, 'Undo restores hidden negative state');
        await page.locator(negativeSlot + ' [data-media-card-lazy-grid-item-content]').evaluate(el => el.outerHTML = '<div data-media-card-lazy-grid-item-skeleton>Placeholder</div>');
        assert.equal(await shown(negativeSlot), false, 'Slot stays hidden when virtualized into a skeleton');
        ui.handlers.get('ni-clear-103')(); await pause();
        assert.equal(await shown(negativeSlot), true, 'Clearing unhides a skeleton slot');
        ui.fields[1].change(false); ui.fields[0].change(false); await pause();
        assert.equal(await opacity('[data-search-page-container]', 101), '1');
        assert.equal(stored().enabled, false);
        await ui.cleanup();
        ui = runtime(); ui.lifecycle.ready(); await pause();
        assert.equal(ui.fields[0].current, false, 'Setting survives a fresh runtime');
        ui.fields[0].change(true); await pause();
        assert.equal(await opacity('[data-search-page-container]', 101), '0.28', 'Saved mark survives a fresh runtime');
        assert.equal((await interestedStyle('[data-search-page-container]', 102)).badge, '"Interested"', 'Interested state survives a fresh runtime');
        failSave = true;
        ui.actions[0].click({ media: media(102) }); await pause();
        assert.equal(stored().entries[102].status, 'interested', 'Failed save preserves preceding interested state');
        assert.equal(await opacity('[data-search-page-container]', 102), '1');
        assert(messages.some(x => x.level === 'error' && x.message.includes('Could not save')));
        failSave = false;
        ui.actions[1].click({ media: media(101) }); await pause();
        assert.equal(await opacity('[data-search-page-container]', 101), '1');
        assert.equal((await interestedStyle('[data-search-page-container]', 101)).badge, '"Interested"');
        ui.handlers.get('ni-undo')(); await pause();
        assert.equal(await opacity('[data-search-page-container]', 101), '0.28');
        await ui.cleanup();
        assert.equal(await opacity('[data-search-page-container]', 101), '1', 'Plugin cleanup restores native appearance');
        assert.equal((await interestedStyle('[data-search-page-container]', 102)).outlineStyle, 'none', 'Unload removes green border');
        assert.equal(await page.locator('[data-anime-not-interested-style],[data-ni-slot-for]').count(), 0);
        fs.writeFileSync(dbFile, JSON.stringify({ 'anime-not-interested-v1': { version: 1, entries: { 101: { id: 101, title: 'Legacy negative mark', markedAt: 1 } } } }));
        ui = runtime(); ui.lifecycle.ready(); await pause();
        assert.equal(await opacity('[data-search-page-container]', 101), '0.28', 'Older saved marks retain the negative state');
        ui.actions[1].click({ media: media(102) }); await pause();
        assert.equal(stored().entries[101].status, 'not-interested', 'Saving after migration preserves older marks');
        await ui.cleanup();
        fs.writeFileSync(dbFile, JSON.stringify({ 'anime-not-interested-v1': { version: 2, entries: {} } }));
        ui = runtime();
        assert(ui.actions.every(action => action.disabled), 'Unsupported saved format disables mutation');
        ui.actions[0].click({ media: media(101) });
        assert.equal(stored().version, 2, 'Unsupported saved format is not overwritten');
        const result = { passed: true, checks: ['interested and not-interested menu actions', 'green border and Interested badge in search and discover', 'interested cards and lazy-grid slots stay visible when hiding', 'switching a hidden negative card to interested unhides it', 'manga and library unaffected', 'same ID across translated titles and new cards', 'single stylesheet with duplicate ready events', 'negative lazy-grid skeleton stays hidden and clears', 'both states and settings survive fresh runtime', 'failed storage write preserves preceding interest state', 'undo restores the preceding interest state', 'unload removes all visual effects', 'legacy negative marks preserved', 'future storage format preserved'], limitation: 'Browser DOM fixture and simulated durable storage; not yet a live Seanime UI test.' };
        fs.writeFileSync(path.join(root, 'results.json'), JSON.stringify(result, null, 2));
        console.log(JSON.stringify(result));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
