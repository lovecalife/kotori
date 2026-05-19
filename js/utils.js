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
            download: true, header: true, skipEmptyLines: true,
            complete: (results) => resolve(results.data),
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
            normalized[key] = foundHeader ? row[foundHeader] : '';
        });
        normalized._type = type;
        return normalized;
    });
};
