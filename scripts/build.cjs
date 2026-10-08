const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const info = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const payload = fs.readFileSync(path.join(root, 'plugin.js'), 'utf8');
new vm.Script(payload);
if (!/^\d+\.\d+\.\d+$/.test(info.version)) throw new Error('Use a stable major.minor.patch version.');
const repository = 'https://github.com/randoomdude/Seanime-Extension---Not-Interested';
// Seanime's external-image component permits URLs ending in .png, but blocks
// SVG data URLs. Keep the manifest and tray pointed at a real PNG asset.
const icon = 'https://raw.githubusercontent.com/randoomdude/Seanime-Extension---Not-Interested/main/assets/icon.png';
const manifest = {
    id: 'local-anime-not-interested',
    name: 'Not Interested',
    version: info.version,
    manifestURI: 'https://raw.githubusercontent.com/randoomdude/Seanime-Extension---Not-Interested/main/local-anime-not-interested.json',
    language: 'javascript',
    type: 'plugin',
    description: 'Mark anime interested with a green border and badge, or not interested to fade or hide it in Search and Discover. Interested series stay visible when hiding is on.',
    author: 'randoomdude',
    icon,
    website: repository,
    readme: repository + '#readme',
    lang: 'en',
    payload,
    plugin: { version: '1', permissions: { scopes: ['storage'], allow: { networkAccess: {} } } },
};
const marketplaceEntry = Object.fromEntries(['id', 'name', 'version', 'description', 'author', 'manifestURI', 'icon', 'type', 'language', 'lang', 'website'].map(key => [key, manifest[key]]));
const outputs = {
    'local-anime-not-interested.json': JSON.stringify(manifest, null, 2) + '\n',
    'marketplace.json': JSON.stringify([marketplaceEntry], null, 2) + '\n',
};
if (process.argv.includes('--check')) {
    for (const [name, text] of Object.entries(outputs)) {
        if (fs.readFileSync(path.join(root, name), 'utf8') !== text) throw new Error(name + ' is out of date. Run npm run build and commit it.');
    }
    const png = fs.readFileSync(path.join(root, 'assets/icon.png'));
    if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('The icon must be a valid PNG.');
    if (!payload.includes(icon)) throw new Error('The tray icon must use the same hosted PNG as the manifest.');
    console.log('Manifest, marketplace index, and icon match plugin version ' + info.version + '.');
} else {
    for (const [name, text] of Object.entries(outputs)) fs.writeFileSync(path.join(root, name), text);
    console.log('Built Not Interested ' + info.version + '.');
}
