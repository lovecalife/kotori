// ==========================================
// Constants & Config
// ==========================================
const SPREADSHEET_ID = '1LqPWdfJPvuKfljm-H0giBm4PrplGVYhTAGdGWzxA-V0';
const GID_MEMBER = '0';
const GID_LIVE = '1118651569';

const COST_OPTIONS = [2, 4, 5, 7, 8, 9, 10, 11, 13, 15, 17, 20, 22].sort((a,b) => a-b);
const BH_OPTIONS_MEMBER = ['Pink', 'Red', 'Yellow', 'Green', 'Blue', 'Purple', 'None'];
const BH_OPTIONS_LIVE = ['Pink', 'Red', 'Yellow', 'Green', 'Blue', 'Purple', 'ALL', 'Score', 'Draw'];

const BH_SORT_ORDER = { 'Pink': 1, 'Red': 2, 'Yellow': 3, 'Green': 4, 'Blue': 5, 'Purple': 6, 'None': 7 };

const STATS_OPTIONS = Array.from({length: 20}, (_, i) => i + 1);
const MAX_STATS_OPTIONS = [...STATS_OPTIONS, '＋'];
const GROUP_OPTIONS = ["μ's", 'Aqours', '虹ヶ咲', 'Liella!', '蓮ノ空', 'A-RISE', 'SaintSnow', 'SunnyPassion'];

const GROUP_STYLES = {
    "μ's":          { base: "bg-pink-400 text-white hover:bg-pink-500", active: "bg-pink-600 ring-2 ring-pink-600 ring-offset-1" },
    "A-RISE":       { base: "bg-blue-500 text-white hover:bg-blue-600", active: "bg-blue-700 ring-2 ring-blue-700 ring-offset-1" },
    "Aqours":       { base: "bg-sky-400 text-white hover:bg-sky-500", active: "bg-sky-600 ring-2 ring-sky-600 ring-offset-1" },
    "SaintSnow":    { base: "bg-gray-400 text-white hover:bg-gray-500", active: "bg-gray-600 ring-2 ring-gray-600 ring-offset-1" },
    "虹ヶ咲":        { base: "bg-yellow-300 text-black hover:bg-yellow-400", active: "bg-yellow-500 ring-2 ring-yellow-500 ring-offset-1" },
    "Liella!":      { base: "bg-purple-400 text-white hover:bg-purple-500", active: "bg-purple-600 ring-2 ring-purple-600 ring-offset-1" },
    "SunnyPassion": { base: "bg-orange-400 text-white hover:bg-orange-500", active: "bg-orange-600 ring-2 ring-orange-600 ring-offset-1" },
    "蓮ノ空":        { base: "bg-rose-300 text-gray-800 hover:bg-rose-400", active: "bg-rose-500 text-white ring-2 ring-rose-500 ring-offset-1" },
};

const BH_STYLES = {
    'Pink':   { base: 'bg-pink-400 text-white hover:bg-pink-500', active: 'bg-pink-700 text-white ring-2 ring-pink-700 ring-offset-1', bg: 'bg-pink-400' },
    'Red':    { base: 'bg-red-400 text-white hover:bg-red-500', active: 'bg-red-700 text-white ring-2 ring-red-700 ring-offset-1', bg: 'bg-red-500' },
    'Yellow': { base: 'bg-yellow-300 text-black hover:bg-yellow-400', active: 'bg-yellow-600 text-white ring-2 ring-yellow-600 ring-offset-1', bg: 'bg-yellow-400' },
    'Green':  { base: 'bg-green-400 text-white hover:bg-green-500', active: 'bg-green-700 text-white ring-2 ring-green-700 ring-offset-1', bg: 'bg-green-500' },
    'Blue':   { base: 'bg-blue-400 text-white hover:bg-blue-500', active: 'bg-blue-700 text-white ring-2 ring-blue-700 ring-offset-1', bg: 'bg-blue-500' },
    'Purple': { base: 'bg-purple-400 text-white hover:bg-purple-500', active: 'bg-purple-700 text-white ring-2 ring-purple-700 ring-offset-1', bg: 'bg-purple-500' },
    'None':   { base: 'bg-gray-300 text-gray-700 hover:bg-gray-400', active: 'bg-gray-600 text-white ring-2 ring-gray-600 ring-offset-1', bg: 'bg-gray-300' },
    'Gray':   { base: 'bg-gray-400 text-white hover:bg-gray-500', active: 'bg-gray-700 text-white ring-2 ring-gray-700 ring-offset-1', bg: 'bg-gray-400' },
    'ALL':    { base: 'bg-gray-700 text-white', active: 'bg-gray-900 text-white ring-2 ring-gray-900 ring-offset-1', bg: 'bg-gray-700' },
    'Score':  { base: 'bg-cyan-500 text-white', active: 'bg-cyan-700 text-white ring-2 ring-cyan-700 ring-offset-1', bg: 'bg-cyan-500' },
    'Draw':   { base: 'bg-orange-500 text-white', active: 'bg-orange-700 text-white ring-2 ring-orange-700 ring-offset-1', bg: 'bg-orange-500' }
};

