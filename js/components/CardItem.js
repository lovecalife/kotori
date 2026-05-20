// ==========================================
// Card Item Components
// ==========================================

// 検討中カード（デッキから外れたカードのホールド表示）
// Xボタンで削除、+ボタンでデッキに戻す
const ConsiderationCardItem = ({ item, onRemove, onAdd, isCompact = false }) => {
    const isLive = item._type === 'live';
    return (
        <div className="relative group" title={item.name}>
            <div className={`relative w-full ${isLive ? 'aspect-[16/9]' : 'aspect-[3/4]'} rounded overflow-hidden bg-gray-200`}>
                {item.image ? (
                    <SafeImage
                        src={getImageUrl(item.image)}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            if (!e.target.dataset.triedFallback) {
                                e.target.dataset.triedFallback = "true";
                                e.target.src = getFallbackUrl(item.image);
                            } else {
                                e.target.src = 'https://placehold.co/400x600?text=No+Image';
                            }
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 text-[8px]">No Img</div>
                )}
                {/* デッキに戻すボタン（コンパクトビューでは非表示） */}
                {!isCompact && (
                    <button
                        onClick={() => onAdd(item)}
                        className="absolute bottom-1.5 right-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full p-1.5 transition-colors shadow-lg z-10"
                        title="デッキに戻す"
                    >
                        <Icons.Plus style={{width: 16, height: 16}} />
                    </button>
                )}
            </div>
            {/* 削除ボタン（右上・コンパクトビューでは非表示） */}
            {!isCompact && (
                <button
                    onClick={() => onRemove(item)}
                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 z-20 transition-colors shadow-lg"
                    title="検討リストから削除"
                >
                    <Icons.Close style={{width: 14, height: 14}} />
                </button>
            )}
        </div>
    );
};

