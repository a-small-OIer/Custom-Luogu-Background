// ==UserScript==
// @name         洛谷 - 自定义背景
// @namespace    https://www.luogu.com.cn/
// @version      7.0.1
// @description  多背景随机切换（图片/视频）
// @author       a_small_OIer
// @license      MIT
// @match        https://www.luogu.com.cn/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';
    const DB_NAME = 'LuoguBgDB', STORE_NAME = 'media';
    function openDB() {
        return new Promise((resolve, reject) => {
            const r = indexedDB.open(DB_NAME, 1);
            r.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };
            r.onsuccess = e => resolve(e.target.result);
            r.onerror = e => reject(e.target.error);
        });
    }
    async function dbAdd(media) {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME), req = store.add(media);
        return new Promise((res, rej) => {
            tx.oncomplete = () => res(req.result);
            tx.onerror = rej;
            req.onerror = rej;
        });
    }
    async function dbGet(id) {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readonly'), store = tx.objectStore(STORE_NAME), req = store.get(Number(id));
        return new Promise((res, rej) => {
            req.onsuccess = () => res(req.result);
            req.onerror = rej;
        });
    }
    async function dbDelete(id) {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
        store.delete(Number(id));
        return new Promise((res, rej) => {
            tx.oncomplete = res;
            tx.onerror = rej;
        });
    }
    async function dbClear() {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
        store.clear();
        return new Promise((res, rej) => {
            tx.oncomplete = res;
            tx.onerror = rej;
        });
    }
    async function dbUpdate(id, updates) {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readwrite'), store = tx.objectStore(STORE_NAME);
        const getReq = store.get(Number(id));
        getReq.onsuccess = () => {
            const m = getReq.result;
            if (m) {
                Object.assign(m, updates);
            }
            store.put(m);
        };
        return new Promise((res, rej) => {
            tx.oncomplete = res;
            tx.onerror = rej;
        });
    }
    async function dbAllIds() {
        const db = await openDB(), tx = db.transaction(STORE_NAME, 'readonly'), store = tx.objectStore(STORE_NAME), req = store.getAllKeys();
        return new Promise((res, rej) => {
            req.onsuccess = () => res(req.result.map(String));
            req.onerror = rej;
        });
    }
    function blob2buf(blob) {
        return new Promise((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.onerror = rej;
            r.readAsArrayBuffer(blob);
        });
    }
    function buf2url(buf, mime) {
        return URL.createObjectURL(new Blob([buf], { type: mime }));
    }
    const DEFAULTS = {
        bgIds: [], bgLastUsed: [],
        blur: 0, navOpacity: 0.82, mainOpacity: 0.80, cardOpacity: 0.88, headerOpacity: 0.75, footerOpacity: 0.70,
        bgBrightness: 1.0, bgSaturation: 1.0,
        enableBgLayer: true, panelCollapsed: false
    };
    const MAX = 30;
    function loadSettings() {
        const s = {};
        for (const [k, d] of Object.entries(DEFAULTS)) {
            const v = GM_getValue(k, undefined);
            s[k] = Array.isArray(d) ? ((v !== undefined && v !== null) ? JSON.parse(JSON.stringify(v)) : d) : ((v !== undefined && v !== null) ? v : d);
        }
        s.bgLastUsed = Array.isArray(s.bgLastUsed) ? s.bgLastUsed.slice(0, s.bgIds.length) : [];
        while (s.bgLastUsed.length < s.bgIds.length) {
            s.bgLastUsed.push(0);
        }
        return s;
    }
    function saveSettings(s) {
        if (s.bgLastUsed.length !== s.bgIds.length) {
            s.bgLastUsed = new Array(s.bgIds.length).fill(0);
        }
        Object.entries(s).forEach(([k, v]) => GM_setValue(k, v));
    }
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    async function restoreIfEmpty(s) {
        if (s.bgIds.length === 0) {
            try {
                const ids = await dbAllIds();
                if (ids.length) {
                    s.bgIds = ids;
                    s.bgLastUsed = new Array(ids.length).fill(0);
                    saveSettings(s);
                }
            } catch (e) {
            }
        }
    }
    let saving = false;
    function toast(status) {
        let el = document.getElementById('luogu-upload-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'luogu-upload-toast';
            el.style.cssText = 'position:fixed;bottom:30px;right:30px;z-index:999999;padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.3s;opacity:0;pointer-events:none;';
            document.body.appendChild(el);
        }
        if (status === 'start') {
            saving = true;
            el.textContent = '⏳ 保存中… 请勿离开';
            el.style.background = '#e67e22';
            el.style.opacity = '1';
        } else if (status === 'done') {
            saving = false;
            el.textContent = '✅ 已保存';
            el.style.background = '#2ecc71';
            el.style.opacity = '1';
            setTimeout(() => {
                if (el.textContent === '✅ 已保存') {
                    el.style.opacity = '0';
                }
            }, 2000);
        }
    }
    addEventListener('beforeunload', e => {
        if (saving) {
            e.preventDefault();
            e.returnValue = '保存中，离开将丢失数据';
        }
    });
    function injectStyles() {
        GM_addStyle(`\n.cropper-container{direction:ltr;font-size:0;line-height:0;position:relative;touch-action:none;user-select:none}.cropper-container img{display:block;height:100%;image-orientation:0deg;max-height:none!important;max-width:none!important;min-height:0!important;min-width:0!important;width:100%}.cropper-wrap-box,.cropper-canvas,.cropper-drag-box,.cropper-crop-box,.cropper-modal{bottom:0;left:0;position:absolute;right:0;top:0}.cropper-wrap-box,.cropper-canvas{overflow:hidden}.cropper-drag-box{background-color:#fff;opacity:0}.cropper-modal{background-color:#000;opacity:.5}.cropper-view-box{display:block;height:100%;outline:1px solid #39f;outline-color:rgba(51,153,255,.75);overflow:hidden;width:100%}.cropper-dashed{border:0 dashed #eee;display:block;opacity:.5;position:absolute}.cropper-dashed.dashed-h{border-bottom-width:1px;border-top-width:1px;height:33.33%;left:0;top:33.33%;width:100%}.cropper-dashed.dashed-v{border-left-width:1px;border-right-width:1px;height:100%;left:33.33%;top:0;width:33.33%}.cropper-center{display:block;height:0;left:50%;opacity:.75;position:absolute;top:50%;width:0}.cropper-center:before,.cropper-center:after{background-color:#eee;content:' ';display:block;position:absolute}.cropper-center:before{height:1px;left:-3px;top:0;width:7px}.cropper-center:after{height:7px;left:0;top:-3px;width:1px}.cropper-face,.cropper-line,.cropper-point{display:block;height:100%;opacity:.1;position:absolute;width:100%}.cropper-face{background-color:#fff;left:0;top:0}.cropper-line{background-color:#39f}.cropper-line.line-e{cursor:ew-resize;right:-3px;top:0;width:5px}.cropper-line.line-n{cursor:ns-resize;height:5px;left:0;top:-3px}.cropper-line.line-w{cursor:ew-resize;left:-3px;top:0;width:5px}.cropper-line.line-s{bottom:-3px;cursor:ns-resize;height:5px;left:0}.cropper-point{background-color:#39f;height:5px;opacity:.75;width:5px}.cropper-point.point-e{cursor:ew-resize;margin-top:-3px;right:-3px;top:50%}.cropper-point.point-n{cursor:ns-resize;left:50%;margin-left:-3px;top:-3px}.cropper-point.point-w{cursor:ew-resize;left:-3px;margin-top:-3px;top:50%}.cropper-point.point-s{bottom:-3px;cursor:s-resize;left:50%;margin-left:-3px}.cropper-point.point-ne{cursor:nesw-resize;right:-3px;top:-3px}.cropper-point.point-nw{cursor:nwse-resize;left:-3px;top:-3px}.cropper-point.point-sw{bottom:-3px;cursor:nesw-resize;left:-3px}.cropper-point.point-se{bottom:-3px;cursor:nwse-resize;height:20px;opacity:1;right:-3px;width:20px}@media(min-width:768px){.cropper-point.point-se{height:15px;width:15px}}@media(min-width:992px){.cropper-point.point-se{height:10px;width:10px}}@media(min-width:1200px){.cropper-point.point-se{height:5px;opacity:.75;width:5px}}.cropper-point.point-se:before{background-color:#39f;bottom:-50%;content:' ';display:block;height:200%;opacity:0;position:absolute;right:-50%;width:200%}.cropper-invisible{opacity:0}.cropper-bg{background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAAA3NCSVQICAjb4U/gAAAABlBMVEUAAAD///+l2Z/dAAAAMUlEQVQI12P4//8/Aw3zf7CoWcPAf+BABsz3zw0M/B8YmB8+MDD/f2B4P2FQ/GBQAAAkNxI0kX/LBgAAAABJRU5ErkJggg==')}.cropper-hide{display:block;height:0;position:absolute;width:0}.cropper-hidden{display:none!important}.cropper-move{cursor:move}.cropper-crop{cursor:crosshair}.cropper-disabled .cropper-drag-box,.cropper-disabled .cropper-face,.cropper-disabled .cropper-line,.cropper-disabled .cropper-point{cursor:not-allowed}\nbody{background:transparent!important}#app{background:transparent!important}\n#luogu-bg-layer{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:-10;pointer-events:none;overflow:hidden}\n#luogu-bg-layer .bg-inner{position:absolute;top:-30px;left:-30px;width:calc(100% + 60px);height:calc(100% + 60px);background-size:cover;background-position:center;background-repeat:no-repeat;transition:filter 0.4s ease}\n#luogu-bg-layer video{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover}\n:root{--lgb-nav-opacity:0.82;--lgb-main-opacity:0.80;--lgb-card-opacity:0.88;--lgb-header-opacity:0.75;--lgb-footer-opacity:0.70}\n.top-bar{background-color:rgba(255,255,255,var(--lgb-nav-opacity))!important;backdrop-filter:blur(calc((1 - var(--lgb-nav-opacity)) * 8px));-webkit-backdrop-filter:blur(calc((1 - var(--lgb-nav-opacity)) * 8px))}\n.sidebar.lside,.rside{background-color:rgba(255,255,255,var(--lgb-nav-opacity))!important;backdrop-filter:blur(calc((1 - var(--lgb-nav-opacity)) * 8px));-webkit-backdrop-filter:blur(calc((1 - var(--lgb-nav-opacity)) * 8px))}\n.wrapper.header-layout .background{opacity:var(--lgb-header-opacity)!important}\nfooter{background-color:rgba(255,255,255,var(--lgb-footer-opacity))!important;backdrop-filter:blur(calc((1 - var(--lgb-footer-opacity)) * 8px));-webkit-backdrop-filter:blur(calc((1 - var(--lgb-footer-opacity)) * 8px))}\n.wrapper.wrapped.lfe-body:not(.header-layout) .background{opacity:var(--lgb-footer-opacity)!important}\n.theme-page{--theme-body-image:none!important;--theme-body-back:transparent!important;background:transparent!important}\nmain.lfe-body.mobile-body{background-color:rgba(239,239,239,var(--lgb-main-opacity))!important}\nmain.lcolor-bg-background{background-color:rgba(239,239,239,var(--lgb-main-opacity))!important}\n.l-card,.lg-article,.am-panel,.lg-index-stat,.lg-index-contest,section.am-panel{background-color:rgba(255,255,255,var(--lgb-card-opacity))!important}\n.lg-index-contest .am-panel-bd{background-color:transparent!important}\n.user-header-top{background-color:unset!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}\ndiv[style*="background-color: rgb(255, 255, 255)"]{background-color:transparent!important}\n.article-banner{background-color:transparent!important}\n.top-progress{display:none!important}\n.am-modal-dialog,.dropdown,.am-dropdown-content,.am-selected-content,[class*="dropdown"],.user-nav .dropdown{background-color:rgba(255,255,255,0.98)!important;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}\n.search-wrap input{background-color:rgba(255,255,255,0.95)!important}\n#luogu-cropper-modal{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1000000}\n#luogu-cropper-modal .crop-container{background:#fff;border-radius:12px;padding:20px;max-width:95vw;max-height:90vh}\n#luogu-cropper-modal .crop-header{font-size:16px;font-weight:600;margin-bottom:12px;text-align:center}\n#luogu-cropper-modal .crop-body{max-width:80vw;max-height:60vh;overflow:hidden}\n#luogu-cropper-modal .crop-body img{max-width:100%;display:block}\n#luogu-cropper-modal .crop-footer{margin-top:12px;display:flex;justify-content:flex-end;gap:8px}\n#luogu-cropper-modal button{padding:8px 16px;border:none;border-radius:6px;cursor:pointer;font-size:13px}\n#luogu-cropper-modal .btn-cancel{background:#f0f0f0;color:#333}\n#luogu-cropper-modal .btn-confirm{background:#3498db;color:#fff}\n.bg-upload-btn{display:inline-block;padding:6px 12px;background:#f0f0f0;border:1px solid #ddd;border-radius:6px;cursor:pointer;font-size:12px}\n.bg-upload-btn:hover{background:#e0e0e0}\n.bg-image-list{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}\n.bg-image-item{position:relative;width:50px;height:50px;border-radius:6px;overflow:hidden;border:1px solid #ddd}\n.bg-image-item img{width:100%;height:100%;object-fit:cover}\n.bg-image-item .video-icon{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;background:#f0f0f0}\n.bg-image-item .delete-btn{position:absolute;top:0;right:0;background:rgba(231,76,60,0.8);color:#fff;border:none;width:18px;height:18px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:0 6px 0 6px}\n.bg-image-item .loop-toggle{position:absolute;bottom:0;left:0;background:rgba(0,0,0,0.5);color:#fff;border:none;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;border-radius:0 0 6px 0}\n#luogu-bg-panel{position:fixed;top:50%;right:24px;z-index:99998;transform:translateY(-50%);width:320px;max-width:calc(100vw - 48px);max-height:80vh;overflow-y:auto;background:rgba(255,255,255,0.97);border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.2);padding:20px 18px 16px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#333;transition:all 0.35s cubic-bezier(0.4,0,0.2,1);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);scrollbar-width:thin;scrollbar-color:#ccc transparent}\n#luogu-bg-panel.collapsed{opacity:0;pointer-events:none;transform:translateY(-50%) translateX(120%)}\n#luogu-bg-panel h3{margin:0 0 14px;font-size:16px;font-weight:700;color:#2c3e50;text-align:center}\n#luogu-bg-panel .section-title{font-size:12px;font-weight:600;color:#7f8c8d;margin:14px 0 8px;padding-top:10px;border-top:1px solid #eee;cursor:pointer;display:flex;align-items:center;justify-content:space-between}\n#luogu-bg-panel .section-title:first-of-type{border-top:none;margin-top:4px;padding-top:0}\n#luogu-bg-panel .section-title .arrow{transition:transform 0.3s;font-size:14px}\n#luogu-bg-panel .section-title.collapsed .arrow{transform:rotate(-90deg)}\n#luogu-bg-panel .settings-block{overflow:hidden;transition:max-height 0.4s ease}\n#luogu-bg-panel .settings-block.collapsed{max-height:0!important}\n#luogu-bg-panel input[type="url"],#luogu-bg-panel input[type="text"]{width:100%;padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;font-size:12px;background:#fdfdfd}\n#luogu-bg-panel input:focus{outline:none;border-color:#3498db}\n#luogu-bg-panel .slider-group{display:flex;align-items:center;gap:10px;margin:6px 0}\n#luogu-bg-panel .slider-group label{min-width:60px;font-size:12px;color:#555;text-align:right}\n#luogu-bg-panel .slider-group input[type="range"]{flex:1;-webkit-appearance:none;height:6px;border-radius:3px;background:#e0e0e0}\n#luogu-bg-panel .slider-group input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#3498db;border:2px solid #fff}\n#luogu-bg-panel .slider-group .val-display{min-width:40px;text-align:center;font-size:11px;font-weight:600;color:#2980b9;background:#eaf4fb;padding:3px 6px;border-radius:6px}\n#luogu-bg-panel .btn-row{display:flex;gap:8px;margin-top:14px}\n#luogu-bg-panel .btn-row button{flex:1;padding:9px 0;border-radius:8px;border:none;font-weight:600;cursor:pointer}\n#luogu-bg-panel .btn-reset{background:#f5f5f5;color:#666;border:1px solid #ddd}\n#luogu-bg-panel .btn-reset:hover{background:#e8e8e8}\n#luogu-bg-panel .btn-clearall{background:#e74c3c;color:#fff}\n#luogu-bg-panel .btn-clearall:hover{background:#c0392b}\n#luogu-bg-panel .btn-close{width:100%;margin-top:4px;padding:8px;background:#f5f5f5;color:#888;border:1px solid #ddd;border-radius:8px;cursor:pointer}\n#luogu-bg-panel .btn-close:hover{background:#e0e0e0}\n`);
    }
    function createLayer() {
        let el = document.getElementById('luogu-bg-layer');
        if (el) {
            el.remove();
        }
        el = document.createElement('div');
        el.id = 'luogu-bg-layer';
        el.innerHTML = '<div class="bg-inner"></div>';
        document.body.insertBefore(el, document.body.firstChild);
    }
    async function updateBg(s) {
        const layer = document.getElementById('luogu-bg-layer');
        if (!layer) {
            return;
        }
        const inner = layer.querySelector('.bg-inner');
        if (!inner) {
            return;
        }
        if (!s.enableBgLayer) {
            layer.style.display = 'none';
            return;
        }
        layer.style.display = '';
        inner.innerHTML = '';
        inner.style.backgroundImage = '';
        const oldVid = layer.querySelector('video');
        if (oldVid) {
            oldVid.remove();
        }
        const ids = s.bgIds || [];
        if (!ids.length) {
            inner.style.backgroundImage = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a1a2e 100%)';
            applyFilters(inner, s);
            return;
        }
        const now = Date.now(), last = s.bgLastUsed;
        while (last.length < ids.length) {
            last.push(0);
        }
        let sid;
        if (ids.length === 1) {
            sid = ids[0];
            last[0] = now;
        } else {
            const w = ids.map((_, i) => Math.max(1, now - (last[i] || 0)));
            const t = w.reduce((a, b) => a + b, 0);
            let r = Math.random() * t, idx = 0;
            for (let i = 0; i < w.length; i++) {
                r -= w[i];
                if (r <= 0) {
                    idx = i;
                    break;
                }
            }
            sid = ids[idx];
            last[idx] = now;
        }
        saveSettings(s);
        try {
            const m = await dbGet(sid);
            if (!m?.data) {
                return;
            }
            const url = buf2url(m.data, m.mime);
            if (m.type === 'image') {
                inner.style.backgroundImage = `url(${url})`;
            } else if (m.type === 'video') {
                const v = document.createElement('video');
                v.src = url;
                v.autoplay = true;
                v.muted = true;
                v.playsInline = true;
                v.loop = m.loop !== false;
                v.style.pointerEvents = 'none';
                layer.appendChild(v);
            }
        } catch (e) {
            console.error(e);
        }
        applyFilters(inner, s);
    }
    function applyFilters(inner, s) {
        const f = [];
        if (s.blur > 0) {
            f.push(`blur(${s.blur}px)`);
        }
        if (s.bgBrightness !== 1.0) {
            f.push(`brightness(${s.bgBrightness})`);
        }
        if (s.bgSaturation !== 1.0) {
            f.push(`saturate(${s.bgSaturation})`);
        }
        inner.style.filter = f.join(' ') || 'none';
    }
    function updateVars(s) {
        const r = document.documentElement.style;
        r.setProperty('--lgb-nav-opacity', s.navOpacity);
        r.setProperty('--lgb-main-opacity', s.mainOpacity);
        r.setProperty('--lgb-card-opacity', s.cardOpacity);
        r.setProperty('--lgb-header-opacity', s.headerOpacity);
        r.setProperty('--lgb-footer-opacity', s.footerOpacity);
    }
    async function apply(s) {
        await updateBg(s);
        updateVars(s);
    }
    function openFile() {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*,video/mp4';
        inp.addEventListener('change', async e => {
            const f = e.target.files[0];
            if (!f) {
                return;
            }
            toast('start');
            try {
                const buf = await blob2buf(f);
                if (f.type.startsWith('video/')) {
                    const s = loadSettings();
                    const id = await dbAdd({ type: 'video', mime: f.type, data: buf, loop: true });
                    s.bgIds.push(id.toString());
                    s.bgLastUsed.push(0);
                    if (s.bgIds.length > MAX) {
                        const rm = s.bgIds.shift();
                        s.bgLastUsed.shift();
                        await dbDelete(rm);
                    }
                    saveSettings(s);
                    await apply(s);
                    refreshPanel();
                    toast('done');
                } else {
                    const reader = new FileReader();
                    reader.onload = ev => startCropper(ev.target.result);
                    reader.readAsDataURL(f);
                }
            } catch (er) {
                console.error(er);
                toast('done');
            }
        });
        inp.click();
    }
    function startCropper(src) {
        const modal = document.createElement('div');
        modal.id = 'luogu-cropper-modal';
        modal.innerHTML = `<div class="crop-container"><div class="crop-header"> 裁剪背景板</div><div class="crop-body"><img id="luogu-crop-image"></div><div class="crop-footer"><button class="btn-cancel">取消</button><button class="btn-confirm">确认裁剪</button></div></div>`;
        document.body.appendChild(modal);
        const img = document.getElementById('luogu-crop-image');
        img.crossOrigin = 'anonymous';
        img.src = src;
        img.onload = () => {
            const aspect = innerWidth / innerHeight;
            const cropper = new Cropper(img, { aspectRatio: aspect, viewMode: 1, dragMode: 'move', autoCropArea: 0.8, cropBoxMovable: true, cropBoxResizable: true, background: false });
            const close = () => {
                cropper.destroy();
                modal.remove();
            };
            modal.querySelector('.btn-cancel').addEventListener('click', close);
            modal.addEventListener('click', ev => {
                if (ev.target === modal) {
                    close();
                }
            });
            modal.querySelector('.btn-confirm').addEventListener('click', async () => {
                toast('start');
                try {
                    const maxW = Math.min(2560, innerWidth * 2), maxH = Math.round(maxW / aspect);
                    const canvas = cropper.getCroppedCanvas({ maxWidth: maxW, maxHeight: maxH, fillColor: '#fff', imageSmoothingQuality: 'high' });
                    const blob = await new Promise(res => canvas.toBlob(res, 'image/webp', 0.9));
                    const buf = await blob2buf(blob);
                    const s = loadSettings();
                    const id = await dbAdd({ type: 'image', mime: 'image/webp', data: buf });
                    s.bgIds.push(id.toString());
                    s.bgLastUsed.push(0);
                    if (s.bgIds.length > MAX) {
                        const rm = s.bgIds.shift();
                        s.bgLastUsed.shift();
                        await dbDelete(rm);
                    }
                    saveSettings(s);
                    await apply(s);
                    refreshPanel();
                } catch (er) {
                    console.error(er);
                }
                toast('done');
                close();
            });
        };
        img.onerror = () => {
            alert('图片加载失败');
            modal.remove();
            toast('done');
        };
    }
    async function addUrl(url) {
        toast('start');
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const buf = await blob2buf(blob);
            if (blob.type.startsWith('video/')) {
                const s = loadSettings();
                const id = await dbAdd({ type: 'video', mime: blob.type, data: buf, loop: true });
                s.bgIds.push(id.toString());
                s.bgLastUsed.push(0);
                if (s.bgIds.length > MAX) {
                    const rm = s.bgIds.shift();
                    s.bgLastUsed.shift();
                    await dbDelete(rm);
                }
                saveSettings(s);
                await apply(s);
                refreshPanel();
                toast('done');
            } else {
                const reader = new FileReader();
                reader.onload = e => startCropper(e.target.result);
                reader.readAsDataURL(blob);
            }
        } catch (e) {
            alert('无法加载该 URL');
            toast('done');
        }
    }
    async function buildPanel(s) {
        const pct = v => Math.round(v * 100);
        const cnt = s.bgIds.length;
        let list = '';
        if (cnt) {
            const items = await Promise.all(s.bgIds.map(async (id, i) => {
                try {
                    const m = await dbGet(id);
                    if (!m?.data) {
                        return '';
                    }
                    const url = buf2url(m.data, m.mime);
                    if (m.type === 'image') {
                        return `<div class="bg-image-item" data-index="${i}"><img src="${url}"><button class="delete-btn" data-delete="${i}">×</button></div>`;
                    }
                    const loop = m.loop !== false ? '🔁' : '▶';
                    return `<div class="bg-image-item" data-index="${i}"><div class="video-icon">🎥</div><button class="delete-btn" data-delete="${i}">×</button><button class="loop-toggle" data-loop="${i}">${loop}</button></div>`;
                } catch (e) {
                    return '';
                }
            }));
            list = items.join('');
        }
        return `<h3> 背景设置</h3>
        <div class="section-title"> 媒体管理 (${cnt}/${MAX})</div>
        <div style="display:flex;gap:6px;margin-bottom:6px;">
            <input type="url" id="bg-url-input" placeholder="输入图片/视频URL" style="flex:1;">
            <button class="bg-upload-btn" id="bg-add-url">+</button>
            <button class="bg-upload-btn" id="bg-upload-file">📁</button>
        </div>
        <div class="bg-image-list" id="bg-image-list">${list || '<span style="font-size:12px;color:#999;">暂无媒体</span>'}</div>
        <div class="section-title collapsed" id="toggle-settings">⚙️ 图片设置 <span class="arrow">▼</span></div>
        <div class="settings-block collapsed" id="settings-block">
            <div class="slider-group"><label>模糊度</label><input type="range" id="blur-slider" min="0" max="40" value="${Math.round(s.blur)}" step="1"><span class="val-display" id="blur-val">${Math.round(s.blur)}px</span></div>
            <div class="slider-group"><label>亮度</label><input type="range" id="brightness-slider" min="30" max="200" value="${pct(s.bgBrightness)}" step="5"><span class="val-display" id="brightness-val">${pct(s.bgBrightness)}%</span></div>
            <div class="slider-group"><label>饱和度</label><input type="range" id="saturation-slider" min="0" max="200" value="${pct(s.bgSaturation)}" step="5"><span class="val-display" id="saturation-val">${pct(s.bgSaturation)}%</span></div>
            <div class="section-title" style="margin-top:8px;"> 区域透明度</div>
            <div class="slider-group"><label>导航栏</label><input type="range" id="nav-opacity-slider" min="15" max="100" value="${pct(s.navOpacity)}" step="1"><span class="val-display" id="nav-opacity-val">${pct(s.navOpacity)}%</span></div>
            <div class="slider-group"><label>主内容区</label><input type="range" id="main-opacity-slider" min="15" max="100" value="${pct(s.mainOpacity)}" step="1"><span class="val-display" id="main-opacity-val">${pct(s.mainOpacity)}%</span></div>
            <div class="slider-group"><label>卡片</label><input type="range" id="card-opacity-slider" min="15" max="100" value="${pct(s.cardOpacity)}" step="1"><span class="val-display" id="card-opacity-val">${pct(s.cardOpacity)}%</span></div>
            <div class="slider-group"><label>顶部区域</label><input type="range" id="header-opacity-slider" min="10" max="100" value="${pct(s.headerOpacity)}" step="1"><span class="val-display" id="header-opacity-val">${pct(s.headerOpacity)}%</span></div>
            <div class="slider-group"><label>底部区域</label><input type="range" id="footer-opacity-slider" min="10" max="100" value="${pct(s.footerOpacity)}" step="1"><span class="val-display" id="footer-opacity-val">${pct(s.footerOpacity)}%</span></div>
        </div>
        <div class="btn-row">
            <button class="btn-reset" id="btn-reset"> 恢复默认</button>
            <button class="btn-clearall" id="btn-clearall"> 清空全部</button>
        </div>
        <button class="btn-close" id="btn-close-panel">✕ 关闭</button>`;
    }
    async function refreshPanel() {
        const list = document.getElementById('bg-image-list');
        if (!list) {
            return;
        }
        const s = loadSettings();
        if (!s.bgIds.length) {
            list.innerHTML = '<span style="font-size:12px;color:#999;">暂无媒体</span>';
            return;
        }
        const items = await Promise.all(s.bgIds.map(async (id, i) => {
            try {
                const m = await dbGet(id);
                if (!m?.data) {
                    return '';
                }
                const url = buf2url(m.data, m.mime);
                if (m.type === 'image') {
                    return `<div class="bg-image-item" data-index="${i}"><img src="${url}"><button class="delete-btn" data-delete="${i}">×</button></div>`;
                }
                const loop = m.loop !== false ? '🔁' : '▶';
                return `<div class="bg-image-item" data-index="${i}"><div class="video-icon">🎥</div><button class="delete-btn" data-delete="${i}">×</button><button class="loop-toggle" data-loop="${i}">${loop}</button></div>`;
            } catch (e) {
                return '';
            }
        }));
        list.innerHTML = items.join('');
        list.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', async e => {
            e.stopPropagation();
            const idx = parseInt(b.dataset.delete), s = loadSettings(), id = s.bgIds[idx];
            s.bgIds.splice(idx, 1);
            s.bgLastUsed.splice(idx, 1);
            saveSettings(s);
            await dbDelete(id);
            await apply(s);
            refreshPanel();
        }));
        list.querySelectorAll('.loop-toggle').forEach(b => b.addEventListener('click', async e => {
            e.stopPropagation();
            const idx = parseInt(b.dataset.loop), s = loadSettings(), id = s.bgIds[idx];
            const m = await dbGet(id);
            if (m?.type === 'video') {
                const newLoop = m.loop === false ? true : false;
                await dbUpdate(id, { loop: newLoop });
                b.textContent = newLoop ? '🔁' : '▶';
            }
        }));
    }
    function bindEvents(panel, settings, onChange) {
        panel.querySelector('#bg-upload-file').addEventListener('click', openFile);
        panel.querySelector('#bg-add-url').addEventListener('click', () => {
            const url = panel.querySelector('#bg-url-input').value.trim();
            if (url) {
                addUrl(url);
                panel.querySelector('#bg-url-input').value = '';
            }
        });
        const bindS = (id, vid, get, set, fmt) => {
            const s = panel.querySelector(id), d = panel.querySelector(vid);
            if (!s || !d) {
                return;
            }
            s.addEventListener('input', () => {
                const v = get(s);
                set(settings, v);
                d.textContent = fmt(v);
                onChange(settings);
            });
        };
        bindS('#blur-slider', '#blur-val', s => parseInt(s.value), (s, v) => s.blur = v, v => `${v}px`);
        bindS('#brightness-slider', '#brightness-val', s => parseInt(s.value) / 100, (s, v) => s.bgBrightness = clamp(v, 0.3, 2.0), v => `${Math.round(v * 100)}%`);
        bindS('#saturation-slider', '#saturation-val', s => parseInt(s.value) / 100, (s, v) => s.bgSaturation = clamp(v, 0, 2.0), v => `${Math.round(v * 100)}%`);
        bindS('#nav-opacity-slider', '#nav-opacity-val', s => parseInt(s.value) / 100, (s, v) => s.navOpacity = clamp(v, 0.15, 1), v => `${Math.round(v * 100)}%`);
        bindS('#main-opacity-slider', '#main-opacity-val', s => parseInt(s.value) / 100, (s, v) => s.mainOpacity = clamp(v, 0.15, 1), v => `${Math.round(v * 100)}%`);
        bindS('#card-opacity-slider', '#card-opacity-val', s => parseInt(s.value) / 100, (s, v) => s.cardOpacity = clamp(v, 0.15, 1), v => `${Math.round(v * 100)}%`);
        bindS('#header-opacity-slider', '#header-opacity-val', s => parseInt(s.value) / 100, (s, v) => s.headerOpacity = clamp(v, 0.1, 1), v => `${Math.round(v * 100)}%`);
        bindS('#footer-opacity-slider', '#footer-opacity-val', s => parseInt(s.value) / 100, (s, v) => s.footerOpacity = clamp(v, 0.1, 1), v => `${Math.round(v * 100)}%`);
        const toggle = panel.querySelector('#toggle-settings');
        const block = panel.querySelector('#settings-block');
        toggle.addEventListener('click', () => {
            const collapsed = toggle.classList.toggle('collapsed');
            block.classList.toggle('collapsed', collapsed);
        });
        panel.querySelector('#btn-reset').addEventListener('click', async () => {
            await dbClear();
            Object.assign(settings, DEFAULTS);
            settings.bgIds = [];
            settings.bgLastUsed = [];
            onChange(settings);
            saveSettings(settings);
            refreshPanel();
            refreshUI(panel, settings);
        });
        panel.querySelector('#btn-clearall').addEventListener('click', async () => {
            if (confirm('确定清空所有媒体？')) {
                await dbClear();
                settings.bgIds = [];
                settings.bgLastUsed = [];
                onChange(settings);
                saveSettings(settings);
                refreshPanel();
                refreshUI(panel, settings);
                await apply(settings);
            }
        });
        panel.querySelector('#btn-close-panel').addEventListener('click', () => {
            settings.panelCollapsed = true;
            panel.classList.add('collapsed');
            saveSettings(settings);
        });
    }
    function refreshUI(panel, s) {
        const setV = (id, val) => {
            const el = panel.querySelector(id);
            if (el) {
                el.value = Math.round(val);
            }
        };
        setV('#blur-slider', s.blur);
        setV('#brightness-slider', s.bgBrightness * 100);
        setV('#saturation-slider', s.bgSaturation * 100);
        setV('#nav-opacity-slider', s.navOpacity * 100);
        setV('#main-opacity-slider', s.mainOpacity * 100);
        setV('#card-opacity-slider', s.cardOpacity * 100);
        setV('#header-opacity-slider', s.headerOpacity * 100);
        setV('#footer-opacity-slider', s.footerOpacity * 100);
        panel.querySelector('#blur-val').textContent = s.blur + 'px';
        panel.querySelector('#brightness-val').textContent = Math.round(s.bgBrightness * 100) + '%';
        panel.querySelector('#saturation-val').textContent = Math.round(s.bgSaturation * 100) + '%';
        panel.querySelector('#nav-opacity-val').textContent = Math.round(s.navOpacity * 100) + '%';
        panel.querySelector('#main-opacity-val').textContent = Math.round(s.mainOpacity * 100) + '%';
        panel.querySelector('#card-opacity-val').textContent = Math.round(s.cardOpacity * 100) + '%';
        panel.querySelector('#header-opacity-val').textContent = Math.round(s.headerOpacity * 100) + '%';
        panel.querySelector('#footer-opacity-val').textContent = Math.round(s.footerOpacity * 100) + '%';
    }
    function menu() {
        const side = document.querySelector('nav.sidebar.lside');
        if (side) {
            const grp = [...side.querySelectorAll('.nav-group')].find(g => g.querySelector('.group-title .title')?.textContent.includes('更多功能'));
            if (grp) {
                const ul = grp.querySelector('ul'), ref = [...ul.children].find(li => li.textContent.includes('图片上传'));
                if (ref && !ul.querySelector('[data-bg-custom-menu]')) {
                    const li = ref.cloneNode(true);
                    li.setAttribute('data-bg-custom-menu', 'true');
                    li.querySelector('.title.minor').textContent = '背景设置';
                    const a = li.querySelector('a');
                    a.removeAttribute('href');
                    a.addEventListener('click', e => {
                        e.preventDefault();
                        showPanel();
                    });
                    ul.insertBefore(li, ref);
                }
            }
        } else {
            const old = document.querySelector('nav.lfe-body');
            if (old) {
                const apps = old.querySelector('.popup-wrap .popup .apps');
                const ref = apps?.querySelector('a[href="/ticket"]');
                if (ref && !apps.querySelector('[data-bg-custom-menu-old]')) {
                    const a = ref.cloneNode(true);
                    a.setAttribute('data-bg-custom-menu-old', 'true');
                    a.removeAttribute('href');
                    a.textContent = '背景设置';
                    a.addEventListener('click', e => {
                        e.preventDefault();
                        showPanel();
                    });
                    ref.insertAdjacentElement('afterend', a);
                }
            }
        }
    }
    function showPanel() {
        const p = document.getElementById('luogu-bg-panel');
        if (!p) {
            return;
        }
        p.classList.remove('collapsed');
        const s = loadSettings();
        s.panelCollapsed = false;
        saveSettings(s);
    }
    async function init() {
        injectStyles();
        let s = loadSettings();
        await restoreIfEmpty(s);
        s = loadSettings();
        createLayer();
        await apply(s);
        const panel = await createPanel(s, async upd => {
            await apply(upd);
            saveSettings(upd);
        });
        menu();
        new MutationObserver(menu).observe(document.body, { childList: true, subtree: true });
        new MutationObserver(async () => {
            if (!document.getElementById('luogu-bg-layer')) {
                createLayer();
                await apply(s);
            }
            updateVars(s);
        }).observe(document.body, { childList: true, subtree: true });
    }
    async function createPanel(settings, onChange) {
        const old = document.getElementById('luogu-bg-panel');
        if (old) {
            old.remove();
        }
        const panel = document.createElement('div');
        panel.id = 'luogu-bg-panel';
        if (settings.panelCollapsed) {
            panel.classList.add('collapsed');
        }
        panel.innerHTML = await buildPanel(settings);
        document.body.appendChild(panel);
        bindEvents(panel, settings, onChange);
        await refreshPanel();
        return panel;
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();