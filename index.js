// ============ 世界书条目 - 独立展开小圆按钮 ============
(() => {
    const KEY = '__wi_dot_button__';
    window[KEY]?.dispose?.();

    const STYLE_ID = 'wi-dot-button-style';
    const HEADER_SEL = '#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-header';
    const TOGGLE_SEL = `${HEADER_SEL} .inline-drawer-toggle`;
    const MARK = 'wi-dot-button';

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
@media (max-width: 600px) {
    /* 头部右侧腾出按钮位 */
    ${HEADER_SEL} {
        position: relative !important;
        padding-right: 40px !important;
    }

    /* 原生展开按钮 → 独立小圆按钮，钉在右侧 */
    ${TOGGLE_SEL} {
        position: absolute !important;
        top: 50% !important;
        right: 6px !important;
        transform: translateY(-50%) !important;
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        min-height: 28px !important;
        border-radius: 50% !important;
        background: var(--SmartThemeBlurTintColor, #222) !important;
        border: 1px solid var(--SmartThemeBorderColor, #777) !important;
        color: var(--SmartThemeBodyColor, #eee) !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        margin: 0 !important;
        z-index: 5 !important;
        cursor: pointer !important;
    }

    /* 箭头居中 */
    ${TOGGLE_SEL}::before {
        position: static !important;
        inset: auto !important;
        transform: none !important;
        margin: 0 !important;
        font-size: 13px !important;
        line-height: 1 !important;
    }
}
`;
        document.head.append(style);
    }

    function apply() {
        // 样式注入一次即可，DOM 元素不用动 —— 原生按钮挪个位置就行
        injectStyle();
    }

    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    const instance = {
        dispose() {
            observer.disconnect();
            document.getElementById(STYLE_ID)?.remove();
            delete window[KEY];
        }
    };

    window[KEY] = instance;
    apply();
})();
