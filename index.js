// ============ 常量 ============
const WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY = '__baiBaiToolkitWorldInfoVueListOptimization';
const WORLD_INFO_MOBILE_HEADER_LAYOUT_STYLE_ID = 'bai_bai_toolkit_world_info_mobile_header_layout_style';

// ============ 状态 ============
let settings = {};
let extensionState = {};
const LOG_PREFIX = '[WIOpt]';

function getWorldInfoVueListOptimizationState() {
    if (!extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY] || typeof extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY] !== 'object') {
        extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY] = {
            enabled: false,
            app: null,
            root: null,
            modulePromise: null,
            renderToken: 0,
            activeAppendCapture: null,
            originalAppend: null,
            patchedAppend: null,
            originalPagination: null,
            patchedPagination: null,
            renderQueue: null,
            mobileHeaderLayoutHandler: null,
            mobileHeaderLayoutMediaQuery: null,
            mobileLayoutMutationObserver: null,
        };
    }
    return extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY];
}

// ============ 入口 ============
jQuery(async () => {
    settings.worldInfoListOptimizationEnabled = true;
    applyWorldInfoListOptimization();

    // 监听世界书面板打开
    const observer = new MutationObserver(() => {
        const list = document.getElementById('world_popup_entries_list');
        if (list instanceof HTMLElement && settings.worldInfoListOptimizationEnabled) {
            installWorldInfoMobileHeaderLayoutWatcher();
            installWorldInfoMobileLayoutMutationObserver();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
});// ============ 列表优化 ============
function applyWorldInfoListOptimization() {
    const state = getWorldInfoVueListOptimizationState();
    state.enabled = Boolean(settings.worldInfoListOptimizationEnabled);

    if (state.enabled) {
        installWorldInfoVueListPaginationPatch(state);
        installWorldInfoMobileHeaderLayoutStyle();
        installWorldInfoMobileHeaderLayoutWatcher(state);
        installWorldInfoMobileLayoutMutationObserver(state);
    } else {
        unmountWorldInfoVueListApp(state);
        restoreWorldInfoVueListPaginationPatch(state);
        removeWorldInfoMobileLayoutMutationObserver(state);
        removeWorldInfoMobileHeaderLayoutWatcher(state);
        restoreWorldInfoMobileExpandedLayouts();
        restoreWorldInfoMobileHeaderLayouts();
        removeWorldInfoMobileHeaderLayoutStyle();
    }
}

function installWorldInfoVueListPaginationPatch(state = getWorldInfoVueListOptimizationState()) {
    if (state.patchedPagination && globalThis.jQuery?.fn?.pagination === state.patchedPagination) {
        return;
    }

    const originalPagination = globalThis.jQuery?.fn?.pagination;

    if (typeof originalPagination !== 'function') {
        console.warn(`${LOG_PREFIX} jQuery.pagination 不可用`);
        return;
    }

    function patchedPagination(...args) {
        if (settings.worldInfoListOptimizationEnabled && shouldWrapWorldInfoPaginationCall(this, args)) {
            const options = { ...args[0] };
            const nativeCallback = options.callback;

            if (!nativeCallback?.__baiBaiToolkitWorldInfoVueListWrapped) {
                options.callback = function worldInfoVueListPaginationCallback(page, ...callbackArgs) {
                    if (!settings.worldInfoListOptimizationEnabled) {
                        return nativeCallback.call(this, page, ...callbackArgs);
                    }
                    return renderWorldInfoVueListFromNativeCallback(nativeCallback, this, page, callbackArgs);
                };
                options.callback.__baiBaiToolkitWorldInfoVueListWrapped = true;
                options.callback.__baiBaiToolkitWorldInfoVueListOriginal = nativeCallback;
            }

            args[0] = options;
        }
        return originalPagination.apply(this, args);
    }

    patchedPagination.__baiBaiToolkitWorldInfoVueListPatched = true;
    patchedPagination.__baiBaiToolkitOriginalPagination = originalPagination;
    Object.assign(patchedPagination, originalPagination);

    state.originalPagination = originalPagination;
    state.patchedPagination = patchedPagination;
    globalThis.jQuery.fn.pagination = patchedPagination;
}

function restoreWorldInfoVueListPaginationPatch(state = getWorldInfoVueListOptimizationState()) {
    if (!state.patchedPagination || !globalThis.jQuery?.fn) return;
    if (globalThis.jQuery.fn.pagination === state.patchedPagination && typeof state.originalPagination === 'function') {
        globalThis.jQuery.fn.pagination = state.originalPagination;
    }
    state.originalPagination = null;
    state.patchedPagination = null;
}

function shouldWrapWorldInfoPaginationCall(targets, args) {
    const options = args[0];
    return options && typeof options === 'object' && !Array.isArray(options)
        && typeof options.callback === 'function'
        && targets?.length === 1
        && targets[0] instanceof Element
        && targets[0].id === 'world_info_pagination';
}

function installWorldInfoVueListAppendCapturePatch(state = getWorldInfoVueListOptimizationState()) {
    if (state.patchedAppend && globalThis.jQuery?.fn?.append === state.patchedAppend) return;

    const originalAppend = globalThis.jQuery?.fn?.append;
    if (typeof originalAppend !== 'function') {
        console.warn(`${LOG_PREFIX} jQuery.append 不可用`);
        return;
    }

    function patchedAppend(...args) {
        const capture = state.activeAppendCapture;
        if (settings.worldInfoListOptimizationEnabled
            && capture?.list
            && this?.length === 1
            && this[0] === capture.list) {
            capture.appendCalls.push(args);
            return this;
        }
        return originalAppend.apply(this, args);
    }

    patchedAppend.__baiBaiToolkitWorldInfoVueListAppendPatched = true;
    patchedAppend.__baiBaiToolkitOriginalAppend = originalAppend;
    Object.assign(patchedAppend, originalAppend);

    state.originalAppend = originalAppend;
    state.patchedAppend = patchedAppend;
    globalThis.jQuery.fn.append = patchedAppend;
}

function restoreWorldInfoVueListAppendCapturePatch(state = getWorldInfoVueListOptimizationState()) {
    if (!state.patchedAppend || !globalThis.jQuery?.fn) return;
    if (globalThis.jQuery.fn.append === state.patchedAppend && typeof state.originalAppend === 'function') {
        globalThis.jQuery.fn.append = state.originalAppend;
    }
    state.activeAppendCapture = null;
    state.originalAppend = null;
    state.patchedAppend = null;
}

async function renderWorldInfoVueListFromNativeCallback(nativeCallback, callbackThis, page, callbackArgs) {
    const state = getWorldInfoVueListOptimizationState();
    const previousRender = state.renderQueue || Promise.resolve();
    const render = previousRender
        .catch(() => { })
        .then(() => renderWorldInfoVueListFromNativeCallbackLocked(state, nativeCallback, callbackThis, page, callbackArgs));
    const cleanup = render.finally(() => {
        if (state.renderQueue === cleanup) state.renderQueue = null;
    });
    state.renderQueue = cleanup;
    return render;
}

async function renderWorldInfoVueListFromNativeCallbackLocked(state, nativeCallback, callbackThis, page, callbackArgs) {
    const list = document.getElementById('world_popup_entries_list');

    if (!settings.worldInfoListOptimizationEnabled || !(list instanceof HTMLElement) || typeof nativeCallback !== 'function') {
        return nativeCallback.call(callbackThis, page, ...callbackArgs);
    }

    unmountWorldInfoVueListApp(state);

    const capture = { list, appendCalls: [] };
    state.activeAppendCapture = capture;
    installWorldInfoVueListAppendCapturePatch(state);
    const append = state.originalAppend;

    try {
        const result = await nativeCallback.call(callbackThis, page, ...callbackArgs);

        if (!settings.worldInfoListOptimizationEnabled) {
            restoreWorldInfoVueListAppendCapturePatch(state);
            appendCapturedWorldInfoListCalls(state, list, capture.appendCalls, append);
            return result;
        }

        if (state.activeAppendCapture !== capture) {
            restoreWorldInfoVueListAppendCapturePatch(state);
            return result;
        }

        state.activeAppendCapture = null;
        restoreWorldInfoVueListAppendCapturePatch(state);

        if (capture.appendCalls.length === 0) return result;

        await mountWorldInfoVueListApp(state, list, capture.appendCalls, append);
        return result;
    } catch (error) {
        console.debug(`${LOG_PREFIX} 渲染失败`, error);
        state.activeAppendCapture = null;
        restoreWorldInfoVueListAppendCapturePatch(state);
        appendCapturedWorldInfoListCalls(state, list, capture.appendCalls, append);
        throw error;
    } finally {
        if (state.activeAppendCapture === capture) state.activeAppendCapture = null;
        restoreWorldInfoVueListAppendCapturePatch(state);
    }
}

async function mountWorldInfoVueListApp(state, list, appendCalls, append) {
    const vue = await loadWorldInfoVueListModule(state);
    const renderToken = ++state.renderToken;
    unmountWorldInfoVueListApp(state);

    state.root = list;
    state.app = vue.createApp(createWorldInfoVueListRootComponent(vue, {
        state, list, appendCalls, append, renderToken,
    }));
    state.app.mount(list);
}

function createWorldInfoVueListRootComponent(vue, context) {
    return {
        name: 'BaiBaiWorldInfoVueList',
        setup() {
            vue.onMounted(() => {
                if (context.state.renderToken !== context.renderToken || !settings.worldInfoListOptimizationEnabled) return;
                appendCapturedWorldInfoListCalls(context.state, context.list, context.appendCalls, context.append);
                refreshWorldInfoVueListAfterAppend(context.list);
            });
            return () => null;
        },
    };
}

function appendCapturedWorldInfoListCalls(state, list, appendCalls, appendOverride = null) {
    if (!(list instanceof HTMLElement) || !Array.isArray(appendCalls) || appendCalls.length === 0) return;

    const append = appendOverride || state.originalAppend;

    if (typeof append !== 'function') {
        for (const args of appendCalls) list.append(...normalizeWorldInfoAppendArguments(args));
        return;
    }

    const target = globalThis.jQuery?.(list);
    if (!target) return;
    for (const args of appendCalls) append.apply(target, args);
}

function normalizeWorldInfoAppendArguments(args) {
    const nodes = [];
    for (const arg of args) {
        if (arg instanceof Node) nodes.push(arg);
        else if (arg?.jquery && typeof arg.toArray === 'function') nodes.push(...arg.toArray());
        else if (Array.isArray(arg)) {
            for (const item of arg) {
                if (item instanceof Node) nodes.push(item);
                else if (item?.jquery && typeof item.toArray === 'function') nodes.push(...item.toArray());
            }
        } else if (typeof arg === 'string') {
            const template = document.createElement('template');
            template.innerHTML = arg;
            nodes.push(...template.content.childNodes);
        }
    }
    return nodes;
}

function refreshWorldInfoVueListAfterAppend(list) {
    applyWorldInfoMobileHeaderLayouts(list);
    applyWorldInfoMobileExpandedLayouts(list);
}

function unmountWorldInfoVueListApp(state = getWorldInfoVueListOptimizationState()) {
    if (!state.app) return;
    try { state.app.unmount(); } catch (error) { console.debug(`${LOG_PREFIX} 卸载失败`, error); }
    state.app = null;
    state.root = null;
}

async function loadWorldInfoVueListModule(state = getWorldInfoVueListOptimizationState()) {
    if (!state.modulePromise) state.modulePromise = import('vue');
    return state.modulePromise;
              }// ============ 移动端布局 ============
function installWorldInfoMobileHeaderLayoutWatcher(state = getWorldInfoVueListOptimizationState()) {
    if (state.mobileHeaderLayoutHandler) return;

    const mediaQuery = globalThis.matchMedia?.('(max-width: 600px)');
    const handler = () => {
        const list = document.getElementById('world_popup_entries_list');
        if (!(list instanceof HTMLElement)) return;

        if (shouldUseWorldInfoMobileHeaderLayout()) {
            applyWorldInfoMobileHeaderLayouts(list);
            applyWorldInfoMobileExpandedLayouts(list);
        } else {
            restoreWorldInfoMobileExpandedLayouts(list);
            restoreWorldInfoMobileHeaderLayouts(list);
        }
    };

    state.mobileHeaderLayoutHandler = handler;
    state.mobileHeaderLayoutMediaQuery = mediaQuery || null;

    if (mediaQuery?.addEventListener) mediaQuery.addEventListener('change', handler);
    else if (mediaQuery?.addListener) mediaQuery.addListener(handler);
    else globalThis.addEventListener?.('resize', handler);

    handler();
}

function removeWorldInfoMobileHeaderLayoutWatcher(state = getWorldInfoVueListOptimizationState()) {
    const handler = state.mobileHeaderLayoutHandler;
    const mediaQuery = state.mobileHeaderLayoutMediaQuery;
    if (!handler) return;

    if (mediaQuery?.removeEventListener) mediaQuery.removeEventListener('change', handler);
    else if (mediaQuery?.removeListener) mediaQuery.removeListener(handler);
    else globalThis.removeEventListener?.('resize', handler);

    state.mobileHeaderLayoutHandler = null;
    state.mobileHeaderLayoutMediaQuery = null;
}

function installWorldInfoMobileLayoutMutationObserver(state = getWorldInfoVueListOptimizationState()) {
    if (state.mobileLayoutMutationObserver) return;

    const list = document.getElementById('world_popup_entries_list');
    if (!(list instanceof HTMLElement) || typeof MutationObserver !== 'function') return;

    const observer = new MutationObserver(mutations => {
        if (!settings.worldInfoListOptimizationEnabled) return;

        let shouldRefresh = false;
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches('.world_entry_edit') || node.querySelector?.('.world_entry_edit')) {
                    shouldRefresh = true;
                    break;
                }
            }
            if (shouldRefresh) break;
        }
        if (!shouldRefresh) return;

        if (shouldUseWorldInfoMobileHeaderLayout()) {
            applyWorldInfoMobileHeaderLayouts(list);
            applyWorldInfoMobileExpandedLayouts(list);
        } else {
            restoreWorldInfoMobileExpandedLayouts(list);
            restoreWorldInfoMobileHeaderLayouts(list);
        }
    });

    observer.observe(list, { childList: true, subtree: true });
    state.mobileLayoutMutationObserver = observer;
}

