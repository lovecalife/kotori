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

// ハート計算ツール
// 保存デッキを選ぶと下部にカード一覧が並び、そこからタップでスロットへ配置。
// ライブの必要ハートとメンバーの所持ハートを色ごとに集計し、差分を表示する。
const HEART_COLORS_LIVE = ['Pink', 'Red', 'Yellow', 'Green', 'Blue', 'Purple', 'Gray'];
const HEART_COLORS_MEMBER = ['Pink', 'Red', 'Yellow', 'Green', 'Blue', 'Purple'];
const HEART_LABEL = { Pink: 'ピンク', Red: 'レッド', Yellow: 'イエロー', Green: 'グリーン', Blue: 'ブルー', Purple: 'パープル', Gray: 'グレー' };
const heartNum = (v) => parseInt(v) || 0;

// 色●＋数値の1チップ（横並びサマリー部品）
const HeartChip = ({ color, value, highlight }) => (
    <span className="inline-flex items-center gap-1">
        <span className={`w-3.5 h-3.5 rounded-full ${(BH_STYLES[color] || BH_STYLES['None']).bg}`}></span>
        <span className={`text-sm font-bold ${highlight || 'text-gray-700'}`}>{value}</span>
    </span>
);

// スロット（カード配置枠・タップ配置）
const HeartSlot = ({ card, type, onClear, isHeld, onTap, width }) => {
    const isLive = type === 'live';
    const aspect = isLive ? 'aspect-[16/9]' : 'aspect-[3/4]';
    return (
        <div
            style={{ width }}
            className={`relative flex-shrink-0 ${aspect} rounded-lg border-2 border-dashed transition-colors ${
                card ? 'border-rose-200 bg-white' : 'border-rose-200 bg-rose-50/50'
            } ${isHeld ? 'cursor-pointer ring-2 ring-rose-400' : ''}`}
            onClick={() => { if (isHeld) onTap(); }}
        >
            {card ? (
                <>
                    <SafeImage
                        src={getImageUrl(card.image)}
                        alt={card.name}
                        className="w-full h-full object-contain p-0.5"
                        onError={(e) => {
                            if (!e.target.dataset.triedFallback) { e.target.dataset.triedFallback = 'true'; e.target.src = getFallbackUrl(card.image); }
                            else { e.target.src = 'https://placehold.co/400x600?text=No+Image'; }
                        }}
                    />
                    <button
                        onClick={(e) => { e.stopPropagation(); onClear(); }}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 z-10 shadow-lg transition-colors"
                        title="解除"
                    >
                        <Icons.Close style={{ width: 12, height: 12 }} />
                    </button>
                </>
            ) : (
                <div className="w-full h-full flex items-center justify-center text-rose-300">
                    <Icons.Image className="w-6 h-6 opacity-50" />
                </div>
            )}
        </div>
    );
};

