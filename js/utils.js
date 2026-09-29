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