function removeWorldInfoMobileLayoutMutationObserver(state = getWorldInfoVueListOptimizationState()) {
    state.mobileLayoutMutationObserver?.disconnect();
    state.mobileLayoutMutationObserver = null;
}

function shouldUseWorldInfoMobileHeaderLayout() {
    return settings.worldInfoListOptimizationEnabled
        && Boolean(globalThis.matchMedia?.('(max-width: 600px)').matches);
}

function applyWorldInfoMobileHeaderLayouts(root = document) {
    if (!shouldUseWorldInfoMobileHeaderLayout()) {
        restoreWorldInfoMobileHeaderLayouts(root);
        return;
    }
    getWorldInfoEntryElements(root).forEach(entry => applyWorldInfoMobileHeaderLayout(entry));
}

function applyWorldInfoMobileExpandedLayouts(root = document) {
    if (!shouldUseWorldInfoMobileHeaderLayout()) {
        restoreWorldInfoMobileExpandedLayouts(root);
        return;
    }
    getWorldInfoEntryElements(root).forEach(entry => {
        entry.querySelectorAll(':scope .world_entry_edit').forEach(edit => applyWorldInfoMobileExpandedLayout(edit));
    });
}

function getWorldInfoEntryElements(root = document) {
    if (root instanceof HTMLElement && root.matches('#world_popup_entries_list > .world_entry')) return [root];
    if (root instanceof HTMLElement && root.id === 'world_popup_entries_list') {
        return Array.from(root.querySelectorAll(':scope > .world_entry'));
    }
    return Array.from(root.querySelectorAll?.('#world_popup_entries_list > .world_entry') ?? []);
      }function applyWorldInfoMobileHeaderLayout(entry) {
    if (!(entry instanceof HTMLElement) || entry.dataset.baiBaiWorldInfoMobileHeaderLayout === 'true') return;

    const header = entry.querySelector(':scope > .world_entry_form > .inline-drawer > .inline-drawer-header');
    const thinControls = header?.querySelector(':scope > .world_entry_thin_controls');
    const body = thinControls?.querySelector(':scope > .flex-container.alignitemscenter.wide100p');
    const titleStatus = body?.querySelector(':scope > .WIEntryTitleAndStatus');
    const controls = body?.querySelector(':scope > .WIEnteryHeaderControls');
    const dragHandle = header?.querySelector(':scope > .drag-handle');
    const toggle = thinControls?.querySelector(':scope > .inline-drawer-toggle');
    const killSwitch = thinControls?.querySelector(':scope > .killSwitch');
    const moveButton = header?.querySelector(':scope > .move_entry_button');
    const duplicateButton = header?.querySelector(':scope > .duplicate_entry_button');
    const deleteButton = header?.querySelector(':scope > .delete_entry_button');
    const positionBlock = controls?.querySelector(':scope > [name="PositionBlock"]');
    const depthBlock = controls?.querySelector('input[name="depth"]')?.closest('.world_entry_form_control');
    const orderBlock = controls?.querySelector('input[name="order"]')?.closest('.world_entry_form_control');
    const probabilityBlock = controls?.querySelector(':scope > .probabilityContainer');
    const entryStateSelector = titleStatus?.querySelector('select[name="entryStateSelector"]');
    const positionLabel = positionBlock?.querySelector(':scope > label');
    const depthLabel = depthBlock?.querySelector(':scope > label');

    if (!(header instanceof HTMLElement) || !(thinControls instanceof HTMLElement)
        || !(titleStatus instanceof HTMLElement) || !(controls instanceof HTMLElement)
        || !(toggle instanceof HTMLElement) || !(killSwitch instanceof HTMLElement)
        || !(positionBlock instanceof HTMLElement) || !(depthBlock instanceof HTMLElement)
        || !(orderBlock instanceof HTMLElement) || !(probabilityBlock instanceof HTMLElement)
        || !(positionLabel instanceof HTMLElement) || !(depthLabel instanceof HTMLElement)) {
        return;
    }

    const originalNodes = [dragHandle, thinControls, moveButton, duplicateButton, deleteButton]
        .filter(node => node instanceof Node);
    const placeholders = new Map();
    for (const node of originalNodes) {
        const placeholder = document.createComment('wi-mobile-header-placeholder');
        node.before(placeholder);
        placeholders.set(node, placeholder);
    }

    const layout = document.createElement('div');
    layout.className = 'bai-bai-wi-mobile-header';
    const hiddenStash = document.createElement('div');
    hiddenStash.className = 'bai-bai-wi-mobile-hidden-stash';
    hiddenStash.hidden = true;
    hiddenStash.append(thinControls);

    const grid = document.createElement('div');
    grid.className = 'bai-bai-wi-mobile-header-grid';

    const titleCell = document.createElement('div');
    titleCell.className = 'bai-bai-wi-mobile-title-cell';
    titleCell.append(titleStatus);

    const stateCell = document.createElement('div');
    stateCell.className = 'bai-bai-wi-mobile-state-cell';
    if (entryStateSelector instanceof HTMLElement) stateCell.append(entryStateSelector);

    const menuCell = document.createElement('div');
    menuCell.className = 'bai-bai-wi-mobile-menu-cell';
    if (dragHandle instanceof HTMLElement) menuCell.append(dragHandle);

    const positionLabelCell = document.createElement('div');
    positionLabelCell.className = 'bai-bai-wi-mobile-position-label-cell';
    positionLabelCell.append(positionLabel);

    const depthLabelCell = document.createElement('div');
    depthLabelCell.className = 'bai-bai-wi-mobile-depth-label-cell';
    depthLabelCell.append(depthLabel);

    const labelSpacerCell = document.createElement('div');
    labelSpacerCell.className = 'bai-bai-wi-mobile-label-spacer-cell';

    const positionCell = document.createElement('div');
    positionCell.className = 'bai-bai-wi-mobile-position-cell';
    positionCell.append(positionBlock);

    const depthCell = document.createElement('div');
    depthCell.className = 'bai-bai-wi-mobile-depth-cell';
    depthCell.append(depthBlock);

    const enabledCell = document.createElement('div');
    enabledCell.className = 'bai-bai-wi-mobile-enabled-cell';
    enabledCell.append(killSwitch);

    grid.append(
        titleCell, stateCell, menuCell,
        positionLabelCell, depthLabelCell, labelSpacerCell,
        positionCell, depthCell, enabledCell,
    );

    const footer = document.createElement('div');
    footer.className = 'bai-bai-wi-mobile-footer';
    const numberGroup = document.createElement('div');
    numberGroup.className = 'bai-bai-wi-mobile-number-group';
    numberGroup.append(orderBlock, probabilityBlock);

    const actionGroup = document.createElement('div');
    actionGroup.className = 'bai-bai-wi-mobile-action-group';
    [moveButton, duplicateButton, deleteButton].forEach(button => {
        if (button instanceof HTMLElement) actionGroup.append(button);
    });

    const expandSlot = document.createElement('div');
    expandSlot.className = 'bai-bai-wi-mobile-expand-slot';
    expandSlot.append(toggle);

    footer.append(numberGroup, actionGroup, expandSlot);
    layout.append(hiddenStash, grid, footer);
    header.append(layout);

    entry.dataset.baiBaiWorldInfoMobileHeaderLayout = 'true';
    entry.__baiBaiWorldInfoMobileHeaderLayout = {
        placeholders, layout, hiddenStash, nodes: originalNodes, thinControls, body,
        titleStatus, entryStateSelector, positionLabel, depthLabel, controls,
        toggle, killSwitch, positionBlock, depthBlock, orderBlock, probabilityBlock,
    };
}

