const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const info = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const payload = fs.readFileSync(path.join(root, 'plugin.js'), 'utf8');
new vm.Script(payload);
if (!/^\d+\.\d+\.\d+$/.test(info.version)) throw new Error('Use a stable major.minor.patch version.');
const repository = 'https://github.com/randoomdude/Seanime-Extension---Not-Interested';
const icon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect x="2" y="2" width="44" height="44" rx="12" fill="#29212a"/><circle cx="24" cy="24" r="13" fill="none" stroke="#fb7185" stroke-width="4"/><path d="M15 15l18 18" stroke="#fb7185" stroke-width="4" stroke-linecap="round"/></svg>');
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
const output = path.join(root, 'local-anime-not-interested.json');
const text = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--check')) {
    if (fs.readFileSync(output, 'utf8') !== text) throw new Error('Manifest is out of date. Run npm run build and commit it.');
    console.log('Manifest matches plugin source and version ' + info.version + '.');
} else {
    fs.writeFileSync(output, text);
    console.log('Built Not Interested ' + info.version + '.');
}
