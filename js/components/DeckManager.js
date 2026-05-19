// ==========================================
// Deck Manager Panel
// ==========================================

// デッキの保存・読み込み・エクスポート/インポートを管理するパネル
// アコーディオン形式で展開・格納できる
const DeckManagerPanel = ({
    isDeckManagerOpen, setIsDeckManagerOpen,
    savedDecks, selectedDeckId, deckNameInput,
    ioText, setIoText, setDeckNameInput,
    onSelectSavedDeck, onSaveDeck, onLoadDeck, onDeleteDeck,
    onExportFile, onImportFile,
    onExportText, onImportText, onCopyToClipboard
}) => (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div
            className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            onClick={() => setIsDeckManagerOpen(!isDeckManagerOpen)}
        >
            <div className="font-bold text-gray-700 flex items-center gap-2">
                <Icons.Save className="w-5 h-5 text-blue-600" />
                デッキデータの保存 / 読み込み / 出力
            </div>
            <div className="text-gray-400">
                {isDeckManagerOpen ? <Icons.Minus className="w-5 h-5" /> : <Icons.Plus className="w-5 h-5" />}
            </div>
        </div>

        {isDeckManagerOpen && (
            <div className="p-4 sm:p-5 border-t border-gray-200">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">

                    {/* ローカルストレージへの保存・読み込み */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                            <Icons.Save className="w-4 h-4 text-gray-500"/> 端末に保存・読み込み
                        </h4>

                        <div className="flex items-center gap-2">
                            <select
                                value={selectedDeckId}
                                onChange={e => onSelectSavedDeck(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">-- 新規として保存 --</option>
                                {Object.entries(savedDecks).map(([id, d]) => (
                                    <option key={id} value={id}>{d.name}</option>
                                ))}
                            </select>
                            {selectedDeckId && (
                                <>
                                    <button onClick={onLoadDeck} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-bold whitespace-nowrap shadow-sm transition-colors">読込</button>
                                    <button onClick={onDeleteDeck} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-sm hover:bg-red-100 transition-colors"><Icons.Trash className="w-4 h-4"/></button>
                                </>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="デッキ名（未記入で現在日時）"
                                value={deckNameInput}
                                onChange={e => setDeckNameInput(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={onSaveDeck} className={`px-4 py-2 text-white rounded text-sm font-bold whitespace-nowrap shadow-sm transition-colors ${selectedDeckId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                {selectedDeckId ? '上書き保存' : '新規保存'}
                            </button>
                        </div>
                    </div>

                    {/* ファイル・テキスト入出力 */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-bold text-gray-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                            <Icons.Copy className="w-4 h-4 text-gray-500"/> ファイル / テキスト入出力
                        </h4>

                        <div className="flex gap-2">
                            <button onClick={onExportFile} className="flex-1 py-2 bg-white border border-gray-300 rounded text-sm hover:bg-gray-50 font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5"><Icons.Download className="w-4 h-4" />ファイルに出力</button>
                            <label className="flex-1 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-900 font-medium transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer">
                                <Icons.Upload className="w-4 h-4" />ファイルから追加
                                <input type="file" accept=".json,.txt" className="hidden" onChange={onImportFile} />
                            </label>
                        </div>

                        <div>
                            <div className="text-xs text-gray-500 mb-1.5">またはテキストデータでコピー＆ペースト：</div>
                            <textarea
                                value={ioText}
                                onChange={e => setIoText(e.target.value)}
                                placeholder="ここにエクスポートされたデータが表示されます。インポートする場合はここにデータを貼り付けてください。"
                                className="w-full h-16 px-3 py-2 border border-gray-300 rounded text-xs resize-none font-mono focus:outline-none focus:ring-2 focus:ring-gray-800 bg-gray-50 mb-2"
                            />
                            <div className="flex gap-2">
                                <button onClick={onExportText} className="flex-1 py-1.5 bg-white border border-gray-300 rounded text-xs hover:bg-gray-50 font-medium transition-colors shadow-sm">テキスト出力</button>
                                <button onClick={onImportText} className="flex-1 py-1.5 bg-gray-800 text-white rounded text-xs hover:bg-gray-900 font-medium transition-colors shadow-sm">テキストから追加</button>
                                <button onClick={onCopyToClipboard} title="テキストをコピー" className="px-3 py-1.5 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors shadow-sm"><Icons.Copy className="w-4 h-4 text-gray-600"/></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
);

// デッキ統計バー（コスト分布・ブレードハート分布・全クリアボタン）
const DeckStatsBar = ({ deckStats, onClearDeck }) => (
    <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex-1 bg-white p-1.5 rounded border border-gray-200 shadow-sm flex items-center overflow-x-auto no-scrollbar">
            <div className="text-[10px] font-bold text-gray-500 mr-2 whitespace-nowrap">コスト</div>
            <div className="flex flex-wrap gap-1 md:gap-2">
                {Object.keys(deckStats.costs).length === 0
                    ? <span className="text-[10px] text-gray-400">-</span>
                    : Object.keys(deckStats.costs).sort((a,b)=>Number(a)-Number(b)).map(cost => (
                        <div key={cost} className="flex items-center gap-0.5">
                            <span className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-[8px] md:text-[10px] font-bold">{cost}</span>
                            <span className="text-[10px] font-bold text-gray-700">{deckStats.costs[cost]}</span>
                        </div>
                    ))
                }
            </div>
        </div>
        <div className="flex-1 bg-white p-1.5 rounded border border-gray-200 shadow-sm flex items-center overflow-x-auto no-scrollbar">
            <div className="text-[10px] font-bold text-gray-500 mr-2 whitespace-nowrap">BH</div>
            <div className="flex flex-wrap gap-1 md:gap-2">
                {Object.keys(BH_SORT_ORDER).filter(k => k !== 'None').map(color => {
                    const count = deckStats.bhs[color] || 0;
                    if (count === 0) return null;
                    const style = BH_STYLES[color] || BH_STYLES['None'];
                    return (
                        <div key={color} className="flex items-center gap-0.5">
                            <span className={`w-3.5 h-3.5 md:w-4 md:h-4 rounded-full flex items-center justify-center ${style.bg}`}></span>
                            <span className="text-[10px] font-bold text-gray-700">{count}</span>
                        </div>
                    );
                })}
                {deckStats.bhs['None'] > 0 && (
                    <div className="flex items-center gap-0.5">
                        <span className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full flex items-center justify-center bg-gray-300"></span>
                        <span className="text-[10px] font-bold text-gray-700">{deckStats.bhs['None']}</span>
                    </div>
                )}
                {Object.keys(deckStats.bhs).every(k => deckStats.bhs[k] === 0) && <span className="text-[10px] text-gray-400">-</span>}
            </div>
        </div>
        <button
            onClick={onClearDeck}
            className="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] md:text-xs hover:bg-red-100 transition-colors shadow-sm flex items-center justify-center gap-1 flex-shrink-0 font-bold"
        >
            <Icons.Trash className="w-3.5 h-3.5" /> 全クリア
        </button>
    </div>
);
