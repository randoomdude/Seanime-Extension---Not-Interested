// Seanime 3.10.3+ UI plugin. Marks belong to anime IDs, not title spellings.
// Uses only plugin storage and Seanime's public card actions / DOM API.
function init() {
    $ui.register((ctx) => {
        const storageKey = 'anime-not-interested-v1';
        const styleSelector = 'style[data-anime-not-interested-style]';
        const scope = ':is([data-search-page-container],[data-discover-page-container])';
        const icon = 'https://raw.githubusercontent.com/randoomdude/Seanime-Extension---Not-Interested/main/assets/icon.png';
        const tray = ctx.newTray({ iconUrl: icon, withContent: true, width: '380px' });
        let data = { version: 1, enabled: true, hide: false, entries: {} };
        let storageError = '';
        let undo = null;
        let style = null;
        let ready = false;
        let painting = false;
        let paintAgain = false;
        let mainGeneration = 0;
        let lastDomError = '';
        let slotObserver = null;
        let slotsBusy = false;
        let pendingSlots = [];
        let knownSlots = {};
        const actions = [];

        function readData() {
            const saved = $storage.get(storageKey);
            if (saved === undefined || saved === null) {
                return { version: 1, enabled: true, hide: false, entries: {} };
            }
            if (saved.version !== 1 || !saved.entries || typeof saved.entries !== 'object' || Array.isArray(saved.entries)) {
                throw new Error('The saved list has an unsupported format. It has been left untouched.');
            }
            const entries = {};
            Object.keys(saved.entries).forEach((key) => {
                const item = saved.entries[key];
                const id = Number(key);
                if (!Number.isSafeInteger(id) || id <= 0 || !item || typeof item.title !== 'string') return;
                if (item.status !== undefined && item.status !== 'interested' && item.status !== 'not-interested') {
                    throw new Error('A saved mark has an unsupported interest state. It has been left untouched.');
                }
                entries[String(id)] = {
                    id: id,
                    title: item.title.slice(0, 500),
                    status: item.status || 'not-interested',
                    markedAt: Number.isFinite(item.markedAt) ? item.markedAt : 0,
                };
            });
            return { version: 1, enabled: saved.enabled !== false, hide: saved.hide === true, entries: entries };
        }

        try { data = readData(); }
        catch (error) { storageError = String(error); console.error('Not interested: ' + storageError); }
        const enabledRef = ctx.fieldRef(data.enabled);
        const hideRef = ctx.fieldRef(data.hide);
        const filterRef = ctx.fieldRef('');

        function syncControls() {
            enabledRef.setValue(data.enabled);
            hideRef.setValue(data.hide);
            actions.forEach((action) => action.setDisabled(!!storageError));
            tray.updateBadge({ number: 0 });
            tray.update();
            repaint();
        }

        // Commit to durable storage before claiming a change succeeded. Read fresh
        // data for every edit so a restored UI runtime cannot overwrite other marks.
        function commit(edit) {
            if (storageError) { ctx.toast.error('Cannot save marks. Open Not Interested in Tray Plugins for details.'); return false; }
            try {
                const next = readData();
                edit(next);
                $storage.set(storageKey, next);
                data = next;
                syncControls();
                return true;
            } catch (error) {
                console.error('Not interested: save failed: ' + String(error));
                enabledRef.setValue(data.enabled);
                hideRef.setValue(data.hide);
                ctx.toast.error('Could not save the change. Your previous marks are still in place.');
                return false;
            }
        }

        function mediaInfo(media) {
            const id = Number(media && media.id);
            if (!Number.isSafeInteger(id) || id <= 0 || (media.type && media.type !== 'ANIME')) {
                ctx.toast.error('This anime has no usable series ID.');
                return null;
            }
            const titles = media.title || {};
            const title = titles.userPreferred || titles.english || titles.romaji || titles.native;
            return { id: id, title: typeof title === 'string' && title ? title.slice(0, 500) : 'Anime #' + id };
        }

        function mark(media, status) {
            const info = mediaInfo(media);
            if (!info) return;
            let changed = false;
            let previous = null;
            if (!commit((next) => {
                previous = next.entries[String(info.id)] || null;
                if (previous && previous.status === status) return;
                next.entries[String(info.id)] = { id: info.id, title: info.title, status: status, markedAt: Date.now() };
                changed = true;
            })) return;
            const label = status === 'interested' ? 'interested' : 'not interested';
            if (!changed) { ctx.toast.info('This series is already marked ' + label + '.'); return; }
            undo = { id: info.id, previous: previous };
            tray.update();
            ctx.toast.success('Marked ' + label + '.');
        }

        function clearMark(id) {
            let previous = null;
            if (!commit((next) => {
                previous = next.entries[String(id)] || null;
                delete next.entries[String(id)];
            })) return;
            if (!previous) { ctx.toast.info('This series is not marked.'); return; }
            undo = { id: id, previous: previous };
            tray.update();
            ctx.toast.success('Mark cleared.');
        }

        function undoLast() {
            if (!undo) return;
            const change = undo;
            if (!commit((next) => {
                if (change.previous) next.entries[String(change.id)] = change.previous;
                else delete next.entries[String(change.id)];
            })) return;
            undo = null;
            tray.update();
            ctx.toast.success('Last change undone.');
        }

        function buildCss() {
            if (!data.enabled || storageError) return '';
            const interestedIds = Object.keys(data.entries).filter((id) => data.entries[id].status === 'interested');
            const notInterestedIds = Object.keys(data.entries).filter((id) => data.entries[id].status === 'not-interested');
            function selectorFor(ids) {
                return ':is(' + ids.map((id) => scope + ' [data-media-entry-card-container][data-media-type="anime"][data-media-id="' + id + '"]').join(',') + ')';
            }
            const badgeBase = 'position:absolute;top:8px;left:8px;z-index:16;max-width:calc(100% - 16px);box-sizing:border-box;padding:4px 7px;border-radius:6px;font:600 11px/1.35 system-ui,sans-serif;pointer-events:none;';
            let css = '';
            if (interestedIds.length) {
                const interested = selectorFor(interestedIds);
                css += interested + '{outline:2px solid #4ade80!important;outline-offset:3px;border-radius:8px;}' +
                    interested + '::after{content:"Interested";border:1px solid #4ade80;background:#052e16;color:#bbf7d0;' + badgeBase + '}';
            }
            // Hiding applies only to the negative state. Interested cards retain
            // their normal appearance, green border, and badge in either mode.
            if (!notInterestedIds.length) return css;
            const selector = selectorFor(notInterestedIds);
            if (data.hide) {
                // A lazy grid replaces offscreen cards with skeletons. An owned
                // marker keeps its slot hidden while the actual card is unmounted.
                const slots = notInterestedIds.map((id) => scope + ' [data-media-card-lazy-grid-item]:has(> [data-ni-slot-for="' + id + '"])');
                return css + selector + '{visibility:hidden!important;}' +
                    selector + ':not([data-media-card-lazy-grid-item] *){display:none!important;}' +
                    ':is(' + slots.join(',') + '){display:none!important;}';
            }
            return css + selector + ' [data-media-entry-card-body]{opacity:.28!important;filter:grayscale(.8);}' +
                selector + ' [data-media-entry-card-title-section]{opacity:.45!important;}' +
                selector + '::after{content:"Not interested";border:1px solid #fb7185;background:#4c1420;color:#ffe4e6;' + badgeBase + '}' +
                selector + ':hover [data-media-entry-card-body],' + selector + ':focus-within [data-media-entry-card-body]{opacity:.45!important;}';
        }

        // All visual changes live in one plugin-owned stylesheet. Seanime removes
        // it on unload, so native styles and attributes need no manual rollback.
        async function repaint() {
            paintAgain = true;
            if (!ready || painting) return;
            painting = true;
            try {
                while (paintAgain && ready) {
                    paintAgain = false;
                    const generation = mainGeneration;
                    if (!style) {
                        const existing = await ctx.dom.queryOne(styleSelector);
                        if (generation !== mainGeneration) { paintAgain = true; continue; }
                        if (existing) style = existing;
                        else {
                            const host = await ctx.dom.queryOne('head');
                            if (!host) throw new Error('The reader interface is not ready yet.');
                            const created = await ctx.dom.createElement('style');
                            if (generation !== mainGeneration) { created.remove(); paintAgain = true; continue; }
                            created.setAttribute('data-anime-not-interested-style', '');
                            created.setText(buildCss());
                            host.append(created);
                            style = created;
                        }
                    }
                    style.setText(buildCss());
                    lastDomError = '';
                }
            } catch (error) {
                style = null;
                const message = String(error);
                if (message !== lastDomError) {
                    console.warn('Not interested: card display: ' + message);
                    ctx.toast.warning('Marks are saved, but the card display could not refresh. Reload the Seanime page.');
                    lastDomError = message;
                }
            } finally { painting = false; }
        }

        async function rememberSlots(cards) {
            pendingSlots = cards;
            if (slotsBusy) return;
            slotsBusy = true;
            try {
                while (pendingSlots.length) {
                    const batch = pendingSlots;
                    pendingSlots = [];
                    const generation = mainGeneration;
                    for (const card of batch) {
                        if (generation !== mainGeneration) break;
                        const id = Number(card.attributes['data-media-id']);
                        if (!Number.isSafeInteger(id) || id <= 0) continue;
                        if (knownSlots[card.id] === id) continue;
                        const parent = await card.getParent();
                        if (!parent || parent.attributes['data-media-card-lazy-grid-item-content'] === undefined) continue;
                        const slot = await parent.getParent();
                        if (!slot || slot.attributes['data-media-card-lazy-grid-item'] === undefined) continue;
                        if (await slot.queryOne('[data-ni-slot-for="' + id + '"]')) { knownSlots[card.id] = id; continue; }
                        const marker = await ctx.dom.createElement('span');
                        if (generation !== mainGeneration) { marker.remove(); break; }
                        marker.setAttribute('data-ni-slot-for', String(id));
                        marker.setAttribute('aria-hidden', 'true');
                        marker.setCssText('display:none');
                        slot.append(marker);
                        if (Object.keys(knownSlots).length > 1000) knownSlots = {};
                        knownSlots[card.id] = id;
                    }
                }
            } catch (error) { console.warn('Not interested: lazy grid: ' + String(error)); }
            finally { slotsBusy = false; }
        }

        function start() {
            ready = true;
            mainGeneration++;
            style = null;
            knownSlots = {};
            if (slotObserver) slotObserver[0]();
            slotObserver = ctx.dom.observe(scope + ' [data-media-card-lazy-grid-item-content] > [data-media-entry-card-container][data-media-type="anime"]', rememberSlots);
            repaint();
        }
        ctx.dom.onReady(start);
        ctx.dom.onMainTabReady(start);
        ctx.screen.onNavigate(() => repaint());

        enabledRef.onValueChange((value) => commit((next) => { next.enabled = !!value; }));
        hideRef.onValueChange((value) => commit((next) => { next.hide = !!value; }));
        filterRef.onValueChange(() => tray.update());

        const markCard = ctx.action.newMediaCardContextMenuItem({ label: 'Mark not interested', for: 'anime', style: { color: '#fb7185' } });
        markCard.onClick((event) => mark(event.media, 'not-interested'));
        const interestedCard = ctx.action.newMediaCardContextMenuItem({ label: 'Mark as interested', for: 'anime', style: { color: '#4ade80' } });
        interestedCard.onClick((event) => mark(event.media, 'interested'));
        const markPage = ctx.action.newAnimePageDropdownItem({ label: 'Mark not interested', style: { color: '#fb7185' } });
        markPage.onClick((event) => mark(event.media, 'not-interested'));
        const interestedPage = ctx.action.newAnimePageDropdownItem({ label: 'Mark as interested', style: { color: '#4ade80' } });
        interestedPage.onClick((event) => mark(event.media, 'interested'));
        [markCard, interestedCard, markPage, interestedPage].forEach((action) => {
            actions.push(action);
            action.setDisabled(!!storageError);
            action.mount();
        });

        tray.render(() => {
            const entries = Object.keys(data.entries).map((id) => data.entries[id]).sort((a, b) => b.markedAt - a.markedAt || a.title.localeCompare(b.title));
            const query = String(filterRef.current || '').trim().toLowerCase();
            const matching = entries.filter((item) => !query || item.title.toLowerCase().indexOf(query) !== -1 || String(item.id) === query);
            const rows = [
                tray.text('Not Interested', { style: { fontWeight: '600', fontSize: '17px' } }),
                tray.text('Right-click an anime card to mark it interested or not interested. Marks appear in Search and Discover.', { style: { fontSize: '13px', opacity: '.8' } }),
                tray.switch({ label: 'Show marks', fieldRef: enabledRef, disabled: !!storageError }),
                tray.switch({ label: 'Hide not interested series', fieldRef: hideRef, disabled: !!storageError }),
                tray.text('Interested series keep their green border and stay visible when hiding is on.', { style: { fontSize: '12px', opacity: '.7' } }),
            ];
            if (storageError) rows.push(tray.text('Cannot read saved marks: ' + storageError, { style: { color: '#fb7185', fontSize: '13px' } }));
            if (undo) rows.push(tray.button({ label: 'Undo last change', intent: 'gray-subtle', onClick: ctx.eventHandler('ni-undo', undoLast) }));
            rows.push(tray.text(entries.length + ' saved series', { style: { fontWeight: '600', marginTop: '8px' } }));
            if (entries.length) rows.push(tray.input({ label: 'Find a marked series', placeholder: 'Title or series ID', fieldRef: filterRef, size: 'sm' }));
            if (!matching.length) rows.push(tray.text(entries.length ? 'No matching titles.' : 'No series marked yet.', { style: { fontSize: '13px', opacity: '.7' } }));
            rows.push(tray.stack({ gap: 3, style: { maxHeight: '340px', overflowY: 'auto' }, items: matching.slice(0, 40).map((item) => tray.stack({
                gap: 1,
                items: [
                    tray.text(item.title, { style: { fontSize: '13px', overflowWrap: 'anywhere' } }),
                    tray.text(item.status === 'interested' ? 'Interested' : 'Not interested', { style: { fontSize: '12px', color: item.status === 'interested' ? '#4ade80' : '#fb7185' } }),
                    tray.button({ label: 'Clear mark', size: 'xs', intent: 'gray-subtle', onClick: ctx.eventHandler('ni-clear-' + item.id, () => clearMark(item.id)) }),
                ],
            })) }));
            if (matching.length > 40) rows.push(tray.text('Showing 40 of ' + matching.length + '. Use the filter to find another title.', { style: { fontSize: '12px', opacity: '.7' } }));
            rows.push(tray.text('Saved in Seanime across restarts. Applies to each series separately, including sequels.', { style: { fontSize: '12px', opacity: '.65' } }));
            return tray.stack({ gap: 3, style: { padding: '8px' }, items: rows });
        });
        tray.onOpen(() => { syncControls(); });
    });
}