const HeartCalcTool = ({ savedDecks, cardData, onSelectCard }) => {
    const deckEntries = Object.entries(savedDecks);
    const [deckId, setDeckId] = React.useState('');
    const [liveSlots, setLiveSlots] = React.useState([null, null, null]);
    const [memberSlots, setMemberSlots] = React.useState([null, null, null]);
    const [heldCard, setHeldCard] = React.useState(null); // { card, type }
    const [cardSize, setCardSize] = React.useState(92); // メンバー基準幅(px)

    const memberW = cardSize;
    const liveW = Math.round(cardSize * 1.55);

    // 選択デッキのカード一覧（パレット）
    const palette = React.useMemo(() => {
        const deck = savedDecks[deckId];
        if (!deck) return { member: [], live: [] };
        const build = (type) => {
            const dict = deck[type] || {};
            const arr = [];
            Object.entries(dict).forEach(([num, count]) => {
                const card = cardData[type].find(c => c.number === num);
                if (card) arr.push({ card, count });
            });
            arr.sort((a, b) => (parseInt(a.card.sortId) || Infinity) - (parseInt(b.card.sortId) || Infinity));
            return arr;
        };
        return { member: build('member'), live: build('live') };
    }, [deckId, savedDecks, cardData]);

    // 集計
    const stats = React.useMemo(() => {
        const liveHearts = {}; HEART_COLORS_LIVE.forEach(c => liveHearts[c] = 0);
        const memberHearts = {}; HEART_COLORS_MEMBER.forEach(c => memberHearts[c] = 0);
        let liveScore = 0, bladeTotal = 0;
        liveSlots.forEach(card => {
            if (!card) return;
            HEART_COLORS_LIVE.forEach(c => liveHearts[c] += heartNum(card[c]));
            liveScore += heartNum(card.score);
        });
        memberSlots.forEach(card => {
            if (!card) return;
            HEART_COLORS_MEMBER.forEach(c => memberHearts[c] += heartNum(card[c]));
            bladeTotal += heartNum(card.blade);
        });
        const liveTotal = HEART_COLORS_LIVE.reduce((s, c) => s + liveHearts[c], 0);
        const memberTotal = HEART_COLORS_MEMBER.reduce((s, c) => s + memberHearts[c], 0);
        // 足りないハート: 色ごとの不足のみ表示（＋表記なし）。余剰分は無色(Gray)要求から差し引く。
        const missingByColor = {};
        let surplus = 0;
        HEART_COLORS_MEMBER.forEach(c => {
            const diff = liveHearts[c] - memberHearts[c];
            missingByColor[c] = Math.max(0, diff);
            if (diff < 0) surplus += -diff;
        });
        const missingGray = Math.max(0, liveHearts['Gray'] - surplus);
        return { liveHearts, memberHearts, liveScore, bladeTotal, liveTotal, memberTotal, memberPlusBlade: memberTotal + bladeTotal, missingByColor, missingGray };
    }, [liveSlots, memberSlots]);

    // スロットへ格納するヘルパー（型一致時のみ）
    const placeCard = (setSlots, slotType, index, payload) => {
        if (!payload || payload.type !== slotType) return;
        setSlots(prev => { const next = [...prev]; next[index] = payload.card; return next; });
        setHeldCard(null);
    };
    const clearSlot = (setSlots, index) => setSlots(prev => { const next = [...prev]; next[index] = null; return next; });

    // パレットカード（タップ選択）
    const PaletteCard = ({ card, type, count }) => {
        const isLive = type === 'live';
        const held = heldCard && heldCard.card === card;
        return (
            <div
                onClick={() => setHeldCard(held ? null : { card, type })}
                style={{ width: isLive ? liveW : memberW }}
                className={`relative flex-shrink-0 cursor-pointer rounded overflow-hidden border ${held ? 'ring-2 ring-rose-500 border-rose-500' : 'border-gray-200'}`}
                title={card.name}
            >
                <div className={`${isLive ? 'aspect-[16/9]' : 'aspect-[3/4]'} bg-gray-100`}>
                    <SafeImage
                        src={getImageUrl(card.image)}
                        alt={card.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            if (!e.target.dataset.triedFallback) { e.target.dataset.triedFallback = 'true'; e.target.src = getFallbackUrl(card.image); }
                            else { e.target.src = 'https://placehold.co/400x600?text=No+Image'; }
                        }}
                    />
                </div>
                <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[10px] font-bold px-1 rounded-tl">×{count}</span>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* サイズ調整 */}
            <div className="flex items-center justify-end">
                <div className="flex items-center bg-white border border-gray-300 rounded px-1" title="カードサイズ調整">
                    <button onClick={() => setCardSize(s => Math.max(60, s - 16))} className="p-1.5 text-gray-500 hover:text-gray-800 transition-colors" title="小さく"><Icons.Minus style={{ width: 14, height: 14 }} /></button>
                    <span className="text-[10px] text-gray-400 select-none px-0.5">SIZE</span>
                    <button onClick={() => setCardSize(s => Math.min(160, s + 16))} className="p-1.5 text-gray-500 hover:text-gray-800 transition-colors" title="大きく"><Icons.Plus style={{ width: 14, height: 14 }} /></button>
                </div>
            </div>

            {/* ボード */}
            <div className="bg-rose-50/40 border border-rose-200 rounded-xl p-3 sm:p-4 space-y-4">
                {/* 足りないハート（最上部・横並び） */}
                <div className="bg-white border border-gray-300 rounded-lg p-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-xs font-bold text-gray-700 mr-1">足りないハート</span>
                    {HEART_COLORS_MEMBER.map(c => (
                        <HeartChip key={c} color={c} value={stats.missingByColor[c]} highlight={stats.missingByColor[c] > 0 ? 'text-red-600' : 'text-green-600'} />
                    ))}
                    <HeartChip color="Gray" value={stats.missingGray} highlight={stats.missingGray > 0 ? 'text-red-600' : 'text-green-600'} />
                    <span className="mx-1 h-4 w-px bg-gray-200"></span>
                    <span className="text-base font-bold text-indigo-600">ブレード:{stats.bladeTotal}</span>
                </div>

                {/* ライブ置き場（集計対象） */}
                <div>
                    <div className="text-xs font-bold text-rose-600 mb-1">ライブカード置き場（集計対象・最大3）</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
                        {HEART_COLORS_LIVE.map(c => <HeartChip key={c} color={c} value={stats.liveHearts[c]} />)}
                        <span className="mx-1 h-4 w-px bg-gray-200"></span>
                        <span className="text-sm font-bold text-gray-700">ハート合計:{stats.liveTotal}</span>
                        <span className="text-sm font-bold text-pink-600">スコア:{stats.liveScore}</span>
                    </div>
                    <div className="flex gap-2">
                        {liveSlots.map((card, i) => (
                            <HeartSlot key={i} card={card} type="live" width={liveW}
                                onClear={() => clearSlot(setLiveSlots, i)}
                                isHeld={!!heldCard && heldCard.type === 'live'}
                                onTap={() => placeCard(setLiveSlots, 'live', i, heldCard)}
                            />
                        ))}
                    </div>
                </div>

                {/* メンバーエリア（集計対象） */}
                <div>
                    <div className="text-xs font-bold text-blue-600 mb-1">メンバーエリア（集計対象・最大3）</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-2">
                        {HEART_COLORS_MEMBER.map(c => <HeartChip key={c} color={c} value={stats.memberHearts[c]} />)}
                        <span className="mx-1 h-4 w-px bg-gray-200"></span>
                        <span className="text-base font-bold text-indigo-600">ブレード:{stats.bladeTotal}</span>
                        <span className="text-base font-bold text-gray-700">ハート合計:{stats.memberTotal}</span>
                        <span className="text-base font-bold text-blue-600">総スタッツ:{stats.memberPlusBlade}</span>
                    </div>
                    <div className="flex gap-2">
                        {memberSlots.map((card, i) => (
                            <HeartSlot key={i} card={card} type="member" width={liveW}
                                onClear={() => clearSlot(setMemberSlots, i)}
                                isHeld={!!heldCard && heldCard.type === 'member'}
                                onTap={() => placeCard(setMemberSlots, 'member', i, heldCard)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* デッキ選択＋パレット */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
                <div className="flex items-center gap-2 mb-3">
                    <label className="text-xs font-bold text-gray-500 flex-shrink-0">デッキ選択</label>
                    <select value={deckId} onChange={e => setDeckId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400">
                        <option value="">-- 選択 --</option>
                        {deckEntries.map(([id, d]) => <option key={id} value={id}>{d.name}</option>)}
                    </select>
                </div>
                {!deckId ? (
                    <div className="text-center text-gray-400 text-xs py-6">デッキを選択するとカード一覧が表示されます。カードをタップして選択し、配置したい枠をタップしてください。</div>
                ) : (
                    <div className="space-y-3">
                        {palette.member.length > 0 && (
                            <div>
                                <div className="text-[10px] font-bold text-blue-500 mb-1">メンバー</div>
                                <div className="flex gap-2 flex-wrap">
                                    {palette.member.map((e, i) => <PaletteCard key={`m-${e.card.number}-${i}`} card={e.card} type="member" count={e.count} />)}
                                </div>
                            </div>
                        )}
                        {palette.live.length > 0 && (
                            <div>
                                <div className="text-[10px] font-bold text-rose-500 mb-1">ライブ</div>
                                <div className="flex gap-2 flex-wrap">
                                    {palette.live.map((e, i) => <PaletteCard key={`l-${e.card.number}-${i}`} card={e.card} type="live" count={e.count} />)}
                                </div>
                            </div>
                        )}
                        {palette.member.length === 0 && palette.live.length === 0 && (
                            <div className="text-center text-gray-400 text-xs py-4">このデッキにはカードがありません。</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// ツール container（拡張可能）
// 今後ツールを追加する場合は TOOLS 配列にエントリを足すだけでよい
const ToolsPanel = ({ savedDecks, cardData, onSelectCard }) => {
    const TOOLS = [
        { id: 'compare', label: 'デッキ比較', render: (p) => <DeckCompareTool {...p} /> },
        { id: 'heart', label: 'ハート計算', render: (p) => <HeartCalcTool {...p} /> }
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