function restoreWorldInfoMobileHeaderLayouts(root = document) {
    getWorldInfoEntryElements(root)
        .filter(entry => entry.dataset.baiBaiWorldInfoMobileHeaderLayout === 'true')
        .forEach(entry => restoreWorldInfoMobileHeaderLayout(entry));
}

function restoreWorldInfoMobileHeaderLayout(entry) {
    const state = entry?.__baiBaiWorldInfoMobileHeaderLayout;
    if (!(entry instanceof HTMLElement) || !state?.layout) return;

    if (state.titleStatus instanceof HTMLElement && state.entryStateSelector instanceof HTMLElement) {
        state.titleStatus.append(state.entryStateSelector);
    }
    if (state.positionBlock instanceof HTMLElement && state.positionLabel instanceof HTMLElement) {
        state.positionBlock.prepend(state.positionLabel);
    }
    if (state.depthBlock instanceof HTMLElement && state.depthLabel instanceof HTMLElement) {
        state.depthBlock.prepend(state.depthLabel);
    }
    if (state.body instanceof HTMLElement && state.titleStatus instanceof HTMLElement && state.controls instanceof HTMLElement) {
        state.body.append(state.titleStatus, state.controls);
    }
    if (state.controls instanceof HTMLElement) {
        [state.positionBlock, state.depthBlock, state.orderBlock, state.probabilityBlock].forEach(node => {
            if (node instanceof Node) state.controls.append(node);
        });
    }
    if (state.thinControls instanceof HTMLElement) {
        [state.toggle, state.killSwitch, state.body].forEach(node => {
            if (node instanceof Node) state.thinControls.append(node);
        });
    }
    for (const node of state.nodes || []) {
        const placeholder = state.placeholders?.get(node);
        if (node instanceof Node && placeholder instanceof Comment && placeholder.parentNode) {
            placeholder.replaceWith(node);
        }
    }
    state.layout.remove();
    delete entry.__baiBaiWorldInfoMobileHeaderLayout;
    delete entry.dataset.baiBaiWorldInfoMobileHeaderLayout;
}

