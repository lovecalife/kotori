// ==========================================
// Main App
// ==========================================
const { useState, useEffect, useMemo } = React;

const App = () => {
    const [activeTab, setActiveTab] = useState('member');
    const [viewMode, setViewMode] = useState('grid');
    const [cardData, setCardData] = useState({ member: [], live: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

    const [deck, setDeck] = useState({ member: {}, live: {} });
    const [deckSortType, setDeckSortType] = useState('cost');

    const [isDeckManagerOpen, setIsDeckManagerOpen] = useState(false);
    const [savedDecks, setSavedDecks] = useState({});
    const [selectedDeckId, setSelectedDeckId] = useState('');
    const [deckNameInput, setDeckNameInput] = useState('');
    const [ioText, setIoText] = useState('');
    const [toastMessage, setToastMessage] = useState('');

    const initial3State = () => ({ include: new Set(), exclude: new Set() });

    const [filterName, setFilterName] = useState('');
    const [filterContains, setFilterContains] = useState(initial3State());
    const [filterGroups, setFilterGroups] = useState(initial3State());
    const [filterCosts, setFilterCosts] = useState(initial3State());
    const [filterBladeHeart, setFilterBladeHeart] = useState(initial3State());
    const [filterColors, setFilterColors] = useState({ Pink: '', Red: '', Yellow: '', Green: '', Blue: '', Purple: '' });
    const [filterAbilities, setFilterAbilities] = useState(initial3State());
    const [filterKeywords, setFilterKeywords] = useState(initial3State());
    const [filterBaseStats, setFilterBaseStats] = useState({ min: '', max: '' });
    const [filterMaxStats, setFilterMaxStats] = useState({ min: '', max: '' });
    const [numericFilters, setNumericFilters] = useState({});
    const [sortConfig, setSortConfig] = useState({ key: 'cost', direction: 'asc' });

    // ローカルストレージから保存デッキを復元
    useEffect(() => {
        try {
            const saved = localStorage.getItem('card_viewer_saved_decks');
            if (saved) setSavedDecks(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to load saved decks", e);
        }
    }, []);

    // スプレッドシートからカードデータを取得し、オートセーブデッキを復元
    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true); setError(null);
            try {
                const memRaw = await fetchSheetData(GID_MEMBER);
                const livRaw = await fetchSheetData(GID_LIVE);
                const normMem = normalizeData(memRaw, 'member');
                const normLiv = normalizeData(livRaw, 'live');
                setCardData({ member: normMem, live: normLiv });

                try {
                    const autosaveStr = localStorage.getItem('card_viewer_autosave_deck');
                    if (autosaveStr) {
                        const parsedAutosave = JSON.parse(autosaveStr);
                        const newDeck = { member: {}, live: {} };
                        const addCards = (type, dict, sourceData) => {
                            if (!dict) return;
                            Object.entries(dict).forEach(([num, count]) => {
                                const card = sourceData.find(c => c.number === num);
                                if (card) newDeck[type][num] = { card, count };
                            });
                        };
                        addCards('member', parsedAutosave.member, normMem);
                        addCards('live', parsedAutosave.live, normLiv);
                        setDeck(newDeck);
                    }
                } catch (e) {
                    console.error("Failed to load autosave deck", e);
                }
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadAllData();
    }, []);

    // デッキ変更時にオートセーブ
    useEffect(() => {
        if (loading) return;
        const simpleDeck = { member: {}, live: {} };
        Object.keys(deck.member).forEach(k => simpleDeck.member[k] = deck.member[k].count);
        Object.keys(deck.live).forEach(k => simpleDeck.live[k] = deck.live[k].count);
        try {
            localStorage.setItem('card_viewer_autosave_deck', JSON.stringify(simpleDeck));
        } catch(e) {
            console.error("Failed to autosave deck", e);
        }
    }, [deck, loading]);

    // タブ切り替え時にソート設定をリセット
    useEffect(() => {
        if (activeTab === 'member') setSortConfig({ key: 'cost', direction: 'asc' });
        else if (activeTab === 'live') setSortConfig({ key: 'score', direction: 'asc' });
    }, [activeTab]);

    // ==========================================
    // Toast
    // ==========================================
    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // ==========================================
    // Deck Operations
    // ==========================================
    const addCardToDeck = (e, item) => {
        if (e) e.stopPropagation();
        const type = item._type;
        if (!type) return;
        setDeck(prev => {
            const currentCount = prev[type][item.number]?.count || 0;
            if (currentCount >= 4) return prev;
            return { ...prev, [type]: { ...prev[type], [item.number]: { card: item, count: currentCount + 1 } } };
        });
    };

    const removeCardFromDeck = (e, item) => {
        if (e) e.stopPropagation();
        const type = item._type;
        if (!type) return;
        setDeck(prev => {
            const currentCount = prev[type][item.number]?.count || 0;
            if (currentCount <= 0) return prev;
            const nextTypeDeck = { ...prev[type] };
            if (currentCount === 1) delete nextTypeDeck[item.number];
            else nextTypeDeck[item.number] = { card: item, count: currentCount - 1 };
            return { ...prev, [type]: nextTypeDeck };
        });
    };

    const getDeckCount = (item) => {
        if (!item || !item._type || !item.number) return 0;
        return deck[item._type][item.number]?.count || 0;
    };

    const handleClearDeck = () => {
        if (window.confirm('デッキのカードをすべてクリアしますか？')) {
            setDeck({ member: {}, live: {} });
            showToast('デッキをクリアしました');
        }
    };

    const deckStats = useMemo(() => {
        const costs = {};
        const bhs = { Pink: 0, Red: 0, Yellow: 0, Green: 0, Blue: 0, Purple: 0, None: 0 };
        let memberTotal = 0;
        let liveTotal = 0;

        const processItem = (d, type) => {
            const count = d.count;
            if (type === 'member') {
                memberTotal += count;
                const costVal = parseInt(d.card.cost);
                if (!isNaN(costVal)) costs[costVal] = (costs[costVal] || 0) + count;
                const bhList = d.card.bladeHeart ? d.card.bladeHeart.split(/[,、\s]+/).map(s => s.trim()) : ['None'];
                if (bhList.length === 0 || (bhList.length === 1 && bhList[0] === '')) bhList[0] = 'None';
                bhList.forEach(bh => {
                    const key = Object.keys(bhs).find(k => k.toLowerCase() === bh.toLowerCase());
                    if (key) bhs[key] += count;
                });
            } else {
                liveTotal += count;
            }
        };

        Object.values(deck.member).forEach(d => processItem(d, 'member'));
        Object.values(deck.live).forEach(d => processItem(d, 'live'));
        return { costs, bhs, memberTotal, liveTotal };
    }, [deck]);

    // ==========================================
    // Deck Manager Operations
    // ==========================================
    const rebuildDeck = (simplifiedDeck) => {
        const newDeck = { member: {}, live: {} };
        if (!simplifiedDeck) return newDeck;
        const addCards = (type, dict) => {
            if (!dict) return;
            Object.entries(dict).forEach(([num, count]) => {
                const card = cardData[type].find(c => c.number === num);
                if (card) newDeck[type][num] = { card, count };
            });
        };
        addCards('member', simplifiedDeck.member);
        addCards('live', simplifiedDeck.live);
        return newDeck;
    };

    const handleSelectSavedDeck = (id) => {
        if (!id) { setSelectedDeckId(''); setDeckNameInput(''); }
        else { setSelectedDeckId(id); setDeckNameInput(savedDecks[id]?.name || ''); }
    };

    const handleSaveDeck = () => {
        let name = deckNameInput.trim();
        if (!name) {
            const now = new Date();
            name = `${now.getFullYear()}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
        }
        const simpleDeck = { name, member: {}, live: {} };
        Object.keys(deck.member).forEach(k => simpleDeck.member[k] = deck.member[k].count);
        Object.keys(deck.live).forEach(k => simpleDeck.live[k] = deck.live[k].count);
        const id = selectedDeckId || Date.now().toString();
        const newSavedDecks = { ...savedDecks, [id]: simpleDeck };
        setSavedDecks(newSavedDecks);
        try {
            localStorage.setItem('card_viewer_saved_decks', JSON.stringify(newSavedDecks));
            setSelectedDeckId(id);
            setDeckNameInput(name);
            showToast('デッキを保存しました');
        } catch(e) {
            showToast('保存に失敗しました(容量制限等)');
        }
    };

    const handleLoadDeck = () => {
        if (!selectedDeckId || !savedDecks[selectedDeckId]) return;
        setDeck(rebuildDeck(savedDecks[selectedDeckId]));
        showToast(`「${savedDecks[selectedDeckId].name}」を読み込みました`);
    };

    const handleDeleteDeck = () => {
        if (!selectedDeckId) return;
        if (!confirm('このデッキを削除しますか？')) return;
        const newSavedDecks = { ...savedDecks };
        delete newSavedDecks[selectedDeckId];
        setSavedDecks(newSavedDecks);
        try {
            localStorage.setItem('card_viewer_saved_decks', JSON.stringify(newSavedDecks));
            setSelectedDeckId(''); setDeckNameInput('');
            showToast('デッキを削除しました');
        } catch(e) {}
    };

    const handleExportFile = () => {
        const simpleDeck = { member: {}, live: {} };
        Object.keys(deck.member).forEach(k => simpleDeck.member[k] = deck.member[k].count);
        Object.keys(deck.live).forEach(k => simpleDeck.live[k] = deck.live[k].count);
        if (deckNameInput.trim()) simpleDeck.name = deckNameInput.trim();
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(simpleDeck, null, 2));
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", (deckNameInput.trim() || "deck") + ".json");
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('ファイルとしてダウンロードしました');
    };

    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (!parsed.member && !parsed.live) throw new Error();
                setDeck(prevDeck => {
                    const newDeck = { member: { ...prevDeck.member }, live: { ...prevDeck.live } };
                    const addCards = (type, dict) => {
                        if (!dict) return;
                        Object.entries(dict).forEach(([num, count]) => {
                            const card = cardData[type].find(c => c.number === num);
                            if (card) {
                                const currentCount = newDeck[type][num]?.count || 0;
                                const finalCount = Math.min(currentCount + (parseInt(count, 10) || 0), 4);
                                if (finalCount > 0) newDeck[type][num] = { card, count: finalCount };
                            }
                        });
                    };
                    addCards('member', parsed.member);
                    addCards('live', parsed.live);
                    return newDeck;
                });
                if (parsed.name) setDeckNameInput(parsed.name);
                setSelectedDeckId('');
                showToast('ファイルからデッキに追加しました');
            } catch(err) {
                showToast('無効なファイル形式です');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const handleExportText = () => {
        const simpleDeck = { member: {}, live: {} };
        Object.keys(deck.member).forEach(k => simpleDeck.member[k] = deck.member[k].count);
        Object.keys(deck.live).forEach(k => simpleDeck.live[k] = deck.live[k].count);
        setIoText(JSON.stringify(simpleDeck));
        showToast('テキストデータを出力しました');
    };

    const handleImportText = () => {
        try {
            const parsed = JSON.parse(ioText);
            if (!parsed.member && !parsed.live) throw new Error();
            setDeck(prevDeck => {
                const newDeck = { member: { ...prevDeck.member }, live: { ...prevDeck.live } };
                const addCards = (type, dict) => {
                    if (!dict) return;
                    Object.entries(dict).forEach(([num, count]) => {
                        const card = cardData[type].find(c => c.number === num);
                        if (card) {
                            const currentCount = newDeck[type][num]?.count || 0;
                            const finalCount = Math.min(currentCount + (parseInt(count, 10) || 0), 4);
                            if (finalCount > 0) newDeck[type][num] = { card, count: finalCount };
                        }
                    });
                };
                addCards('member', parsed.member);
                addCards('live', parsed.live);
                return newDeck;
            });
            setSelectedDeckId(''); setDeckNameInput(''); setIoText('');
            showToast('テキストデータからデッキに追加しました');
        } catch(e) {
            showToast('無効なデータ形式です');
        }
    };

    const copyToClipboard = () => {
        if (!ioText) return;
        navigator.clipboard.writeText(ioText)
            .then(() => showToast('クリップボードにコピーしました'))
            .catch(() => showToast('コピーに失敗しました'));
    };

    // ==========================================
    // Filter Logic
    // ==========================================
    const toggle3State = (state, val, setter) => {
        const nextInclude = new Set(state.include);
        const nextExclude = new Set(state.exclude);
        if (nextInclude.has(val)) { nextInclude.delete(val); nextExclude.add(val); }
        else if (nextExclude.has(val)) { nextExclude.delete(val); }
        else { nextInclude.add(val); }
        setter({ include: nextInclude, exclude: nextExclude });
    };

    const updateNumFilter = (key, type, val) => setNumericFilters(p => ({ ...p, [key]: { ...p[key], [type]: val } }));

    const resetAll = () => {
        setFilterName('');
        setFilterContains(initial3State()); setFilterGroups(initial3State());
        setFilterCosts(initial3State()); setFilterBladeHeart(initial3State());
        setFilterColors({ Pink: '', Red: '', Yellow: '', Green: '', Blue: '', Purple: '' });
        setFilterAbilities(initial3State()); setFilterKeywords(initial3State());
        setFilterBaseStats({ min: '', max: '' }); setFilterMaxStats({ min: '', max: '' });
        setNumericFilters({});
    };

    // ==========================================
    // Derived Data
    // ==========================================
    const currentTabData = activeTab === 'deck' ? [] : cardData[activeTab];

    const uniqueAbilities = useMemo(() => {
        const s = new Set();
        currentTabData.forEach(d => d.ability && d.ability.split(/[,、\s]+/).forEach(a => a.trim() && s.add(a.trim())));
        return Array.from(s).sort();
    }, [currentTabData]);

    const uniqueKeywords = useMemo(() => {
        const s = new Set();
        currentTabData.forEach(d => d.keyword && d.keyword.split(/[,、\s]+/).forEach(a => a.trim() && s.add(a.trim())));
        return Array.from(s).sort();
    }, [currentTabData]);

    const uniqueContains = useMemo(() => {
        const dataContains = new Set();
        currentTabData.forEach(d => d.contain && d.contain.split(/[,、\s]+/).forEach(a => a.trim() && dataContains.add(a.trim())));
        const mergedOptions = new Set([...CONTAIN_ORDER, ...dataContains]);
        return Array.from(mergedOptions).sort((a, b) => {
            const idxA = CONTAIN_ORDER.indexOf(a);
            const idxB = CONTAIN_ORDER.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b, 'ja');
        });
    }, [currentTabData]);

    const filteredData = useMemo(() => {
        return currentTabData.filter(item => {
            if (item.noViewer == 1) return false;

            if (filterName) {
                const searchTerms = filterName.replace(/　/g, ' ').split(/\s+/).filter(t => t.length > 0);
                const isMatch = searchTerms.every(term => {
                    const lowerTerm = term.toLowerCase();
                    const inName = item.name && item.name.toLowerCase().includes(lowerTerm);
                    const inText = item.text && item.text.toLowerCase().includes(lowerTerm);
                    const costStr = (item._type === 'member' ? item.cost : item.req) || '';
                    const inCost = costStr.toString().toLowerCase().includes(lowerTerm);
                    return inName || inText || inCost;
                });
                if (!isMatch) return false;
            }

            const c = item.contain ? item.contain.split(/[,、\s]+/).map(s => s.trim()) : [];
            if (filterContains.exclude.size > 0 && [...filterContains.exclude].some(x => c.includes(x))) return false;
            if (filterContains.include.size > 0 && ![...filterContains.include].some(x => c.includes(x))) return false;

            const g = item.group ? item.group.split(',').map(s => s.trim()) : [];
            if (filterGroups.exclude.size > 0 && [...filterGroups.exclude].some(x => g.includes(x))) return false;
            if (filterGroups.include.size > 0 && ![...filterGroups.include].some(x => g.includes(x))) return false;

            const colorCounts = { Pink: 0, Red: 0, Yellow: 0, Green: 0, Blue: 0, Purple: 0 };
            if (item.Pink !== undefined || item.Red !== undefined) {
                colorCounts.Pink = parseInt(item.Pink) || 0;
                colorCounts.Red = parseInt(item.Red) || 0;
                colorCounts.Yellow = parseInt(item.Yellow) || 0;
                colorCounts.Green = parseInt(item.Green) || 0;
                colorCounts.Blue = parseInt(item.Blue) || 0;
                colorCounts.Purple = parseInt(item.Purple) || 0;
            } else if (item.bladeHeart) {
                const bhs = item.bladeHeart.split(/[,、\s]+/).map(s => s.trim().toLowerCase());
                bhs.forEach(bh => {
                    const key = Object.keys(colorCounts).find(k => k.toLowerCase() === bh);
                    if (key) colorCounts[key]++;
                });
            }

            for (const color of Object.keys(filterColors)) {
                const reqVal = filterColors[color];
                if (reqVal === '') continue;
                const reqNum = parseInt(reqVal, 10);
                if (isNaN(reqNum)) continue;
                if (reqNum === 0) { if (colorCounts[color] > 0) return false; }
                else { if (colorCounts[color] < reqNum) return false; }
            }

            const a = item.ability ? item.ability.split(/[,、\s]+/).map(s => s.trim()) : [];
            if (filterAbilities.exclude.size > 0 && [...filterAbilities.exclude].some(x => a.includes(x))) return false;
            if (filterAbilities.include.size > 0 && ![...filterAbilities.include].some(x => a.includes(x))) return false;

            if (activeTab === 'member') {
                const costVal = parseInt(item.cost);
                if (filterCosts.exclude.size > 0 && filterCosts.exclude.has(costVal)) return false;
                if (filterCosts.include.size > 0 && (isNaN(costVal) || !filterCosts.include.has(costVal))) return false;

                const bs = parseInt(item.baseStats);
                if ((filterBaseStats.min !== '' && (isNaN(bs) || bs < parseInt(filterBaseStats.min))) || (filterBaseStats.max !== '' && (isNaN(bs) || bs > parseInt(filterBaseStats.max)))) return false;
                if (filterMaxStats.min === '＋' || filterMaxStats.max === '＋') { if (!item.maxStats?.includes('+')) return false; }
                else {
                    const ms = parseInt(item.maxStats);
                    if ((filterMaxStats.min !== '' && (isNaN(ms) || ms < parseInt(filterMaxStats.min))) || (filterMaxStats.max !== '' && (isNaN(ms) || ms > parseInt(filterMaxStats.max)))) return false;
                }

                const itemBH = item.bladeHeart ? item.bladeHeart.trim().toLowerCase() : '';
                const hasBH = (targetBH) => targetBH === 'None' ? itemBH === '' : itemBH === targetBH.toLowerCase();
                if (filterBladeHeart.exclude.size > 0 && [...filterBladeHeart.exclude].some(hasBH)) return false;
                if (filterBladeHeart.include.size > 0 && ![...filterBladeHeart.include].some(hasBH)) return false;
            }

            if (activeTab === 'live') {
                const k = item.keyword ? item.keyword.split(/[,、\s]+/).map(s => s.trim()) : [];
                if (filterKeywords.exclude.size > 0 && [...filterKeywords.exclude].some(x => k.includes(x))) return false;
                if (filterKeywords.include.size > 0 && ![...filterKeywords.include].some(x => k.includes(x))) return false;

                const cardBHs = item.bladeHeart ? item.bladeHeart.split(/[,、\s]+/).map(s => s.trim().toLowerCase()) : [];
                const hasBHLive = (targetBH) => targetBH === 'None' ? cardBHs.length === 0 : cardBHs.includes(targetBH.toLowerCase());
                if (filterBladeHeart.exclude.size > 0 && [...filterBladeHeart.exclude].some(hasBHLive)) return false;
                if (filterBladeHeart.include.size > 0 && ![...filterBladeHeart.include].some(hasBHLive)) return false;
            }

            for (const [k, r] of Object.entries(numericFilters)) {
                const v = parseFloat(item[k]);
                if (isNaN(v)) { if (r?.min || r?.max) return false; continue; }
                if ((r?.min !== '' && v < parseFloat(r.min)) || (r?.max !== '' && v > parseFloat(r.max))) return false;
            }
            return true;
        });
    }, [currentTabData, filterName, filterContains, filterGroups, filterCosts, filterBladeHeart, filterColors, filterAbilities, filterKeywords, filterBaseStats, filterMaxStats, numericFilters, activeTab]);

    const sortedData = useMemo(() => {
        let items = [...filteredData];
        items.sort((a, b) => {
            const getVal = (i, k) => { const v = parseInt(i[k]); return isNaN(v) ? 0 : v; };
            let valA = getVal(a, sortConfig.key), valB = getVal(b, sortConfig.key);
            if (valA !== valB) return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
            if (sortConfig.key !== 'baseStats') return getVal(a, 'baseStats') - getVal(b, 'baseStats');
            return 0;
        });
        return items;
    }, [filteredData, sortConfig]);

    const sortedDeckCards = useMemo(() => {
        if (activeTab !== 'deck') return { member: [], live: [] };
        const members = Object.values(deck.member).map(d => d.card);
        const lives = Object.values(deck.live).map(d => d.card);

        const sortFn = (a, b) => {
            const getBhVal = (card) => {
                const bhStr = card.bladeHeart ? card.bladeHeart.split(/[,、\s]+/)[0].trim() : 'None';
                const key = Object.keys(BH_SORT_ORDER).find(k => k.toLowerCase() === bhStr.toLowerCase());
                return BH_SORT_ORDER[key] || 8;
            };
            if (deckSortType === 'cost') {
                const costA = parseInt(a.cost || a.req) || 0;
                const costB = parseInt(b.cost || b.req) || 0;
                if (costA !== costB) return costA - costB;
                const bhA = getBhVal(a), bhB = getBhVal(b);
                if (bhA !== bhB) return bhA - bhB;
            } else if (deckSortType === 'bladeHeart') {
                const bhA = getBhVal(a), bhB = getBhVal(b);
                if (bhA !== bhB) return bhA - bhB;
                const costA = parseInt(a.cost || a.req) || 0;
                const costB = parseInt(b.cost || b.req) || 0;
                if (costA !== costB) return costA - costB;
            }
            return (a.number || '').localeCompare(b.number || '');
        };

        members.sort(sortFn);
        lives.sort(sortFn);
        return { member: members, live: lives };
    }, [deck, activeTab, deckSortType]);

    const displayList = activeTab === 'deck' ? [...sortedDeckCards.member, ...sortedDeckCards.live] : sortedData;
    const actualViewMode = (activeTab !== 'deck' && viewMode === 'compact') ? 'grid' : viewMode;

    const activeFilters = useMemo(() => {
        const list = [];
        if (filterName) list.push({ id: 'name', label: `Keyword: ${filterName}`, fn: () => setFilterName(''), isExclude: false });

        const add3StateFilters = (state, prefix, labelPrefix, setter) => {
            state.include.forEach(val => list.push({ id: `inc-${prefix}-${val}`, label: `${labelPrefix}: ${val}`, fn: () => toggle3State(state, val, setter), isExclude: false }));
            state.exclude.forEach(val => list.push({ id: `exc-${prefix}-${val}`, label: `NOT ${labelPrefix}: ${val}`, fn: () => toggle3State(state, val, setter), isExclude: true }));
        };

        add3StateFilters(filterContains, 'ct', 'Contain', setFilterContains);
        add3StateFilters(filterGroups, 'g', 'Group', setFilterGroups);
        add3StateFilters(filterAbilities, 'a', 'Ability', setFilterAbilities);
        add3StateFilters(filterKeywords, 'k', 'Keyword', setFilterKeywords);
        add3StateFilters(filterCosts, 'c', 'Cost', setFilterCosts);
        add3StateFilters(filterBladeHeart, 'bh', 'BH', setFilterBladeHeart);

        Object.entries(filterColors).forEach(([color, val]) => {
            if (val !== '') {
                list.push({
                    id: `color-${color}`,
                    label: `${color}: ${val === '0' ? '0(含まない)' : val + '以上'}`,
                    fn: () => setFilterColors(p => ({ ...p, [color]: '' })),
                    isExclude: val === '0'
                });
            }
        });

        const addRange = (obj, label, setter) => { if(obj.min || obj.max) list.push({ id: label, label: `${label}: ${obj.min||'0'}~${obj.max||'∞'}`, fn: () => setter({min:'',max:''}), isExclude: false }); };
        addRange(filterBaseStats, 'Base', setFilterBaseStats);
        addRange(filterMaxStats, 'Max', setFilterMaxStats);
        Object.entries(numericFilters).forEach(([k, v]) => { if (v.min || v.max) list.push({ id: k, label: `${k}: ${v.min||'0'}~${v.max||'∞'}`, fn: () => { updateNumFilter(k, 'min', ''); updateNumFilter(k, 'max', ''); }, isExclude: false }); });

        return list;
    }, [filterName, filterContains, filterGroups, filterCosts, filterBladeHeart, filterColors, filterAbilities, filterKeywords, filterBaseStats, filterMaxStats, numericFilters]);

    const filterProps = {
        isMobile: false, activeTab, setActiveTab,
        filterName, setFilterName,
        filterContains, toggleContain: (v) => toggle3State(filterContains, v, setFilterContains), setFilterContains,
        filterGroups, toggleGroup: (v) => toggle3State(filterGroups, v, setFilterGroups), setFilterGroups,
        filterAbilities, toggleAbility: (v) => toggle3State(filterAbilities, v, setFilterAbilities), setFilterAbilities,
        filterKeywords, toggleKeyword: (v) => toggle3State(filterKeywords, v, setFilterKeywords), setFilterKeywords,
        filterCosts, toggleCost: (v) => toggle3State(filterCosts, v, setFilterCosts), setFilterCosts,
        filterBladeHeart, toggleBladeHeart: (v) => toggle3State(filterBladeHeart, v, setFilterBladeHeart), setFilterBladeHeart,
        filterColors, setFilterColors,
        filterBaseStats, setFilterBaseStats, filterMaxStats, setFilterMaxStats,
        numericFilters, updateNumericFilter: updateNumFilter, setNumericFilters,
        uniqueAbilities, uniqueKeywords, uniqueContains, resetFilters: resetAll, initial3State,
        deckSortType, setDeckSortType
    };

    // カードのアビリティリストをタイプに応じて選択
    const getAbilitiesList = (item) => item._type === 'live' ? uniqueKeywords : uniqueAbilities;

    // ==========================================
    // Render Helpers
    // ==========================================

    const renderCardGrid = (items) => (
        <div className="grid gap-2 md:gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((item, index) => (
                <CardItem key={`${item.number}-${index}`} item={item} deckCount={getDeckCount(item)} onAdd={addCardToDeck} onRemove={removeCardFromDeck} onSelect={setSelectedItem} abilitiesList={getAbilitiesList(item)} asGrid={true} />
            ))}
        </div>
    );

    const renderCardList = (items) => (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs md:text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Img</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">No.</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500">Group</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-500 hidden sm:table-cell">Ability</th>
                        {activeTab === 'member'
                            ? <><th className="px-3 py-2 text-left font-medium text-gray-500">Cost</th><th className="px-3 py-2 text-left font-medium text-gray-500">Stats</th></>
                            : <><th className="px-3 py-2 text-left font-medium text-gray-500">Score</th><th className="px-3 py-2 text-left font-medium text-gray-500">Cost</th></>
                        }
                        <th className="px-3 py-2 text-right font-medium text-gray-500">Deck</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item, index) => (
                        <CardItem key={`${item.number}-${index}`} item={item} deckCount={getDeckCount(item)} onAdd={addCardToDeck} onRemove={removeCardFromDeck} onSelect={setSelectedItem} abilitiesList={getAbilitiesList(item)} asGrid={false} />
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderDeckSection = (title, items, borderColor) => {
        if (items.length === 0) return null;
        const isMember = items[0]?._type === 'member';
        return (
            <div>
                <h3 className={`text-base md:text-xl font-bold text-gray-800 border-b-2 ${borderColor} pb-1 md:pb-2 mb-3 md:mb-4`}>{title}</h3>
                {actualViewMode === 'compact' ? (
                    <div className={`grid gap-1 px-1 pb-2 ${isMember ? 'grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 xl:grid-cols-14' : 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12'}`}>
                        {items.map((item, index) => (
                            <CompactCardItem key={`${item.number}-${index}`} item={item} deckCount={getDeckCount(item)} onSelect={setSelectedItem} />
                        ))}
                    </div>
                ) : actualViewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-2 gap-y-6 md:gap-x-4 md:gap-y-8 px-1 pb-4">
                        {items.map((item, index) => (
                            <CardItem key={`${item.number}-${index}`} item={item} deckCount={getDeckCount(item)} onAdd={addCardToDeck} onRemove={removeCardFromDeck} onSelect={setSelectedItem} abilitiesList={getAbilitiesList(item)} asGrid={true} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200 overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs md:text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500">Img</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500">No.</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500">Name</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500">Group</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-500 hidden sm:table-cell">Ability</th>
                                    {isMember
                                        ? <><th className="px-3 py-2 text-left font-medium text-gray-500">Cost</th><th className="px-3 py-2 text-left font-medium text-gray-500">Stats</th></>
                                        : <><th className="px-3 py-2 text-left font-medium text-gray-500">Score</th><th className="px-3 py-2 text-left font-medium text-gray-500">Cost</th></>
                                    }
                                    <th className="px-3 py-2 text-right font-medium text-gray-500">Deck</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {items.map((item, index) => (
                                    <CardItem key={`${item.number}-${index}`} item={item} deckCount={getDeckCount(item)} onAdd={addCardToDeck} onRemove={removeCardFromDeck} onSelect={setSelectedItem} abilitiesList={getAbilitiesList(item)} asGrid={false} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        );
    };

    // ==========================================
    // Render
    // ==========================================
    return (
        <div className="min-h-screen flex flex-col md:flex-row relative">

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-xl z-[60] text-sm font-bold animate-fade-in-down flex items-center gap-2">
                    <Icons.Alert className="w-4 h-4 text-green-400" />
                    {toastMessage}
                </div>
            )}

            {/* モバイルヘッダー */}
            <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
                <div className="flex items-center justify-between px-4 py-3">
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-1"><span className="text-blue-600">Card</span>List</h1>
                    <div className="flex items-center gap-3">
                        <button onClick={() => window.location.reload()} className="p-2 text-gray-500 bg-gray-100 rounded-full"><Icons.Refresh className="w-4 h-4" /></button>
                        <button onClick={() => setIsMobileFilterOpen(!isMobileFilterOpen)} className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${isMobileFilterOpen ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                            <Icons.Filter className="w-4 h-4" /> Filter {activeFilters.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1 rounded-full ml-1">{activeFilters.length}</span>}
                        </button>
                    </div>
                </div>

                <div className="px-4 pb-3">
                    <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-medium">
                        <button onClick={() => setActiveTab('member')} className={`flex-1 py-1.5 rounded-md transition-colors ${activeTab === 'member' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>メンバー</button>
                        <button onClick={() => setActiveTab('live')} className={`flex-1 py-1.5 rounded-md transition-colors ${activeTab === 'live' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}>ライブ</button>
                        <button onClick={() => setActiveTab('deck')} className={`flex-1 py-1.5 rounded-md transition-colors ${activeTab === 'deck' ? 'bg-gray-800 shadow text-white' : 'text-gray-500'}`}>デッキ</button>
                    </div>
                </div>

                {activeTab !== 'deck' && (
                    <div className="px-4 pb-3">
                        <div className="relative shadow-sm">
                            <input
                                type="text"
                                placeholder="名前・テキスト・コスト (スペースでAND検索)"
                                value={filterName}
                                onChange={(e) => setFilterName(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none text-sm bg-gray-50"
                            />
                            <div className="absolute left-3 top-2.5 text-gray-400"><Icons.Search className="w-4 h-4" /></div>
                            {filterName && (
                                <button onClick={() => setFilterName('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-red-500 transition-colors">
                                    <Icons.Close className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {!isMobileFilterOpen && activeFilters.length > 0 && activeTab !== 'deck' && (
                    <div className="px-4 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
                        {activeFilters.map(f => <ActiveFilterBadge key={f.id} label={f.label} onRemove={f.fn} isExclude={f.isExclude} />)}
                        <button onClick={resetAll} className="text-xs text-red-500 underline whitespace-nowrap ml-1">Clear All</button>
                    </div>
                )}
                {isMobileFilterOpen && (
                    <div className="border-t border-gray-100 bg-white px-4 py-4 max-h-[70vh] overflow-y-auto shadow-lg"><FilterPanel {...filterProps} isMobile={true} /></div>
                )}
            </div>

            {/* PCサイドバー */}
            <aside className="hidden md:flex w-80 bg-white border-r border-gray-200 p-6 flex-col h-screen sticky top-0 overflow-y-auto flex-shrink-0">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><span className="text-blue-600">Card</span>List</h1>
                    {activeTab !== 'deck' && <button onClick={resetAll} className="text-xs flex items-center gap-1 text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 px-2 py-1 rounded transition-colors"><Icons.Close className="w-3 h-3" /> Reset</button>}
                </div>
                <FilterPanel {...filterProps} />
            </aside>

            {/* メインコンテンツ */}
            <div className="flex-1 p-4 md:p-6 bg-gray-50 min-h-screen">

                {activeTab === 'deck' && (
                    <DeckManagerPanel
                        isDeckManagerOpen={isDeckManagerOpen}
                        setIsDeckManagerOpen={setIsDeckManagerOpen}
                        savedDecks={savedDecks}
                        selectedDeckId={selectedDeckId}
                        deckNameInput={deckNameInput}
                        ioText={ioText}
                        setIoText={setIoText}
                        setDeckNameInput={setDeckNameInput}
                        onSelectSavedDeck={handleSelectSavedDeck}
                        onSaveDeck={handleSaveDeck}
                        onLoadDeck={handleLoadDeck}
                        onDeleteDeck={handleDeleteDeck}
                        onExportFile={handleExportFile}
                        onImportFile={handleImportFile}
                        onExportText={handleExportText}
                        onImportText={handleImportText}
                        onCopyToClipboard={copyToClipboard}
                    />
                )}

                {/* ツールバー（件数表示・ソート・ビュー切り替え） */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                    <div className="text-xs md:text-sm text-gray-500">
                        {activeTab === 'deck' ? (
                            <div className="flex gap-3">
                                <span className={`font-bold ${deckStats.memberTotal > 48 ? 'text-red-500' : 'text-gray-800'}`}>メンバー: {deckStats.memberTotal} / 48</span>
                                <span className={`font-bold ${deckStats.liveTotal > 12 ? 'text-red-500' : 'text-gray-800'}`}>ライブ: {deckStats.liveTotal} / 12</span>
                            </div>
                        ) : (
                            <><span>{activeTab === 'member' ? 'Member' : 'Live'} Cards: </span><span className="font-bold text-gray-800">{displayList.length}</span> / {currentTabData.length}</>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        {activeTab !== 'deck' && (
                            <select value={`${sortConfig.key}-${sortConfig.direction}`} onChange={(e) => { const [k, d] = e.target.value.split('-'); setSortConfig({ key: k, direction: d }); }} className="flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                {activeTab === 'member' && (
                                    <>
                                        <option value="cost-asc">Cost 昇順</option><option value="cost-desc">Cost 降順</option>
                                        <option value="baseStats-asc">BaseStats 昇順</option><option value="baseStats-desc">BaseStats 降順</option>
                                        <option value="maxStats-asc">MaxStats 昇順</option><option value="maxStats-desc">MaxStats 降順</option>
                                    </>
                                )}
                                {activeTab === 'live' && (
                                    <>
                                        <option value="score-asc">Score 昇順</option><option value="score-desc">Score 降順</option>
                                        <option value="req-asc">Cost 昇順</option><option value="req-desc">Cost 降順</option>
                                    </>
                                )}
                            </select>
                        )}
                        <div className="flex bg-white rounded border border-gray-300 p-0.5">
                            {activeTab === 'deck' && (
                                <button onClick={() => setViewMode('compact')} className={`p-1.5 rounded transition-all ${actualViewMode === 'compact' ? 'bg-gray-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="Compact View"><Icons.Maximize /></button>
                            )}
                            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded transition-all ${actualViewMode === 'grid' ? 'bg-gray-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="Grid View"><Icons.Grid /></button>
                            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded transition-all ${actualViewMode === 'list' ? 'bg-gray-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="List View"><Icons.List /></button>
                        </div>
                        <button onClick={() => window.location.reload()} className="hidden md:flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-50 transition text-sm"><Icons.Refresh className="w-4 h-4" /> Sync</button>
                    </div>
                </div>

                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 text-sm">{error}</div>}
                {loading && <div className="flex flex-col items-center justify-center h-64"><div className="loader mb-4"></div><p className="text-gray-500">Loading...</p></div>}

                {!loading && !error && (
                    <>
                        {activeTab === 'deck' && displayList.length > 0 && (
                            <DeckStatsBar deckStats={deckStats} onClearDeck={handleClearDeck} />
                        )}

                        {activeTab === 'deck' ? (
                            <div className="space-y-4 md:space-y-6">
                                {renderDeckSection('メンバーカード', sortedDeckCards.member, 'border-blue-200')}
                                {renderDeckSection('ライブカード', sortedDeckCards.live, 'border-pink-200')}
                            </div>
                        ) : actualViewMode === 'grid' ? (
                            renderCardGrid(displayList)
                        ) : (
                            renderCardList(displayList)
                        )}

                        {displayList.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-400 text-sm">
                                <Icons.Search className="w-8 h-8 mb-2 opacity-30" />
                                <p>{activeTab === 'deck' ? 'デッキにカードがありません。' : 'No cards found.'}</p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* フルスクリーン画像モーダル */}
            {selectedItem && (
                <ImageModal
                    selectedItem={selectedItem}
                    onClose={setSelectedItem}
                    sourceList={activeTab === 'deck' ? displayList : sortedData}
                    deckCount={getDeckCount(selectedItem)}
                    onAdd={addCardToDeck}
                    onRemove={removeCardFromDeck}
                />
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
