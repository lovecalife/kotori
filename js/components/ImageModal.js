// ==========================================
// Image Modal (フルスクリーン画像表示)
// ==========================================

// カードをクリックしたときに表示されるフルスクリーンモーダル
// 前後ナビゲーション・デッキ操作が可能
const ImageModal = ({ selectedItem, onClose, sourceList, deckCount, onAdd, onRemove }) => {
    const currentIndex = sourceList.findIndex(item => item === selectedItem);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex >= 0 && currentIndex < sourceList.length - 1;

    const handlePrev = (e) => { e.stopPropagation(); if (hasPrev) onClose(sourceList[currentIndex - 1]); };
    const handleNext = (e) => { e.stopPropagation(); if (hasNext) onClose(sourceList[currentIndex + 1]); };

    const isLive = selectedItem._type === 'live';

    // 下半分拡大モード
    const [showBottomHalf, setShowBottomHalf] = React.useState(false);

    const handleImageError = (e) => {
        if (!e.target.dataset.triedFallback) {
            e.target.dataset.triedFallback = "true";
            e.target.src = getFallbackUrl(selectedItem.image);
        } else {
            e.target.src = 'https://placehold.co/400x600?text=No+Image';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 p-4 sm:p-8" onClick={() => onClose(null)}>
            <div className="flex flex-col items-center w-full h-full max-w-6xl">

                <div className="flex-1 min-h-0 w-full flex items-center justify-center mb-2">
                    {showBottomHalf ? (
                        // 下半分拡大: アスペクト比を元の半分にしたコンテナに画像をbottomアンカーで配置
                        // → 上半分がoverflow:hiddenでクリップされ、下半分が2倍スケールに見える
                        <div
                            className="relative overflow-hidden rounded-lg shadow-2xl bg-white/5"
                            style={{
                                aspectRatio: isLive ? '32/9' : '3/2',
                                maxHeight: '100%',
                                width: '100%',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={getImageUrl(selectedItem.image)}
                                alt={selectedItem.name}
                                style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 'auto' }}
                                onError={handleImageError}
                            />
                        </div>
                    ) : (
                        <SafeImage
                            src={getImageUrl(selectedItem.image)}
                            alt={selectedItem.name}
                            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl bg-white/5"
                            onError={handleImageError}
                        />
                    )}
                </div>

                {/* 下半分拡大トグルボタン */}
                <div className="flex-shrink-0 mb-3" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => setShowBottomHalf(b => !b)}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
                            showBottomHalf
                                ? 'bg-blue-500 text-white border-blue-400 shadow-lg shadow-blue-900/40'
                                : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
                        }`}
                        title={showBottomHalf ? 'カード全体を表示' : '下半分を拡大してテキストを読む'}
                    >
                        <Icons.Maximize style={{width:13, height:13}} />
                        {showBottomHalf ? '全体表示' : 'テキスト拡大'}
                    </button>
                </div>

                <div className="flex-shrink-0 w-full flex flex-col items-center">
                    <h3 className="text-white text-xl sm:text-2xl font-bold mb-4 text-center px-4 leading-tight">{selectedItem.name}</h3>

                    {!isLive ? (
                        <div className="flex justify-center items-center gap-6 sm:gap-8 text-base bg-white/10 px-8 py-3 sm:py-4 rounded-xl backdrop-blur-sm mx-auto mb-6">
                            <div className="text-center"><span className="block text-white/50 text-xs uppercase mb-1">Cost</span><span className="text-2xl sm:text-3xl font-bold text-white">{selectedItem.cost}</span></div>
                            <div className="w-px h-10 sm:h-12 bg-white/20"></div>
                            <div className="text-center"><span className="block text-white/50 text-xs uppercase mb-1">Base / Max</span><div className="text-xl sm:text-2xl font-bold text-white">{selectedItem.baseStats} <span className="text-white/30">/</span> <span className="text-blue-300">{selectedItem.maxStats}</span></div></div>
                        </div>
                    ) : (
                        <div className="flex justify-center items-center gap-6 sm:gap-8 text-base bg-white/10 px-8 py-3 sm:py-4 rounded-xl backdrop-blur-sm mx-auto mb-6">
                            <div className="text-center"><span className="block text-white/50 text-xs uppercase mb-1">Score</span><span className="text-2xl sm:text-3xl font-bold text-pink-300">{selectedItem.score}/{selectedItem.maxScore}</span></div>
                            <div className="w-px h-10 sm:h-12 bg-white/20"></div>
                            <div className="text-center"><span className="block text-white/50 text-xs uppercase mb-1">Cost</span><span className="text-xl sm:text-2xl font-bold text-white">{selectedItem.req}/{selectedItem.effReq}</span></div>
                        </div>
                    )}

                    <div className="flex items-center justify-center w-full max-w-[480px] gap-6 px-2 pb-2 sm:pb-4">
                        <button
                            onClick={handlePrev}
                            disabled={!hasPrev}
                            className={`flex items-center justify-center p-4 sm:p-5 rounded-full transition-all ${hasPrev ? 'text-white bg-white/10 hover:bg-white/20' : 'text-white/10 bg-transparent cursor-not-allowed'}`}
                        >
                            <Icons.ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
                        </button>

                        <div className="flex items-center gap-4 sm:gap-6 bg-white/10 rounded-full p-2 sm:p-3 backdrop-blur-md">
                            <button onClick={(e) => onRemove(e, selectedItem)} disabled={deckCount === 0} className={`p-3 sm:p-4 rounded-full transition-colors ${deckCount === 0 ? 'text-white/20' : 'text-white hover:text-red-400 bg-white/10 hover:bg-white/20'}`}>
                                <Icons.Minus className="w-6 h-6 sm:w-8 sm:h-8"/>
                            </button>
                            <span className="text-white text-2xl sm:text-3xl font-bold min-w-[48px] text-center">{deckCount}/4</span>
                            <button onClick={(e) => onAdd(e, selectedItem)} disabled={deckCount >= 4} className={`p-3 sm:p-4 rounded-full transition-colors ${deckCount >= 4 ? 'text-white/20 cursor-not-allowed' : 'text-white hover:text-green-400 bg-white/10 hover:bg-white/20'}`}>
                                <Icons.Plus className="w-6 h-6 sm:w-8 sm:h-8"/>
                            </button>
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={!hasNext}
                            className={`flex items-center justify-center p-4 sm:p-5 rounded-full transition-all ${hasNext ? 'text-white bg-white/10 hover:bg-white/20' : 'text-white/10 bg-transparent cursor-not-allowed'}`}
                        >
                            <Icons.ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
