// ==========================================
// Data Utilities
// ==========================================

const getImageUrl = (idOrUrl) => {
    if (!idOrUrl) return null;
    let id = idOrUrl;
    if (idOrUrl.startsWith('http')) {
        const match = idOrUrl.match(/\/d\/(.+?)\//);
        if (match) id = match[1];
        else return idOrUrl;
    }
    return `https://lh3.googleusercontent.com/d/${id}`;
};

const getFallbackUrl = (id) => `https://drive.google.com/uc?export=view&id=${id}`;

const SafeImage = ({ src, alt, className, onError, onClick }) => (
    <img src={src} alt={alt} loading="lazy" className={className} onError={onError} onClick={onClick} />
);

const fetchSheetData = (gid) => {
    return new Promise((resolve, reject) => {
        const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
        Papa.parse(url, {
            download: true, header: false, skipEmptyLines: true,
            complete: (results) => {
                // 1行目はメモ、2行目が列名。CSV として解析してから行を選ぶ。
                const [, headers = [], ...rows] = results.data;
                resolve(rows.map(values => Object.fromEntries(
                    headers.map((header, index) => [header, values[index] ?? ''])
                )));
            },
            error: (err) => reject(err)
        });
    });
};

const fetchMemberOrder = () => new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID_SETTINGS}`;
    Papa.parse(url, {
        download: true, header: false, skipEmptyLines: false,
        complete: (results) => {
            const rows = results.data;
            if (rows[0]?.[1]?.trim() !== 'メンバー並び順') {
                reject(new Error('設定シートのメンバー並び順が見つかりません'));
                return;
            }
            resolve(rows.slice(1, 60).map(row => (row[1] || '').trim()).filter(Boolean));
        },
        error: reject
    });
});

const memberNameKey = name => String(name || '').replace(/\s/g, '');

const compareMemberCards = (a, b, orderIndex) => {
    const nameA = memberNameKey(a.name);
    const nameB = memberNameKey(b.name);
    const rankA = orderIndex.get(nameA) ?? Infinity;
    const rankB = orderIndex.get(nameB) ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    if (nameA !== nameB) return nameA.localeCompare(nameB, 'ja');
    const costA = parseInt(a.cost, 10);
    const costB = parseInt(b.cost, 10);
    const valueA = Number.isNaN(costA) ? Infinity : costA;
    const valueB = Number.isNaN(costB) ? Infinity : costB;
    if (valueA !== valueB) return valueA - valueB;
    return (a.number || '').localeCompare(b.number || '');
};

const normalizeData = (rawData, type) => {
    const map = COLUMN_MAP[type];
    return rawData.map(row => {
        const normalized = {};
        Object.keys(map).forEach(key => {
            const foundHeader = map[key].find(h => row[h] !== undefined);
            // 両シートのユニットは G 列。列名が異なる場合も列位置で読み取る。
            const unitHeader = key === 'unit' ? Object.keys(row)[6] : undefined;
            normalized[key] = foundHeader !== undefined ? row[foundHeader] : (unitHeader !== undefined ? row[unitHeader] : '');
        });
        normalized._type = type;
        return normalized;
    });
};
