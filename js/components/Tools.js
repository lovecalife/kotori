// ==========================================
// Tools Panel（各種ツール）
// ==========================================

// デッキ比較ツール
// 保存済みデッキ2つを選び、「デッキAのみ / 共通 / デッキBのみ」に振り分けて表示する
const DeckCompareTool = ({ savedDecks, cardData, onSelectCard }) => {
    const deckEntries = Object.entries(savedDecks);
    const [idA, setIdA] = React.useState('');
    const [idB, setIdB] = React.useState('');

    const swap = () => { setIdA(idB); setIdB(idA); };

    const comparison = React.useMemo(() => {
        const A = savedDecks[idA];
        const B = savedDecks[idB];
        if (!A || !B) return null;

        const result = {
            onlyA: { member: [], live: [] },
            common: { member: [], live: [] },
            onlyB: { member: [], live: [] }
        };
        const totals = {
            onlyA: { member: 0, live: 0 },
            common: { member: 0, live: 0 },
            onlyB: { member: 0, live: 0 }
        };

        ['member', 'live'].forEach(type => {
            const aDict = A[type] || {};
            const bDict = B[type] || {};
            const nums = new Set([...Object.keys(aDict), ...Object.keys(bDict)]);
            nums.forEach(num => {
                const ca = aDict[num] || 0;
                const cb = bDict[num] || 0;
                const common = Math.min(ca, cb);
                const onlyA = ca - common;
                const onlyB = cb - common;
                const card = cardData[type].find(c => c.number === num);
                if (!card) return;
                if (onlyA > 0) { result.onlyA[type].push({ card, count: onlyA }); totals.onlyA[type] += onlyA; }
                if (common > 0) { result.common[type].push({ card, count: common }); totals.common[type] += common; }
                if (onlyB > 0) { result.onlyB[type].push({ card, count: onlyB }); totals.onlyB[type] += onlyB; }
            });
        });

        // 各エリア内を sortId 昇順で整列
        const sortArea = (arr) => arr.sort((x, y) => {
            const ix = parseInt(x.card.sortId) || Infinity;
            const iy = parseInt(y.card.sortId) || Infinity;
            return ix - iy;
        });
        ['onlyA', 'common', 'onlyB'].forEach(area => {
            sortArea(result[area].member);
            sortArea(result[area].live);
        });

        return { result, totals, nameA: A.name, nameB: B.name };
    }, [idA, idB, savedDecks, cardData]);

    if (deckEntries.length < 2) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-700 text-sm">
                デッキ比較には保存済みデッキが2つ以上必要です。<br />
                「デッキ」タブでデッキを2つ以上保存してください。
            </div>
        );
    }

    // 1エリアの描画
    const renderArea = (areaKey, title, headerColor, totals) => {
        const area = comparison.result[areaKey];
        const memberTotal = totals.member;
        const liveTotal = totals.live;
        const isEmpty = area.member.length === 0 && area.live.length === 0;
        return (
            <div className="flex-1 min-w-0 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className={`px-3 py-2 border-b ${headerColor}`}>
                    <div className="font-bold text-sm">{title}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                        メンバー計 <span className="font-bold text-gray-700">{memberTotal}</span>
                        <span className="mx-1">/</span>
                        ライブ計 <span className="font-bold text-gray-700">{liveTotal}</span>
                    </div>
                </div>
                <div className="p-2 space-y-3">
                    {isEmpty ? (
                        <div className="text-center text-gray-400 text-xs py-6">なし</div>
                    ) : (
                        <>
                            {area.member.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-bold text-blue-500 mb-1">メンバー</div>
                                    <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                        {area.member.map((e, i) => (
                                            <CompactCardItem key={`m-${e.card.number}-${i}`} item={e.card} deckCount={e.count} onSelect={onSelectCard} cols={4} />
                                        ))}
                                    </div>
                                </div>
                            )}
                            {area.live.length > 0 && (
                                <div>
                                    <div className="text-[10px] font-bold text-pink-500 mb-1">ライブ</div>
                                    <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                        {area.live.map((e, i) => (
                                            <CompactCardItem key={`l-${e.card.number}-${i}`} item={e.card} deckCount={e.count} onSelect={onSelectCard} cols={3} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* デッキ選択 */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">デッキA</label>
                        <select value={idA} onChange={e => setIdA(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">-- 選択 --</option>
                            {deckEntries.map(([id, d]) => <option key={id} value={id}>{d.name}</option>)}
                        </select>
                    </div>
                    <button onClick={swap} title="A↔B 入れ替え" className="flex-shrink-0 px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded text-gray-600 transition-colors self-center">
                        <Icons.Refresh style={{ width: 16, height: 16 }} />
                    </button>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-500 mb-1">デッキB</label>
                        <select value={idB} onChange={e => setIdB(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500">
                            <option value="">-- 選択 --</option>
                            {deckEntries.map(([id, d]) => <option key={id} value={id}>{d.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* 比較結果 */}
            {!comparison ? (
                <div className="text-center text-gray-400 text-sm py-10">
                    比較する2つのデッキを選択してください。
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row gap-3">
                    {renderArea('onlyA', `デッキAのみ（${comparison.nameA}）`, 'bg-blue-50 text-blue-700', comparison.totals.onlyA)}
                    {renderArea('common', '共通', 'bg-gray-100 text-gray-700', comparison.totals.common)}
                    {renderArea('onlyB', `デッキBのみ（${comparison.nameB}）`, 'bg-pink-50 text-pink-700', comparison.totals.onlyB)}
                </div>
            )}
        </div>
    );
};

// ツール container（拡張可能）
// 今後ツールを追加する場合は TOOLS 配列にエントリを足すだけでよい
const ToolsPanel = ({ savedDecks, cardData, onSelectCard }) => {
    const TOOLS = [
        { id: 'compare', label: 'デッキ比較', render: (p) => <DeckCompareTool {...p} /> }
    ];
    const [activeTool, setActiveTool] = React.useState('compare');
    const tool = TOOLS.find(t => t.id === activeTool) || TOOLS[0];

    return (
        <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
                {TOOLS.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTool(t.id)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors border ${
                            activeTool === t.id
                                ? 'bg-gray-800 text-white border-gray-800 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {tool.render({ savedDecks, cardData, onSelectCard })}
        </div>
    );
};