function applyWorldInfoMobileExpandedLayout(edit) {
    if (!(edit instanceof HTMLElement) || edit.dataset.baiBaiWorldInfoMobileExpandedLayout === 'true') return;

    const mainRow = edit.querySelector(':scope > .flex-container.wide100p.alignitemscenter');
    const keywordsBlock = mainRow?.querySelector(':scope > [name="keywordsAndLogicBlock"]');
    const perEntryOverridesBlock = mainRow?.querySelector(':scope > [name="perEntryOverridesBlock"]');
    const contentBlock = mainRow?.querySelector(':scope > [name="contentAndCharFilterBlock"]');
    const commentContainer = mainRow?.querySelector(':scope > .commentContainer');
    const primaryKeyBlock = keywordsBlock?.querySelector(':scope > .keyprimary');
    const logicBlock = keywordsBlock?.querySelector(':scope > .world_entry_form_control:not(.keyprimary):not(.keysecondary)');
    const secondaryKeyBlock = keywordsBlock?.querySelector(':scope > .keysecondary');
    const contentTextarea = contentBlock?.querySelector('textarea[name="content"]');
    const contentControl = contentTextarea?.closest('.world_entry_form_control');
    const contentHeader = contentControl?.querySelector('label[for="content "] small > span.alignitemscenter');
    const contentTitleGroup = contentHeader?.querySelector(':scope > .alignitemscenter.flex-container');
    const contentMeta = Array.from(contentHeader?.children ?? [])
        .find(child => child instanceof HTMLElement && child !== contentTitleGroup && child.querySelector('.world_entry_form_token_counter'));
    const contentMaximize = contentTitleGroup?.querySelector('.editor_maximize');
    const recursionOptions = Array.from(contentHeader?.children ?? [])
        .find(element => element instanceof HTMLElement && element.querySelector('input[name="excludeRecursion"]'));

    if (!(mainRow instanceof HTMLElement) || !(keywordsBlock instanceof HTMLElement)
        || !(primaryKeyBlock instanceof HTMLElement) || !(contentBlock instanceof HTMLElement)) {
        return;
    }

    const mobileAdvancedBlock = document.createElement('div');
    mobileAdvancedBlock.className = 'bai-bai-wi-mobile-expanded-advanced flex-container flexFlowColumn flexGap10';

    if (contentHeader instanceof HTMLElement) contentHeader.classList.add('bai-bai-wi-mobile-content-header');
    if (contentTitleGroup instanceof HTMLElement) contentTitleGroup.classList.add('bai-bai-wi-mobile-content-title-group');
    if (contentMeta instanceof HTMLElement) contentMeta.classList.add('bai-bai-wi-mobile-content-meta');

    const tokenGapTextNode = compactWorldInfoMobileTokenGap(contentMeta);
    const contentTextareaRowsState = setWorldInfoMobileContentTextareaRows(contentTextarea, 14);

    if (contentMaximize instanceof HTMLElement) {
        contentMaximize.classList.add('bai-bai-wi-mobile-content-maximize');
        contentHeader?.append(contentMaximize);
    }

    [logicBlock, secondaryKeyBlock, recursionOptions].forEach(node => {
        if (node instanceof HTMLElement) mobileAdvancedBlock.append(node);
    });

    const extraNodes = [
        mobileAdvancedBlock.childElementCount > 0 ? mobileAdvancedBlock : null,
        perEntryOverridesBlock,
        commentContainer,
        ...Array.from(edit.children).filter(child => child !== mainRow),
    ].filter(node => node instanceof HTMLElement);

    const placeholders = new Map();
    for (const node of extraNodes) {
        const placeholder = document.createComment('wi-mobile-expanded-placeholder');
        node.before(placeholder);
        placeholders.set(node, placeholder);
    }

    mainRow.classList.add('bai-bai-wi-mobile-expanded-main');

    const extraDrawer = document.createElement('div');
    extraDrawer.className = 'bai-bai-wi-mobile-expanded-extra inline-drawer wide100p flexFlowColumn';

    const extraHeader = document.createElement('div');
    extraHeader.className = 'bai-bai-wi-mobile-expanded-extra-toggle inline-drawer-header inline-drawer-header-pointer';
    const extraTitle = document.createElement('strong');
    extraTitle.textContent = '更多设置';
    const extraIcon = document.createElement('div');
    extraIcon.className = 'fa-solid fa-circle-chevron-down inline-drawer-icon down';
    extraHeader.append(extraTitle, extraIcon);

    const extraContent = document.createElement('div');
    extraContent.className = 'bai-bai-wi-mobile-expanded-extra-content inline-drawer-content flex-container flexFlowColumn flexGap10 paddingBottom5px';
    extraContent.style.display = 'none';
    extraContent.append(...extraNodes);

    const toggleHandler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const expand = getComputedStyle(extraContent).display === 'none';
        extraContent.style.display = expand ? 'flex' : 'none';
        extraIcon.classList.toggle('down', !expand);
        extraIcon.classList.toggle('up', expand);
        extraIcon.classList.toggle('fa-circle-chevron-down', !expand);
        extraIcon.classList.toggle('fa-circle-chevron-up', expand);
    };

    extraHeader.addEventListener('click', toggleHandler);
    extraDrawer.append(extraHeader, extraContent);
    edit.append(extraDrawer);

    edit.dataset.baiBaiWorldInfoMobileExpandedLayout = 'true';
    edit.__baiBaiWorldInfoMobileExpandedLayout = {
        mainRow, keywordsBlock, primaryKeyBlock, mobileAdvancedBlock, logicBlock,
        secondaryKeyBlock, contentHeader, contentTitleGroup, contentMeta, contentMaximize,
        tokenGapTextNode, contentTextareaRowsState, recursionOptions, contentBlock,
        extraDrawer, extraHeader, toggleHandler, placeholders, extraNodes,
    };
}