const TAG_COLORS = [
    { base: 'bg-red-100 text-red-800 hover:bg-red-200', active: 'bg-red-500 text-white ring-2 ring-red-500 ring-offset-1' },
    { base: 'bg-orange-100 text-orange-800 hover:bg-orange-200', active: 'bg-orange-500 text-white ring-2 ring-orange-500 ring-offset-1' },
    { base: 'bg-amber-100 text-amber-800 hover:bg-amber-200', active: 'bg-amber-500 text-white ring-2 ring-amber-500 ring-offset-1' },
    { base: 'bg-green-100 text-green-800 hover:bg-green-200', active: 'bg-green-500 text-white ring-2 ring-green-500 ring-offset-1' },
    { base: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200', active: 'bg-emerald-500 text-white ring-2 ring-emerald-500 ring-offset-1' },
    { base: 'bg-teal-100 text-teal-800 hover:bg-teal-200', active: 'bg-teal-500 text-white ring-2 ring-teal-500 ring-offset-1' },
    { base: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200', active: 'bg-cyan-500 text-white ring-2 ring-cyan-500 ring-offset-1' },
    { base: 'bg-blue-100 text-blue-800 hover:bg-blue-200', active: 'bg-blue-500 text-white ring-2 ring-blue-500 ring-offset-1' },
    { base: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200', active: 'bg-indigo-500 text-white ring-2 ring-indigo-500 ring-offset-1' },
    { base: 'bg-violet-100 text-violet-800 hover:bg-violet-200', active: 'bg-violet-500 text-white ring-2 ring-violet-500 ring-offset-1' },
    { base: 'bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-200', active: 'bg-fuchsia-500 text-white ring-2 ring-fuchsia-500 ring-offset-1' },
    { base: 'bg-pink-100 text-pink-800 hover:bg-pink-200', active: 'bg-pink-500 text-white ring-2 ring-pink-500 ring-offset-1' },
    { base: 'bg-rose-100 text-rose-800 hover:bg-rose-200', active: 'bg-rose-500 text-white ring-2 ring-rose-500 ring-offset-1' },
    { base: 'bg-slate-100 text-slate-800 hover:bg-slate-200', active: 'bg-slate-500 text-white ring-2 ring-slate-500 ring-offset-1' },
];
const getTagColor = (index) => TAG_COLORS[index % TAG_COLORS.length];

const COLUMN_MAP = {
    member: {
        number: ['Number', 'No', 'No.', '番号', 'ID'],
        name: ['Name', '名前', 'カード名'],
        group: ['Group', 'グループ', '所属'],
        ability: ['Ability', 'アビリティ', '能力', '効果', 'スキル'],
        text: ['Text', 'テキスト', '効果テキスト', 'スキル詳細'],
        contain: ['Expansion', 'Contain', '収録', '収録弾'],
        cost: ['Cost', 'コスト'],
        blade: ['Blade', 'ブレード'],
        bladeHeart: ['BladeHeart', 'ブレードハート', 'BH'],
        baseStats: ['BaseStats', '基本ステータス', '基本値', 'Stats'],
        maxStats: ['MaxStats', '最大ステータス', '最大値'],
        image: ['ImageID', 'Image', '画像', '画像ID'],
        noViewer: ['NoViewer', '非表示', 'NoView'],
        sortId: ['SortID', 'SortId', 'sort_id'],
        rarity: ['Rarity', 'レアリティ', 'rarity'],
        Pink: ['Pink', 'ピンク'],
        Red: ['Red', 'レッド', '赤'],
        Yellow: ['Yellow', 'イエロー', '黄'],
        Green: ['Green', 'グリーン', '緑'],
        Blue: ['Blue', 'ブルー', '青'],
        Purple: ['Purple', 'パープル', '紫']
    },
    live: {
        number: ['Number', 'No', 'No.', '番号', 'ID'],
        name: ['Name', '名前', '楽曲名'],
        group: ['Group', 'グループ', '属性'],
        ability: ['Ability', 'アビリティ', '能力', '効果', 'スキル'],
        text: ['Text', 'テキスト', '効果テキスト', 'スキル詳細'],
        contain: ['Expansion', 'Contain', '収録', '収録弾'],
        req: ['BaseCost', 'Requirement', '要求値', 'メンタル'],
        score: ['BaseScore', 'Score', 'スコア'],
        effReq: ['EffectiveCost', 'EffectiveReq', '実質要求', '実質メンタル'],
        maxScore: ['MaxScore', '最大スコア'],
        image: ['ImageID', 'Image', '画像', '画像ID'],
        bladeHeart: ['BladeHeart', 'ブレードハート', 'BH'],
        keyword: ['Keyword', 'キーワード', '特徴'],
        efficiency: ['Efficiency', '効率', 'Eff'],
        noViewer: ['NoViewer', '非表示', 'NoView'],
        sortId: ['SortID', 'SortId', 'sort_id'],
        rarity: ['Rarity', 'レアリティ', 'rarity'],
        Pink: ['Pink', 'ピンク'],
        Red: ['Red', 'レッド', '赤'],
        Yellow: ['Yellow', 'イエロー', '黄'],
        Green: ['Green', 'グリーン', '緑'],
        Blue: ['Blue', 'ブルー', '青'],
        Purple: ['Purple', 'パープル', '紫'],
        Gray: ['Gray', 'None', 'グレー', 'ノーン']
    }
};
