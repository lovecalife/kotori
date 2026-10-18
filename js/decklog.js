// DeckLogから取得した一覧は、全カードを照合できたときだけ置き換える。
const Decklog = (() => {
    const parseCode = (input) => {
        let code = String(input || '').trim();
        if (/^https?:\/\//i.test(code)) {
            let url;
            try { url = new URL(code); } catch { throw new Error('DeckLogの共有URLを確認してください。'); }
            const match = url.pathname.match(/^\/view\/([a-z0-9]{4,10})\/?$/i);
            if (url.protocol !== 'https:' || url.hostname !== 'decklog.bushiroad.com' || url.port || url.username || url.password || !match) {
                throw new Error('https://decklog.bushiroad.com/view/ から始まる共有URLを入力してください。');
            }
            code = match[1];
        }
        if (!/^[a-z0-9]{4,10}$/i.test(code)) throw new Error('デッキコード（半角英数字4〜10文字）または共有URLを入力してください。');
        return code.toUpperCase();
    };

    const buildDeck = (data, cardData) => {
        if (!data || !Array.isArray(data.cards) || !data.cards.length) throw new Error('カード一覧が空か、取得データの形式が不正です。');
        const deck = { member: {}, live: {} };
        const missing = [];
        for (const item of data.cards) {
            if (!item || !['member', 'live'].includes(item.type) || typeof item.cardId !== 'string' || !item.cardId.trim() ||
                !Number.isSafeInteger(item.count) || item.count <= 0 || item.count > 999) throw new Error('カード一覧の形式が不正です。');
            const source = cardData[item.type];
            // シートはレアリティを別列で保持する。完全一致を優先し、末尾のレアリティだけを外す。
            const card = source.find(c => c.number === item.cardId) ||
                source.find(c => c.number === item.cardId.replace(/-[^-]+$/, ''));
            if (!card) { missing.push(item.cardId); continue; }
            const count = (deck[item.type][card.number]?.count || 0) + item.count;
            if (!Number.isSafeInteger(count) || count > 999) throw new Error('カード枚数が不正です。');
            deck[item.type][card.number] = { card, count };
        }
        if (missing.length) throw new Error(`カードデータに見つからないカードが${missing.length}件あります。置き換えは行いません。\n${missing.join('\n')}`);
        return deck;
    };

    const load = async (input, signal) => {
        const code = parseCode(input);
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) controller.abort();
        const timer = setTimeout(abort, 20000);
        try {
            const response = await fetch(`${DECKLOG_API_BASE}/decklog/${code}`, { signal: controller.signal });
            let data;
            try { data = await response.json(); } catch { throw new Error('取得サービスを利用できません。サーバーの起動・更新を確認してください。'); }
            if (!response.ok) throw new Error(data.message || 'DeckLogから取得できませんでした。');
            if (data.code !== code) throw new Error('取得したデッキコードが一致しません。');
            return data;
        } catch (error) {
            if (controller.signal.aborted) throw new Error('取得を中断したか、応答がタイムアウトしました。再度お試しください。');
            if (error instanceof TypeError) throw new Error('取得サービスに接続できません。通信状態とサーバーの起動・更新を確認してください。');
            throw error;
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
        }
    };
    return { parseCode, buildDeck, load };
})();