function restoreWorldInfoMobileExpandedLayouts(root = document) {
    getWorldInfoEntryElements(root).forEach(entry => {
        entry.querySelectorAll(':scope .world_entry_edit[data-bai-bai-world-info-mobile-expanded-layout="true"]')
            .forEach(edit => restoreWorldInfoMobileExpandedLayout(edit));
    });
}

function compactWorldInfoMobileTokenGap(contentMeta) {
    if (!(contentMeta instanceof HTMLElement)) return null;
    const tokenCounter = contentMeta.querySelector('.world_entry_form_token_counter');
    const gapNode = tokenCounter?.previousSibling;
    if (gapNode?.nodeType !== Node.TEXT_NODE || !/[\s\u00a0]+/.test(gapNode.nodeValue || '')) return null;
    const state = { node: gapNode, value: gapNode.nodeValue };
    gapNode.nodeValue = '';
    return state;
}

function setWorldInfoMobileContentTextareaRows(textarea, rows) {
    if (!(textarea instanceof HTMLTextAreaElement)) return null;
    const state = { textarea, rowsAttribute: textarea.getAttribute('rows') };
    textarea.rows = rows;
    return state;
}

function restoreWorldInfoMobileContentTextareaRows(state) {
    if (!(state?.textarea instanceof HTMLTextAreaElement)) return;
    if (state.rowsAttribute === null) state.textarea.removeAttribute('rows');
    else state.textarea.setAttribute('rows', state.rowsAttribute);
}

