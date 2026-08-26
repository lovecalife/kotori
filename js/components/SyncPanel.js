// ==========================================
// Sync Settings Panel
// シンクキーの発行・接続・解除と、同期状態の表示
// ==========================================

// キーの QR コード。スマホへキーを渡すときに使う。
// qrcode-generator を CDN から読んでいるので、読み込みに失敗した場合は
// 何も描かず、コピー用のテキストだけで運用できるようにしておく
const SyncKeyQr = ({ value }) => {
    const holder = React.useRef(null);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        if (!holder.current) return;
        holder.current.innerHTML = '';
        if (typeof qrcode !== 'function') { setFailed(true); return; }
        try {
            // 0 = 内容量に応じて型番を自動選択、'M' = 誤り訂正レベル
            const qr = qrcode(0, 'M');
            qr.addData(value);
            qr.make();
            holder.current.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
            const svg = holder.current.querySelector('svg');
            if (svg) { svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); }
            setFailed(false);
        } catch (e) {
            console.error('Failed to render QR', e);
            setFailed(true);
        }
    }, [value]);

    if (failed) {
        return <div className="text-xs text-gray-500 py-4 text-center">QRコードを表示できませんでした。キーをコピーして渡してください。</div>;
    }
    return (
        <div className="flex flex-col items-center gap-2 py-2">
            <div ref={holder} className="w-48 h-48 bg-white p-2 border border-gray-200 rounded" />
            <div className="text-[10px] text-gray-500">スマートフォンのカメラで読み取ってください</div>
        </div>
    );
};

const formatSyncTime = (t) => {
    if (!t) return '未同期';
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const SYNC_STATUS_LABEL = {
    idle: '',
    syncing: '同期中…',
    ok: '同期しました',
    error: '同期できていません'
};

const SyncPanel = ({
    isOpen, setIsOpen,
    syncKey, lastSyncedAt, syncStatus, syncError,
    keyInput, setKeyInput,
    onIssueKey, onConnect, onDisconnect, onSyncNow, onCopyKey
}) => {
    const [showQr, setShowQr] = React.useState(false);
    const connected = !!syncKey;

    return (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div
                className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="font-bold text-gray-700 flex items-center gap-2">
                    <Icons.Refresh className="w-5 h-5 text-emerald-600" />
                    端末間でデッキを同期
                    {connected && (
                        <span className={`text-[10px] font-normal px-1.5 py-0.5 rounded ${syncStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {syncStatus === 'error' ? '同期エラー' : '接続中'}
                        </span>
                    )}
                </div>
                <div className="text-gray-400">
                    {isOpen ? <Icons.Minus className="w-5 h-5" /> : <Icons.Plus className="w-5 h-5" />}
                </div>
            </div>

            {isOpen && (
                <div className="p-4 sm:p-5 border-t border-gray-200 space-y-4">

                    {/* 注意書き。あとで一番困る点なので、操作より先に目に入る位置に置く */}
                    <div className="bg-amber-50 border border-amber-300 rounded p-3 text-xs text-amber-900 space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5">
                            <Icons.Alert className="w-4 h-4" />同期を使う前に必ずお読みください
                        </div>
                        <ul className="list-disc list-inside space-y-1 leading-relaxed">
                            <li><strong>シンクキーを紛失すると、デッキは復旧できません。</strong>パスワードの再発行にあたる仕組みはありません。</li>
                            <li><strong>キーを知っている人は誰でも、あなたのデッキを閲覧・編集・削除できます。</strong>他人に見せないでください。</li>
                            <li>同期はバックアップではありません。<strong>「全件バックアップ」で定期的に JSON を書き出しておくことを強く推奨します。</strong></li>
                        </ul>
                    </div>

                    {!connected ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                            {/* 1台目：新しくキーを発行する */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-2">はじめて同期する端末</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    シンクキーを発行します。この端末に保存済みのデッキは、そのまま同期対象になります。
                                </p>
                                <button onClick={onIssueKey} className="w-full py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 font-bold transition-colors shadow-sm">
                                    シンクキーを発行する
                                </button>
                            </div>

                            {/* 2台目：既存のキーで接続する */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-gray-700 border-b border-gray-100 pb-2">2台目以降の端末</h4>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    1台目で発行したキーを入力してください。この端末のデッキは消えません。両方のデッキが統合されます。
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={keyInput}
                                        onChange={e => setKeyInput(e.target.value)}
                                        placeholder="KOTRI-XXXX-XXXX-…"
                                        autoCapitalize="characters"
                                        autoCorrect="off"
                                        spellCheck="false"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                    <button onClick={onConnect} className="px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-900 font-bold whitespace-nowrap transition-colors shadow-sm">
                                        接続
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-gray-500 mb-1.5">この端末のシンクキー</div>
                                <div className="flex gap-2">
                                    <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded text-xs font-mono break-all select-all">
                                        {syncKey}
                                    </code>
                                    <button onClick={onCopyKey} title="キーをコピー" className="px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors shadow-sm flex-shrink-0">
                                        <Icons.Copy className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>
                            </div>

                            <div>
                                <button onClick={() => setShowQr(!showQr)} className="text-xs text-emerald-700 hover:text-emerald-800 font-medium underline">
                                    {showQr ? 'QRコードを隠す' : 'QRコードで別の端末に渡す'}
                                </button>
                                {showQr && <SyncKeyQr value={syncKey} />}
                            </div>

                            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                                <button
                                    onClick={onSyncNow}
                                    disabled={syncStatus === 'syncing'}
                                    className="px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                >
                                    <Icons.Refresh className="w-4 h-4" />今すぐ同期
                                </button>
                                <div className="flex-1 text-xs text-gray-500 leading-tight">
                                    <div>最終同期: {formatSyncTime(lastSyncedAt)}</div>
                                    {syncStatus !== 'idle' && (
                                        <div className={syncStatus === 'error' ? 'text-red-600' : 'text-emerald-700'}>
                                            {syncStatus === 'error' ? (syncError || SYNC_STATUS_LABEL.error) : SYNC_STATUS_LABEL[syncStatus]}
                                        </div>
                                    )}
                                </div>
                                <button onClick={onDisconnect} className="px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100 transition-colors whitespace-nowrap">
                                    同期を解除
                                </button>
                            </div>
                            <div className="text-[10px] text-gray-400 leading-relaxed">
                                「同期を解除」はこの端末からキーを消すだけです。サーバ上のデッキと、他の端末のデッキは残ります。
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
