const DecklogImportPanel = ({ cardData, onReplace }) => {
    const [input, setInput] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState('');
    const [preview, setPreview] = React.useState(null);
    const request = React.useRef(null);
    React.useEffect(() => () => request.current?.abort(), []);

    const retrieve = async (event) => {
        event.preventDefault();
        if (busy) return;
        setError('');
        setPreview(null);
        setBusy(true);
        const controller = new AbortController();
        request.current = controller;
        try {
            const data = await Decklog.load(input, controller.signal);
            const deck = Decklog.buildDeck(data, cardData);
            if (!controller.signal.aborted) setPreview({ data, deck });
        } catch (error) {
            if (!controller.signal.aborted) setError(error.message);
        } finally {
            if (!controller.signal.aborted) setBusy(false);
        }
    };
    const total = type => Object.values(preview.deck[type]).reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="pt-3 border-t border-gray-100 space-y-2">
            <h4 className="text-sm font-bold text-gray-700">デッキログから読み込み</h4>
            <p className="text-xs text-gray-500">IDまたは共有URLでメンバー・ライブを取得します。エネルギーカードは対象外です。</p>
            <form onSubmit={retrieve} className="flex flex-wrap gap-2">
                <input
                    aria-label="デッキログのIDまたは共有URL"
                    placeholder="例：19ATNY または共有URL"
                    value={input}
                    disabled={busy}
                    onChange={event => { setInput(event.target.value); setPreview(null); setError(''); }}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="submit" disabled={busy || !input.trim()} className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-bold disabled:opacity-50">
                    {busy ? '取得中…' : '内容を取得'}
                </button>
            </form>
            {error && <p role="alert" className="text-xs text-red-600 whitespace-pre-wrap break-all">{error}</p>}
            {preview && (
                <div className="p-3 bg-blue-50 rounded space-y-2" role="status">
                    <p className="text-sm font-bold break-words">{preview.data.title || preview.data.code}</p>
                    <p className="text-xs">メンバー {total('member')}枚 / ライブ {total('live')}枚</p>
                    <p className="text-xs text-gray-600">編集中のデッキの全カードを置き換えます。保存済みデッキは保存操作まで変更されません。</p>
                    <button onClick={() => { onReplace(preview.deck, preview.data); setPreview(null); }} className="w-full py-2 bg-gray-800 text-white rounded text-sm font-bold hover:bg-gray-900">
                        この内容でデッキを置き換える
                    </button>
                </div>
            )}
        </div>
    );
};
