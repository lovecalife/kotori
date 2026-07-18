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
// 保存デッキを選ぶと下部にカード一覧が並び、そこから各エリアへD&Dで配置。
// ライブの必要ハートとメンバーの所持ハートを色ごとに集計し、差分を表示する。
const HEART_COLORS_LIVE = ['Pink', 'Red', 'Yellow', 'Green', 'Blue', 'Purple', 'Gray'];
const HEART_COLORS_MEMBER = ['Pink', 'Red', 'Yellow', 'Green', 'Blue', 'Purple'];
const HEART_LABEL = { Pink: 'ピンク', Red: 'レッド', Yellow: 'イエロー', Green: 'グリーン', Blue: 'ブルー', Purple: 'パープル', Gray: 'グレー' };
const heartNum = (v) => parseInt(v) || 0;

// スロット（カード配置枠）
const HeartSlot = ({ card, type, onDrop, onClear, isHeld, onTap }) => {
    const [over, setOver] = React.useState(false);
    const isLive = type === 'live';
    const aspect = isLive ? 'aspect-[16/9]' : 'aspect-[3/4]';
    return (
        <div
            className={`relative ${aspect} rounded-lg border-2 border-dashed transition-colors ${
                over ? 'border-rose-400 bg-rose-100' : card ? 'border-rose-200 bg-white' : 'border-rose-200 bg-rose-50/50'
            } ${isHeld ? 'cursor-pointer ring-2 ring-rose-400' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(); }}
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
    const [extraLiveSlots, setExtraLiveSlots] = React.useState([null, null, null]);
    const [heldCard, setHeldCard] = React.useState(null); // { card, type }
    const dragCardRef = React.useRef(null);

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
        return { liveHearts, memberHearts, liveScore, bladeTotal, liveTotal, memberTotal, missingTotal: liveTotal - memberTotal };
    }, [liveSlots, memberSlots]);

    // スロットへ格納するヘルパー（型一致時のみ）
    const placeCard = (setSlots, slotType, index, payload) => {
        if (!payload || payload.type !== slotType) return;
        setSlots(prev => { const next = [...prev]; next[index] = payload.card; return next; });
        setHeldCard(null);
    };
    const clearSlot = (setSlots, index) => setSlots(prev => { const next = [...prev]; next[index] = null; return next; });

    // パレットカード（D&D元・タップ選択）
    const PaletteCard = ({ card, type, count }) => {
        const isLive = type === 'live';
        const held = heldCard && heldCard.card === card;
        return (
            <div
                draggable
                onDragStart={() => { dragCardRef.current = { card, type }; }}
                onClick={() => setHeldCard(held ? null : { card, type })}
                className={`relative flex-shrink-0 ${isLive ? 'w-28' : 'w-16'} cursor-grab active:cursor-grabbing rounded overflow-hidden border ${held ? 'ring-2 ring-rose-500 border-rose-500' : 'border-gray-200'}`}
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

    // 色別ハート行
    const HeartRow = ({ color, value, highlight }) => (
        <div className="flex items-center justify-between text-xs py-0.5">
            <span className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-full ${(BH_STYLES[color] || BH_STYLES['None']).bg}`}></span>
                {HEART_LABEL[color]}
            </span>
            <span className={`font-bold ${highlight || 'text-gray-700'}`}>{value}</span>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* ボード */}
            <div className="bg-rose-50/40 border border-rose-200 rounded-xl p-3 sm:p-4 space-y-4">
                {/* ライブ置き場（集計対象） */}
                <div>
                    <div className="text-xs font-bold text-rose-600 mb-1.5">ライブカード置き場（集計対象・最大3）</div>
                    <div className="grid grid-cols-3 gap-2">
                        {liveSlots.map((card, i) => (
                            <HeartSlot key={i} card={card} type="live"
                                onDrop={() => placeCard(setLiveSlots, 'live', i, dragCardRef.current)}
                                onClear={() => clearSlot(setLiveSlots, i)}
                                isHeld={!!heldCard && heldCard.type === 'live'}
                                onTap={() => placeCard(setLiveSlots, 'live', i, heldCard)}
                            />
                        ))}
                    </div>
                </div>
                {/* メンバーエリア（集計対象） */}
                <div>
                    <div className="text-xs font-bold text-blue-600 mb-1.5">メンバーエリア（集計対象・最大3）</div>
                    <div className="grid grid-cols-3 gap-2">
                        {memberSlots.map((card, i) => (
                            <HeartSlot key={i} card={card} type="member"
                                onDrop={() => placeCard(setMemberSlots, 'member', i, dragCardRef.current)}
                                onClear={() => clearSlot(setMemberSlots, i)}
                                isHeld={!!heldCard && heldCard.type === 'member'}
                                onTap={() => placeCard(setMemberSlots, 'member', i, heldCard)}
                            />
                        ))}
                    </div>
                </div>
                {/* 成功ライブ置き場（集計外） */}
                <div>
                    <div className="text-xs font-bold text-gray-500 mb-1.5">成功ライブカード置き場（集計外・任意）</div>
                    <div className="grid grid-cols-3 gap-2">
                        {extraLiveSlots.map((card, i) => (
                            <HeartSlot key={i} card={card} type="live"
                                onDrop={() => placeCard(setExtraLiveSlots, 'live', i, dragCardRef.current)}
                                onClear={() => clearSlot(setExtraLiveSlots, i)}
                                isHeld={!!heldCard && heldCard.type === 'live'}
                                onTap={() => placeCard(setExtraLiveSlots, 'live', i, heldCard)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* 集計パネル */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* ライブ必要ハート */}
                <div className="bg-white rounded-lg border border-rose-200 shadow-sm p-3">
                    <div className="font-bold text-sm text-rose-700 border-b border-rose-100 pb-1.5 mb-2">ライブ必要ハート</div>
                    {HEART_COLORS_LIVE.map(c => <HeartRow key={c} color={c} value={stats.liveHearts[c]} />)}
                    <div className="flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-rose-100">
                        <span className="text-gray-500">スコア合計</span><span className="font-bold text-pink-600">{stats.liveScore}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1 mt-1">
                        <span className="font-bold text-gray-700">ハート総合計</span><span className="font-bold text-rose-700">{stats.liveTotal}</span>
                    </div>
                </div>
                {/* メンバー所持ハート */}
                <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-3">
                    <div className="font-bold text-sm text-blue-700 border-b border-blue-100 pb-1.5 mb-2">メンバー所持ハート</div>
                    {HEART_COLORS_MEMBER.map(c => <HeartRow key={c} color={c} value={stats.memberHearts[c]} />)}
                    <div className="flex items-center justify-between text-xs pt-1.5 mt-1.5 border-t border-blue-100">
                        <span className="text-gray-500">ブレード合計</span><span className="font-bold text-indigo-600">{stats.bladeTotal}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1 mt-1">
                        <span className="font-bold text-gray-700">ハート総合計</span><span className="font-bold text-blue-700">{stats.memberTotal}</span>
                    </div>
                </div>
                {/* 足りないハート */}
                <div className="bg-white rounded-lg border border-gray-300 shadow-sm p-3">
                    <div className="font-bold text-sm text-gray-700 border-b border-gray-100 pb-1.5 mb-2">足りないハート</div>
                    {HEART_COLORS_MEMBER.map(c => {
                        const diff = stats.liveHearts[c] - stats.memberHearts[c];
                        return <HeartRow key={c} color={c} value={diff > 0 ? diff : `+${-diff}`} highlight={diff > 0 ? 'text-red-600' : 'text-green-600'} />;
                    })}
                    <HeartRow color="Gray" value={stats.liveHearts['Gray']} highlight={stats.liveHearts['Gray'] > 0 ? 'text-red-600' : 'text-green-600'} />
                    <div className="flex items-center justify-between text-sm pt-1.5 mt-1.5 border-t border-gray-100">
                        <span className="font-bold text-gray-700">総合計</span>
                        <span className={`font-bold ${stats.missingTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>{stats.missingTotal > 0 ? stats.missingTotal : `+${-stats.missingTotal}`}</span>
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
                    <div className="text-center text-gray-400 text-xs py-6">デッキを選択するとカード一覧が表示されます。カードを各エリアにドラッグ＆ドロップ（またはタップで選択→枠をタップ）で配置してください。</div>
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
