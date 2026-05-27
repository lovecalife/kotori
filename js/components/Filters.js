// ==========================================
// Filter Components
// ==========================================

const FilterHeader = ({ label, onReset, isActive }) => (
    <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-bold text-gray-500 uppercase">{label}</label>
        {isActive && <button onClick={onReset} className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100"><Icons.Close /></button>}
    </div>
);

const RangeFilter = ({ label, minVal, maxVal, onMinChange, onMaxChange, onReset }) => (
    <div className="mb-4">
        <FilterHeader label={label} onReset={onReset} isActive={minVal !== '' || maxVal !== ''} />
        <div className="flex items-center gap-2">
            <input type="number" placeholder="Min" value={minVal} onChange={(e) => onMinChange(e.target.value)} className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            <span className="text-gray-400">~</span>
            <input type="number" placeholder="Max" value={maxVal} onChange={(e) => onMaxChange(e.target.value)} className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" />
        </div>
    </div>
);

const DropdownRangeFilter = ({ label, minVal, maxVal, options, onMinChange, onMaxChange, onReset }) => (
    <div className="mb-4">
        <FilterHeader label={label} onReset={onReset} isActive={minVal !== '' || maxVal !== ''} />
        <div className="flex items-center gap-2">
            <select value={minVal} onChange={(e) => onMinChange(e.target.value)} className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"><option value="">Min</option>{options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
            <span className="text-gray-400">~</span>
            <select value={maxVal} onChange={(e) => onMaxChange(e.target.value)} className="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"><option value="">Max</option>{options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
        </div>
    </div>
);

const ButtonGroupFilter = ({ label, options, filterState, onChange, onReset, styles = {}, defaultStyle = {} }) => {
    const isActive = filterState.include.size > 0 || filterState.exclude.size > 0;
    return (
        <div className="mb-4">
            <FilterHeader label={label} onReset={onReset} isActive={isActive} />
            <div className="flex flex-wrap gap-2">
                {options.map(opt => {
                    const isIncluded = filterState.include.has(opt);
                    const isExcluded = filterState.exclude.has(opt);
                    const style = styles[opt] || defaultStyle;
                    let className = style.base;
                    if (isIncluded) className = style.active;
                    if (isExcluded) className = "bg-gray-800 text-gray-300 ring-2 ring-offset-2 ring-gray-800 line-through opacity-80";
                    return <button key={opt} onClick={() => onChange(opt)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all border border-transparent shadow-sm ${className}`}>{opt}</button>;
                })}
            </div>
        </div>
    );
};

const TagFilter = ({ label, options, filterState, onChange, onReset }) => {
    if (options.length === 0) return null;
    const isActive = filterState.include.size > 0 || filterState.exclude.size > 0;
    return (
        <div className="mb-4">
            <FilterHeader label={label} onReset={onReset} isActive={isActive} />
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                {options.map((opt, index) => {
                    const isIncluded = filterState.include.has(opt);
                    const isExcluded = filterState.exclude.has(opt);
                    const style = getTagColor(index);
                    let className = style.base;
                    if (isIncluded) className = style.active;
                    if (isExcluded) className = "bg-gray-800 text-gray-300 ring-2 ring-offset-2 ring-gray-800 line-through opacity-80";
                    return <button key={opt} onClick={() => onChange(opt)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all border border-transparent shadow-sm ${className}`}>{opt}</button>;
                })}
            </div>
        </div>
    );
};

// カラーカウントフィルター（専用コンポーネント）
// 各色の所持枚数条件を指定する。空欄=条件なし、0=含まない、1以上=その数以上
const ColorCountFilter = ({ filterColors, setFilterColors, onReset, label = 'Color Count' }) => {
    const colors = ['Pink', 'Red', 'Yellow', 'Green', 'Blue', 'Purple', 'Gray'];
    const isActive = colors.some(c => filterColors[c] !== '');

    const handleChange = (color, value) => {
        setFilterColors(prev => ({ ...prev, [color]: value }));
    };

    const handleDecrement = (color) => {
        const val = filterColors[color];
        if (val === '0') {
            handleChange(color, '');
        } else if (val !== '') {
            const num = parseInt(val, 10);
            if (!isNaN(num) && num > 0) handleChange(color, (num - 1).toString());
        }
    };

    const handleIncrement = (color) => {
        const val = filterColors[color];
        if (val === '') {
            handleChange(color, '0');
        } else {
            const num = parseInt(val, 10);
            if (!isNaN(num)) handleChange(color, (num + 1).toString());
        }
    };

    return (
        <div className="mb-4">
            <FilterHeader label={label} onReset={onReset} isActive={isActive} />
            <div className="grid grid-cols-2 gap-2">
                {colors.map(color => {
                    const style = BH_STYLES[color];
                    return (
                        <div key={color} className="flex items-center justify-between border border-gray-200 rounded px-1.5 py-1 bg-white shadow-sm focus-within:ring-1 focus-within:ring-blue-500">
                            <div className="flex items-center gap-1.5">
                                <span className={`w-3 h-3 rounded-full flex-shrink-0 ${style.bg}`}></span>
                                <span className="text-[10px] font-bold text-gray-600 w-8 flex-shrink-0 truncate">{color}</span>
                            </div>
                            <div className="flex items-center bg-gray-50 rounded border border-gray-200 h-6">
                                <button
                                    onClick={() => handleDecrement(color)}
                                    className="w-5 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-200 h-full rounded-l transition-colors"
                                >
                                    <Icons.Minus style={{width: 10, height: 10}} />
                                </button>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="-"
                                    value={filterColors[color]}
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '' || parseInt(v) >= 0) handleChange(color, v);
                                    }}
                                    className="w-6 text-center text-[11px] outline-none bg-transparent font-bold text-gray-700 hide-spin"
                                />
                                <button
                                    onClick={() => handleIncrement(color)}
                                    className="w-5 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-200 h-full rounded-r transition-colors"
                                >
                                    <Icons.Plus style={{width: 10, height: 10}} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 leading-tight">※空欄:条件なし / 0:含まない / 1以上:その数以上</p>
        </div>
    );
};

// メインフィルターパネル
// activeTab に応じてメンバー/ライブ/デッキ用のフィルターを切り替える
const FilterPanel = ({
    isMobile, activeTab, setActiveTab,
    filterName, setFilterName,
    filterGroups, toggleGroup, setFilterGroups,
    filterAbilities, toggleAbility, setFilterAbilities,
    filterCosts, toggleCost, setFilterCosts,
    numericFilters, updateNumericFilter, setNumericFilters,
    filterBladeHeart, toggleBladeHeart, setFilterBladeHeart,
    filterColors, setFilterColors,
    filterBaseStats, setFilterBaseStats, filterMaxStats, setFilterMaxStats,
    uniqueAbilities, uniqueKeywords,
    filterKeywords, toggleKeyword, setFilterKeywords,
    filterContains, toggleContain, setFilterContains, uniqueContains,
    resetFilters, initial3State, deckSortType, setDeckSortType
}) => {
    const resetColors = () => setFilterColors({ Pink: '', Red: '', Yellow: '', Green: '', Blue: '', Purple: '', Gray: '' });

    return (
        <div className="space-y-4">
            {!isMobile && (
                <div className="flex bg-gray-100 p-1 rounded-lg mb-4 text-xs font-medium">
                    <button onClick={() => setActiveTab('member')} className={`flex-1 py-2 rounded-md transition-colors ${activeTab === 'member' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>メンバー</button>
                    <button onClick={() => setActiveTab('live')} className={`flex-1 py-2 rounded-md transition-colors ${activeTab === 'live' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>ライブ</button>
                    <button onClick={() => setActiveTab('deck')} className={`flex-1 py-2 rounded-md transition-colors ${activeTab === 'deck' ? 'bg-gray-800 shadow text-white' : 'text-gray-500'}`}>デッキ</button>
                </div>
            )}

            {activeTab === 'deck' ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <FilterHeader label="Deck Sort Order" />
                    <select value={deckSortType} onChange={e => setDeckSortType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-800 bg-white">
                        <option value="cost">コスト順</option>
                        <option value="bladeHeart">ブレードハート順</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-4">※ デッキタブではフィルタリングは行われず、デッキに追加されたすべてのカードが表示されます。</p>
                </div>
            ) : (
                <>
                    {/* キーワード検索（デスクトップのみ共通） */}
                    {!isMobile && (
                        <div className="mb-4">
                            <FilterHeader label="キーワード検索" onReset={() => setFilterName('')} isActive={filterName !== ''} />
                            <div className="relative">
                                <input type="text" placeholder="名前・テキスト・コスト (スペースでAND検索)" value={filterName} onChange={(e) => setFilterName(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" />
                                <div className="absolute left-3 top-2.5 text-gray-400"><Icons.Search /></div>
                            </div>
                        </div>
                    )}

                    {/* メンバータブ */}
                    {activeTab === 'member' && (
                        <>
                            {/* 収録 */}
                            {uniqueContains.length > 0 && <TagFilter label="収録" options={uniqueContains} filterState={filterContains} onChange={toggleContain} onReset={() => setFilterContains(initial3State())} />}
                            {/* コスト */}
                            <div className="mb-4">
                                <FilterHeader label="コスト" onReset={() => setFilterCosts(initial3State())} isActive={filterCosts.include.size > 0 || filterCosts.exclude.size > 0} />
                                <div className="grid grid-cols-4 gap-2">
                                    {COST_OPTIONS.map(c => {
                                        const isIncluded = filterCosts.include.has(c);
                                        const isExcluded = filterCosts.exclude.has(c);
                                        let className = 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50';
                                        if (isIncluded) className = 'bg-blue-600 text-white border-blue-600 font-bold';
                                        if (isExcluded) className = 'bg-gray-800 text-gray-300 border-gray-800 line-through opacity-80';
                                        return <button key={c} onClick={() => toggleCost(c)} className={`py-1 rounded text-sm border transition-colors select-none ${className}`}>{c}</button>;
                                    })}
                                </div>
                            </div>
                            {/* タグ */}
                            {uniqueAbilities.length > 0 && <TagFilter label="タグ" options={uniqueAbilities} filterState={filterAbilities} onChange={toggleAbility} onReset={() => setFilterAbilities(initial3State())} />}
                            {/* キーワード */}
                            {uniqueKeywords.length > 0 && <TagFilter label="キーワード" options={uniqueKeywords} filterState={filterKeywords} onChange={toggleKeyword} onReset={() => setFilterKeywords(initial3State())} />}
                            {/* グループ */}
                            <ButtonGroupFilter label="グループ" options={GROUP_OPTIONS} filterState={filterGroups} onChange={toggleGroup} styles={GROUP_STYLES} defaultStyle={GROUP_STYLES["μ's"]} onReset={() => setFilterGroups(initial3State())} />
                            {/* ブレードハート */}
                            <ButtonGroupFilter label="ブレードハート" options={BH_OPTIONS_MEMBER} filterState={filterBladeHeart} onChange={toggleBladeHeart} styles={BH_STYLES} defaultStyle={BH_STYLES['None']} onReset={() => setFilterBladeHeart(initial3State())} />
                            {/* ハート数 */}
                            <ColorCountFilter label="ハート数" filterColors={filterColors} setFilterColors={setFilterColors} onReset={resetColors} />
                            {/* ブレード数 */}
                            <DropdownRangeFilter label="ブレード数" minVal={numericFilters.blade?.min||''} maxVal={numericFilters.blade?.max||''} options={[0,1,2,3,4,5,6,7]} onMinChange={(v) => updateNumericFilter('blade', 'min', v)} onMaxChange={(v) => updateNumericFilter('blade', 'max', v)} onReset={() => setNumericFilters(p => ({...p, blade: {min:'',max:''}}))} />
                            {/* 基本スタッツ */}
                            <DropdownRangeFilter label="基本スタッツ" minVal={filterBaseStats.min} maxVal={filterBaseStats.max} options={STATS_OPTIONS} onMinChange={(v) => setFilterBaseStats(p=>({...p,min:v}))} onMaxChange={(v) => setFilterBaseStats(p=>({...p,max:v}))} onReset={() => setFilterBaseStats({min:'',max:''})} />
                            {/* 最大スタッツ */}
                            <DropdownRangeFilter label="最大スタッツ" minVal={filterMaxStats.min} maxVal={filterMaxStats.max} options={MAX_STATS_OPTIONS} onMinChange={(v) => setFilterMaxStats(p=>({...p,min:v}))} onMaxChange={(v) => setFilterMaxStats(p=>({...p,max:v}))} onReset={() => setFilterMaxStats({min:'',max:''})} />
                        </>
                    )}

                    {/* ライブタブ */}
                    {activeTab === 'live' && (
                        <>
                            {/* 収録 */}
                            {uniqueContains.length > 0 && <TagFilter label="収録" options={uniqueContains} filterState={filterContains} onChange={toggleContain} onReset={() => setFilterContains(initial3State())} />}
                            {/* ブレードハート */}
                            <ButtonGroupFilter label="ブレードハート" options={BH_OPTIONS_LIVE} filterState={filterBladeHeart} onChange={toggleBladeHeart} styles={BH_STYLES} defaultStyle={BH_STYLES['None']} onReset={() => setFilterBladeHeart(initial3State())} />
                            {/* キーワード */}
                            {uniqueKeywords.length > 0 && <TagFilter label="キーワード" options={uniqueKeywords} filterState={filterKeywords} onChange={toggleKeyword} onReset={() => setFilterKeywords(initial3State())} />}
                            {/* グループ */}
                            <ButtonGroupFilter label="グループ" options={GROUP_OPTIONS} filterState={filterGroups} onChange={toggleGroup} styles={GROUP_STYLES} defaultStyle={GROUP_STYLES["μ's"]} onReset={() => setFilterGroups(initial3State())} />
                            {/* ハート数 */}
                            <ColorCountFilter label="ハート数" filterColors={filterColors} setFilterColors={setFilterColors} onReset={resetColors} />
                            {/* スコア */}
                            <RangeFilter label="スコア" minVal={numericFilters.score?.min||''} maxVal={numericFilters.score?.max||''} onMinChange={(v) => updateNumericFilter('score', 'min', v)} onMaxChange={(v) => updateNumericFilter('score', 'max', v)} onReset={() => setNumericFilters(p => ({...p, score: {min:'',max:''}}))} />
                            {/* 最大スコア */}
                            <RangeFilter label="最大スコア" minVal={numericFilters.maxScore?.min||''} maxVal={numericFilters.maxScore?.max||''} onMinChange={(v) => updateNumericFilter('maxScore', 'min', v)} onMaxChange={(v) => updateNumericFilter('maxScore', 'max', v)} onReset={() => setNumericFilters(p => ({...p, maxScore: {min:'',max:''}}))} />
                            {/* コスト */}
                            <RangeFilter label="コスト" minVal={numericFilters.req?.min||''} maxVal={numericFilters.req?.max||''} onMinChange={(v) => updateNumericFilter('req', 'min', v)} onMaxChange={(v) => updateNumericFilter('req', 'max', v)} onReset={() => setNumericFilters(p => ({...p, req: {min:'',max:''}}))} />
                            {/* 実質コスト */}
                            <RangeFilter label="実質コスト" minVal={numericFilters.effReq?.min||''} maxVal={numericFilters.effReq?.max||''} onMinChange={(v) => updateNumericFilter('effReq', 'min', v)} onMaxChange={(v) => updateNumericFilter('effReq', 'max', v)} onReset={() => setNumericFilters(p => ({...p, effReq: {min:'',max:''}}))} />
                            {/* 効率 */}
                            <RangeFilter label="効率" minVal={numericFilters.efficiency?.min||''} maxVal={numericFilters.efficiency?.max||''} onMinChange={(v) => updateNumericFilter('efficiency', 'min', v)} onMaxChange={(v) => updateNumericFilter('efficiency', 'max', v)} onReset={() => setNumericFilters(p => ({...p, efficiency: {min:'',max:''}}))} />
                        </>
                    )}

                    <button onClick={resetFilters} className="w-full py-2.5 mt-4 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"><Icons.Close /> Reset All Filters</button>
                </>
            )}
        </div>
    );
};

// アクティブフィルターのバッジ表示（ヘッダー部にスクロール表示される）
const ActiveFilterBadge = ({ label, onRemove, isExclude }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap ${isExclude ? 'bg-gray-800 text-gray-200 line-through' : 'bg-blue-100 text-blue-800'}`}>
        {label}
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className={`rounded-full p-0.5 ${isExclude ? 'hover:bg-gray-600 text-white' : 'hover:bg-blue-200'}`}><Icons.Close style={{width:10, height:10}} /></button>
    </span>
);