// コンパクトビュー用（デッキタブのみ）
// カード画像とデッキ枚数だけを表示する小型ビュー
const CompactCardItem = ({ item, deckCount, onSelect, cols = 8 }) => {
    const isLive = item._type === 'live';
    // バッジサイズ: min(px上限, vw基準) でモバイルでも破綻しない
    // vwはビューポート幅に対する割合 → カード幅 ≈ 100vw/cols なので
    // フォントをカード幅の約22%、パディングも比例させる
    const fsPx = Math.min(26, Math.round(192 / cols));          // デスクトップ上限
    const fsVw = ((100 / cols) * 0.22).toFixed(2);              // カード幅の22% in vw
    const phPx = Math.min(11, Math.round(88 / cols));
    const phVw = ((100 / cols) * 0.09).toFixed(2);
    const pvPx = Math.min(8,  Math.round(56 / cols));
    const pvVw = ((100 / cols) * 0.06).toFixed(2);
    return (
        <div className="relative group cursor-pointer flex flex-col items-center z-10 hover:z-40" onClick={() => item.image && onSelect(item)}>
            <div className={`relative w-full ${isLive ? 'aspect-[16/9]' : 'aspect-[3/4]'} rounded-sm overflow-hidden bg-gray-200 transition-transform duration-300 group-hover:scale-105`}>
                {item.image ? (
                    <SafeImage
                        src={getImageUrl(item.image)}
                        alt={item.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                            if (!e.target.dataset.triedFallback) {
                                e.target.dataset.triedFallback = "true";
                                e.target.src = getFallbackUrl(item.image);
                            } else {
                                e.target.src = 'https://placehold.co/400x600?text=No+Image';
                            }
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 text-[8px]">No Img</div>
                )}
            </div>
            <div
                className="absolute bottom-0 right-0 font-bold rounded-tl z-30 pointer-events-none"
                style={{
                    fontSize: `min(${fsPx}px, ${fsVw}vw)`,
                    padding: `min(${pvPx}px, ${pvVw}vw) min(${phPx}px, ${phVw}vw)`,
                    background: 'rgba(0,0,0,0.52)',
                    color: '#ffffff'
                }}
            >
                {deckCount}
            </div>
        </div>
    );
};

// グリッド / リスト共用カードコンポーネント
// asGrid=true でカードグリッド表示、false でテーブル行として描画
const CardItem = ({ item, deckCount, onAdd, onRemove, onSelect, abilitiesList, asGrid = true }) => {
    const isLive = item._type === 'live';

    const handleImageError = (e) => {
        if (!e.target.dataset.triedFallback) {
            e.target.dataset.triedFallback = "true";
            e.target.src = getFallbackUrl(item.image);
        } else {
            e.target.src = 'https://placehold.co/400x600?text=No+Image';
        }
    };

    // アビリティタグの色をリスト内インデックスから決定
    const AbilityTags = ({ className }) => (
        <>
            {item.ability && item.ability.split(/[,、\s]+/).map((a, i) => {
                const ta = a.trim();
                if (!ta) return null;
                const ci = abilitiesList.indexOf(ta);
                const fi = ta.split('').reduce((x, y) => x + y.charCodeAt(0), 0);
                return <span key={i} className={`${className} ${getTagColor(ci !== -1 ? ci : fi).base}`}>{ta}</span>;
            })}
        </>
    );

    if (!asGrid) {
        return (
            <tr className="hover:bg-gray-50">
                <td className="px-3 py-2">
                    <div className="h-10 w-10 cursor-pointer relative" onClick={() => item.image && onSelect(item)}>
                        {item.image
                            ? <SafeImage src={getImageUrl(item.image)} className="h-10 w-10 rounded object-cover" onError={handleImageError} />
                            : <div className="h-10 w-10 rounded bg-gray-200"></div>
                        }
                    </div>
                </td>
                <td className="px-3 py-2 text-gray-500">{item.number}</td>
                <td className="px-3 py-2 font-medium">{item.name}</td>
                <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 whitespace-nowrap">{item.group}</span></td>
                <td className="px-3 py-2 hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                        <AbilityTags className="px-1 rounded" />
                    </div>
                </td>
                {!isLive ? (
                    <>
                        <td className="px-3 py-2">{item.cost}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{item.baseStats}/{item.maxStats}</td>
                    </>
                ) : (
                    <>
                        <td className="px-3 py-2 font-bold text-pink-600">{item.score}/{item.maxScore}</td>
                        <td className="px-3 py-2">{item.req}/{item.effReq}</td>
                    </>
                )}
                <td className="px-3 py-2">
                    <div className="flex items-center gap-2 bg-gray-100 rounded-full px-2 py-1 w-max ml-auto">
                        <button onClick={(e) => onRemove(e, item)} disabled={deckCount === 0} className={`p-1.5 rounded-full transition-colors ${deckCount === 0 ? 'text-gray-300' : 'text-gray-700 hover:bg-white hover:text-red-500 shadow-sm'}`}><Icons.Minus className="w-4 h-4"/></button>
                        <span className="text-sm font-bold w-4 text-center">{deckCount}</span>
                        <button onClick={(e) => onAdd(e, item)} disabled={deckCount >= 4} className={`p-1.5 rounded-full transition-colors ${deckCount >= 4 ? 'text-gray-300' : 'text-gray-700 hover:bg-white hover:text-green-500 shadow-sm'}`}><Icons.Plus className="w-4 h-4"/></button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <div className="relative z-10 hover:z-40 bg-white rounded-lg card-shadow overflow-hidden flex flex-col h-full border border-gray-100 text-[10px] md:text-xs">
            <div
                className={`relative w-full bg-gray-100 group cursor-pointer ${isLive ? 'aspect-[16/9]' : 'aspect-[3/4]'}`}
                onClick={() => item.image && onSelect(item)}
            >
                <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1.5 z-20 pointer-events-none">
                    {item.group && (
                        <span className="bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm text-[9px] md:text-[10px] truncate max-w-[80px] md:max-w-[100px] shadow-sm">
                            {item.group}
                        </span>
                    )}

                    <div className="flex items-center gap-1.5 bg-black/70 rounded-full p-1 backdrop-blur-md border border-white/10 shadow-md pointer-events-auto" onClick={e => e.stopPropagation()}>
                        {deckCount > 0 && (
                            <>
                                <button onClick={(e) => onRemove(e, item)} className="text-white hover:text-red-400 p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors"><Icons.Minus className="w-4 h-4 md:w-5 md:h-5"/></button>
                                <span className="text-white text-xs md:text-sm font-bold px-1 min-w-[24px] text-center">{deckCount}/4</span>
                            </>
                        )}
                        <button
                            onClick={(e) => onAdd(e, item)}
                            className={`p-1.5 rounded-full transition-colors ${deckCount >= 4 ? 'text-gray-500 bg-black/40 cursor-not-allowed' : 'text-white hover:text-green-400 bg-white/10 hover:bg-white/20'}`}
                            disabled={deckCount >= 4}
                        >
                            <Icons.Plus className="w-4 h-4 md:w-5 md:h-5"/>
                        </button>
                    </div>
                </div>

                {item.image ? (
                    <SafeImage
                        src={getImageUrl(item.image)}
                        alt={item.name}
                        className="w-full h-full object-contain p-1 transition-transform duration-500 md:group-hover:scale-105"
                        onError={handleImageError}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100"><Icons.Image className="w-8 h-8 opacity-50" /></div>
                )}
            </div>

            <div className="p-2 flex-1 flex flex-col gap-1 pointer-events-none">
                <h3 className="font-bold text-gray-800 leading-tight truncate mb-0.5" title={item.name}>{item.name || 'Untitled'}</h3>
                <div className="flex flex-wrap gap-0.5 max-h-6 overflow-hidden mb-1">
                    <AbilityTags className="px-1 py-0 rounded border border-black/5 whitespace-nowrap" style={{fontSize:'9px'}} />
                </div>
                <div className="mt-auto">
                    {!isLive ? (
                        <div className="pt-1 border-t border-dashed border-gray-100 flex justify-between items-end">
                            <div className="flex flex-col"><span className="text-[9px] text-gray-400 uppercase leading-none mb-0.5">Cost</span><span className="text-sm font-bold text-gray-700 leading-none">{item.cost}</span></div>
                            <div className="flex flex-col items-end"><span className="text-[9px] text-gray-400 uppercase leading-none mb-0.5">Stats (B/M)</span><div className="font-bold text-gray-700 leading-none bg-gray-50 px-1 py-0.5 rounded">{item.baseStats||'-'}<span className="text-gray-300 mx-0.5">/</span><span className="text-blue-600">{item.maxStats||'-'}</span></div></div>
                        </div>
                    ) : (
                        <div className="pt-1.5 border-t border-dashed border-gray-100 space-y-1">
                            <div className="flex justify-between items-center"><span className="text-[9px] text-gray-400 uppercase">Score</span><span className="text-[10px] font-bold text-pink-600">{item.score||'-'} <span className="text-gray-300">/</span> {item.maxScore||'-'}</span></div>
                            <div className="flex justify-between items-center"><span className="text-[9px] text-gray-400 uppercase">Cost</span><span className="text-[10px] font-bold text-gray-700">{item.req||'-'} <span className="text-gray-300">/</span> {item.effReq||'-'}</span></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
