import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const constants = readFileSync(new URL('../js/constants.js', import.meta.url), 'utf8');
const utils = readFileSync(new URL('../js/utils.js', import.meta.url), 'utf8');
const fetchSource = utils.match(/const fetchSheetData = \(gid\) => \{[\s\S]*?\n\};/)[0];
const normalizeSource = utils.match(/const normalizeData = \(rawData, type\) => \{[\s\S]*?\n\};/)[0];

const rowsByGid = {
    '0': [
        ['メンバーのメモ'],
        ['Number', 'Name', 'Group', 'Ability', 'Keyword', 'Text', 'Unit'],
        ['M-001', 'Member', 'Aqours', 'Ability', 'Keyword', 'Text', 'CYaRon！']
    ],
    '1118651569': [
        ['ライブのメモ'],
        ['Number', 'Name', 'Group', 'Ability', 'Keyword', 'Text', 'Unit'],
        ['L-001', 'Live', 'Aqours', 'Ability', 'Keyword', 'Text', 'CYaRon！']
    ]
};

const Papa = {
    parse(url, options) {
        const gid = new URL(url).searchParams.get('gid');
        const rows = rowsByGid[gid];
        assert.ok(rows, `unexpected sheet: ${gid}`);
        // Papa Parse の header: true は CSV の先頭行を列名にする。
        const data = options.header
            ? rows.slice(1).map(values => Object.fromEntries(values.map((value, index) => [rows[0][index] ?? '__parsed_extra', value])))
            : rows;
        options.complete({ data });
    }
};

const { fetchSheetData, normalizeData } = runInNewContext(
    `${constants}\n${fetchSource}\n${normalizeSource}\n({ fetchSheetData, normalizeData })`,
    { location: { hostname: 'localhost' }, Papa }
);

for (const [gid, type, number, name] of [
    ['0', 'member', 'M-001', 'Member'],
    ['1118651569', 'live', 'L-001', 'Live']
]) {
    const cards = normalizeData(await fetchSheetData(gid), type);
    assert.equal(cards.length, 1, `${type} card count`);
    assert.equal(cards[0].number, number, `${type} number`);
    assert.equal(cards[0].name, name, `${type} name`);
    assert.equal(cards[0].unit, 'CYaRon！', `${type} unit`);
}

console.log('Both sheets use row 2 as the header.');