function restoreWorldInfoMobileExpandedLayout(edit) {
    const state = edit?.__baiBaiWorldInfoMobileExpandedLayout;
    if (!(edit instanceof HTMLElement) || !state?.extraDrawer) return;

    if (state.keywordsBlock instanceof HTMLElement) {
        [state.primaryKeyBlock, state.logicBlock, state.secondaryKeyBlock].forEach(node => {
            if (node instanceof Node) state.keywordsBlock.append(node);
        });
    }

    const contentHeader = state.contentBlock instanceof HTMLElement
        ? state.contentBlock.querySelector('label[for="content "] small > span.alignitemscenter')
        : null;
    if (contentHeader instanceof HTMLElement && state.recursionOptions instanceof HTMLElement) {
        contentHeader.append(state.recursionOptions);
    }
    if (state.contentTitleGroup instanceof HTMLElement && state.contentMaximize instanceof HTMLElement) {
        state.contentTitleGroup.append(state.contentMaximize);
    }
    if (state.tokenGapTextNode?.node?.nodeType === Node.TEXT_NODE) {
        state.tokenGapTextNode.node.nodeValue = state.tokenGapTextNode.value;
    }
    restoreWorldInfoMobileContentTextareaRows(state.contentTextareaRowsState);

    [state.contentHeader, state.contentTitleGroup, state.contentMeta, state.contentMaximize].forEach(node => {
        if (node instanceof HTMLElement) {
            node.classList.remove(
                'bai-bai-wi-mobile-content-header',
                'bai-bai-wi-mobile-content-title-group',
                'bai-bai-wi-mobile-content-meta',
                'bai-bai-wi-mobile-content-maximize',
            );
        }
    });

    state.mainRow?.classList?.remove('bai-bai-wi-mobile-expanded-main');

    for (const node of state.extraNodes || []) {
        const placeholder = state.placeholders?.get(node);
        if (node instanceof Node && placeholder instanceof Comment && placeholder.parentNode) {
            placeholder.replaceWith(node);
        }
    }
    state.extraHeader?.removeEventListener?.('click', state.toggleHandler);
    state.extraDrawer.remove();
    delete edit.__baiBaiWorldInfoMobileExpandedLayout;
    delete edit.dataset.baiBaiWorldInfoMobileExpandedLayout;
}// ============ 样式 ============
function installWorldInfoMobileHeaderLayoutStyle() {
    if (document.getElementById(WORLD_INFO_MOBILE_HEADER_LAYOUT_STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = WORLD_INFO_MOBILE_HEADER_LAYOUT_STYLE_ID;
    style.textContent = `
#world_popup { overflow-x: hidden; }

@media (max-width: 600px) {
    #world_popup_entries_list > .world_entry[data-bai-bai-world-info-mobile-header-layout="true"] > .world_entry_form > .inline-drawer > .inline-drawer-header {
        display: block;
        padding: 0;
    }

    #world_popup_entries_list > .world_entry[data-bai-bai-world-info-mobile-header-layout="true"] {
        margin-top: 15px;
    }

    #world_popup_entries_list > .world_entry[data-bai-bai-world-info-mobile-header-layout="true"] > .world_entry_form.wi-card-entry {
        padding-top: 10px;
        padding-bottom: 10px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-header {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-header-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 46px 20px;
        grid-template-rows: auto auto auto;
        column-gap: 8px;
        row-gap: 0;
        align-items: center;
        width: 100%;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-header textarea,
    #world_popup_entries_list .bai-bai-wi-mobile-header select,
    #world_popup_entries_list .bai-bai-wi-mobile-header input,
    #world_popup_entries_list .bai-bai-wi-mobile-header .menu_button,
    #world_popup_entries_list .bai-bai-wi-mobile-header .inline-drawer-toggle {
        margin: 0 !important;
        box-sizing: border-box;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-title-cell,
    #world_popup_entries_list .bai-bai-wi-mobile-position-cell { min-width: 0; }

    #world_popup_entries_list .bai-bai-wi-mobile-title-cell .WIEntryTitleAndStatus,
    #world_popup_entries_list .bai-bai-wi-mobile-title-cell .WIEntryTitleAndStatus > .flex-container,
    #world_popup_entries_list .bai-bai-wi-mobile-position-cell [name="PositionBlock"] { width: 100%; }

    #world_popup_entries_list .bai-bai-wi-mobile-title-cell textarea[name="comment"],
    #world_popup_entries_list .bai-bai-wi-mobile-state-cell select[name="entryStateSelector"] {
        height: 34px !important;
        min-height: 34px !important;
        box-sizing: border-box;
        padding: 3px 6px !important;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-title-cell textarea[name="comment"] {
        font-size: 14px;
        line-height: 20px !important;
        margin: 0 !important;
        padding-top: 6px !important;
        padding-bottom: 6px !important;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-state-cell select[name="entryStateSelector"] {
        font-size: 0.88em;
        margin: 0 !important;
        padding: 0 !important;
        text-align: left;
        text-align-last: left;
        text-indent: 7px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-position-cell select[name="position"],
    #world_popup_entries_list .bai-bai-wi-mobile-depth-cell input[name="depth"] {
        height: 28px !important;
        min-height: 28px !important;
        box-sizing: border-box;
        padding: 2px 6px !important;
        font-size: 12px !important;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-title-cell textarea[name="comment"],
    #world_popup_entries_list .bai-bai-wi-mobile-position-cell select[name="position"] {
        width: 100%;
        min-width: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-state-cell select[name="entryStateSelector"],
    #world_popup_entries_list .bai-bai-wi-mobile-depth-cell input[name="depth"] {
        width: 46px !important;
        min-width: 46px !important;
        max-width: 46px !important;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-position-label-cell,
    #world_popup_entries_list .bai-bai-wi-mobile-depth-label-cell {
        font-size: 11px;
        line-height: 11px;
        opacity: 0.72;
        margin: 10px 0 3px 0;
        min-height: 11px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-position-label-cell label,
    #world_popup_entries_list .bai-bai-wi-mobile-depth-label-cell label {
        display: block;
        margin: 0;
        padding: 0;
        line-height: 11px;
        pointer-events: none;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-position-cell,
    #world_popup_entries_list .bai-bai-wi-mobile-depth-cell {
        display: flex;
        flex-direction: column;
        justify-content: center;
        margin-top: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-menu-cell,
    #world_popup_entries_list .bai-bai-wi-mobile-enabled-cell {
        display: flex;
        justify-content: center;
        align-items: center;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-enabled-cell {
        align-self: center;
        min-height: 28px;
        padding-bottom: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-menu-cell .drag-handle {
        min-width: 20px;
        text-align: center;
        cursor: grab;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-footer {
        display: flex;
        align-items: end;
        gap: 8px;
        width: 100%;
        margin-top: 10px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-number-group,
    #world_popup_entries_list .bai-bai-wi-mobile-action-group {
        display: flex;
        align-items: end;
        gap: 6px;
        min-width: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-action-group { padding-top: 14px; }

    #world_popup_entries_list .bai-bai-wi-mobile-number-group input[name="order"],
    #world_popup_entries_list .bai-bai-wi-mobile-number-group input[name="probability"] {
        height: 28px !important;
        min-height: 28px !important;
        box-sizing: border-box;
        padding: 2px 6px !important;
        font-size: 12px !important;
        width: 66px !important;
        max-width: 66px !important;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-number-group label {
        font-size: 11px;
        line-height: 11px;
        opacity: 0.72;
        display: block;
        margin: 0 0 3px 0;
        padding: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-action-group .menu_button {
        width: 28px !important;
        min-width: 28px !important;
        max-width: 28px !important;
        height: 28px !important;
        min-height: 28px !important;
        max-height: 28px !important;
        aspect-ratio: 1 / 1;
        box-sizing: border-box;
        flex: 0 0 28px;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 !important;
        margin: 0 !important;
        line-height: 1 !important;
        overflow: hidden;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expand-slot {
        margin-left: auto;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        align-self: flex-end;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expand-slot .inline-drawer-toggle {
        width: 28px !important;
        min-width: 28px !important;
        max-width: 28px !important;
        height: 28px !important;
        min-height: 28px !important;
        max-height: 28px !important;
        aspect-ratio: 1 / 1;
        box-sizing: border-box;
        flex: 0 0 28px;
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 21px;
        line-height: 1 !important;
        overflow: hidden;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expand-slot .inline-drawer-toggle::before {
        position: static !important;
        inset: auto !important;
        display: block !important;
        width: auto !important;
        height: auto !important;
        margin: 0 !important;
        line-height: 1 !important;
        transform: none !important;
        text-align: center !important;
    }

    #world_popup_entries_list .world_entry_edit[data-bai-bai-world-info-mobile-expanded-layout="true"] {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-main {
        width: 100%;
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        gap: 8px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-main [name="keywordsAndLogicBlock"] {
        width: 100%;
        display: block;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-main [name="keywordsAndLogicBlock"] .keyprimary {
        min-width: 0;
        width: 100%;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-main [name="keywordsAndLogicBlock"] .keyprimary > small {
        text-align: left !important;
        align-self: flex-start;
        margin: 15px 0 2px 2px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-main .switch_input_type_icon { display: none !important; }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-advanced { width: 100%; }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-advanced .keysecondary,
    #world_popup_entries_list .bai-bai-wi-mobile-expanded-advanced .world_entry_form_control {
        width: 100%;
        min-width: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-advanced select[name="entryLogicType"] { width: 100%; }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-main [name="contentAndCharFilterBlock"] {
        width: 100%;
        display: flex;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-content-header {
        display: flex !important;
        align-items: center;
        gap: 6px;
        width: 100%;
        margin-top: 6px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-content-title-group {
        justify-content: flex-start;
        min-width: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-content-meta {
        text-align: left;
        opacity: 0.85;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-content-maximize {
        margin-left: auto;
        flex: 0 0 auto;
        margin-top: 0;
        margin-right: 0;
        margin-bottom: 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-main textarea[name="content"] {
        width: 100%;
        min-height: 292px;
        min-height: calc(14lh + 12px);
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-extra {
        width: 100%;
        border-top: 1px solid var(--SmartThemeBorderColor);
        padding-top: 4px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-extra-toggle {
        min-height: 30px;
        padding: 4px 0;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-extra-content {
        width: 100%;
        gap: 8px;
    }

    #world_popup_entries_list .bai-bai-wi-mobile-expanded-extra-content > .flex-container,
    #world_popup_entries_list .bai-bai-wi-mobile-expanded-extra-content [name="perEntryOverridesBlock"] {
        width: 100%;
        flex-flow: column;
        align-items: stretch;
        gap: 6px;
    }

    #world_popup_entries_list > .world_entry[data-bai-bai-world-info-mobile-header-layout="true"] .bai-bai-wi-mobile-hidden-stash {
        display: none !important;
    }
}
`;
    document.head.append(style);
}

function removeWorldInfoMobileHeaderLayoutStyle() {
    document.getElementById(WORLD_INFO_MOBILE_HEADER_LAYOUT_STYLE_ID)?.remove();
      }
