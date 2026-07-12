// ==UserScript==
// @name         洛谷 - 自定义背景
// @namespace    https://www.luogu.com.cn/
// @version      5.2.1
// @description  洛谷 - 自定义背景，允许上传多张图片并随机
// @author       a_small_OIer
// @license      MIT
// @match        https://www.luogu.com.cn/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.12/cropper.min.js
// @run-at       document-idle
// ==/UserScript==

(function (){
    'use strict';
    //==================== 默认设置 ====================
    const DEFAULTS = {
        bgUrls: [],
        bgLastUsed: [],
        blur: 0,
        navOpacity: 0.82,
        mainOpacity: 0.80,
        cardOpacity: 0.88,
        headerOpacity: 0.75,
        footerOpacity: 0.70,
        bgBrightness: 1.0,
        bgSaturation: 1.0,
        enableBgLayer: true,
        panelCollapsed: false,
    };
    const MAX_IMAGES = 10;
    //==================== 一些函数 ====================
    function loadSettings(){
        try{
            const s = {};
            for(const [k, def] of Object.entries(DEFAULTS)){
                const v = GM_getValue(k, undefined);
                if (Array.isArray(def)) s[k] = (v !== undefined && v !== null) ? JSON.parse(JSON.stringify(v)) : def;
                else s[k] = (v !== undefined && v !== null) ? v : def;
            }
            const legacy = GM_getValue('bgUrl', null);
            if(legacy && s.bgUrls.length === 0){
                s.bgUrls = [legacy];
                GM_setValue('bgUrl', null);
            }
            s.bgLastUsed = Array.isArray(s.bgLastUsed) ? s.bgLastUsed.slice(0, s.bgUrls.length) : [];
            while (s.bgLastUsed.length < s.bgUrls.length) s.bgLastUsed.push(0);
            return s;
        }catch(e){
            console.error('[背景] 设置加载失败，已重置', e);
            return JSON.parse(JSON.stringify(DEFAULTS));
        }
    }
    function saveSettings(s){
        try{
            if(s.bgLastUsed.length !== s.bgUrls.length)
                s.bgLastUsed = new Array(s.bgUrls.length).fill(0);
            Object.entries(s).forEach(([k, v]) => GM_setValue(k, v));
        }catch(e){
            console.error('[背景] 保存失败', e);
        }
    }
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    // ==================== 样式注入 ====================
    function injectAllStyles() {
        GM_addStyle(`
            .cropper-container{direction:ltr;font-size:0;line-height:0;position:relative;touch-action:none;user-select:none}.cropper-container img{display:block;height:100%;image-orientation:0deg;max-height:none!important;max-width:none!important;min-height:0!important;min-width:0!important;width:100%}.cropper-wrap-box,.cropper-canvas,.cropper-drag-box,.cropper-crop-box,.cropper-modal{bottom:0;left:0;position:absolute;right:0;top:0}.cropper-wrap-box,.cropper-canvas{overflow:hidden}.cropper-drag-box{background-color:#fff;opacity:0}.cropper-modal{background-color:#000;opacity:.5}.cropper-view-box{display:block;height:100%;outline:1px solid #39f;outline-color:rgba(51,153,255,.75);overflow:hidden;width:100%}.cropper-dashed{border:0 dashed #eee;display:block;opacity:.5;position:absolute}.cropper-dashed.dashed-h{border-bottom-width:1px;border-top-width:1px;height:33.33%;left:0;top:33.33%;width:100%}.cropper-dashed.dashed-v{border-left-width:1px;border-right-width:1px;height:100%;left:33.33%;top:0;width:33.33%}.cropper-center{display:block;height:0;left:50%;opacity:.75;position:absolute;top:50%;width:0}.cropper-center:before,.cropper-center:after{background-color:#eee;content:' ';display:block;position:absolute}.cropper-center:before{height:1px;left:-3px;top:0;width:7px}.cropper-center:after{height:7px;left:0;top:-3px;width:1px}.cropper-face,.cropper-line,.cropper-point{display:block;height:100%;opacity:.1;position:absolute;width:100%}.cropper-face{background-color:#fff;left:0;top:0}.cropper-line{background-color:#39f}.cropper-line.line-e{cursor:ew-resize;right:-3px;top:0;width:5px}.cropper-line.line-n{cursor:ns-resize;height:5px;left:0;top:-3px}.cropper-line.line-w{cursor:ew-resize;left:-3px;top:0;width:5px}.cropper-line.line-s{bottom:-3px;cursor:ns-resize;height:5px;left:0}.cropper-point{background-color:#39f;height:5px;opacity:.75;width:5px}.cropper-point.point-e{cursor:ew-resize;margin-top:-3px;right:-3px;top:50%}.cropper-point.point-n{cursor:ns-resize;left:50%;margin-left:-3px;top:-3px}.cropper-point.point-w{cursor:ew-resize;left:-3px;margin-top:-3px;top:50%}.cropper-point.point-s{bottom:-3px;cursor:s-resize;left:50%;margin-left:-3px}.cropper-point.point-ne{cursor:nesw-resize;right:-3px;top:-3px}.cropper-point.point-nw{cursor:nwse-resize;left:-3px;top:-3px}.cropper-point.point-sw{bottom:-3px;cursor:nesw-resize;left:-3px}.cropper-point.point-se{bottom:-3px;cursor:nwse-resize;height:20px;opacity:1;right:-3px;width:20px}@media(min-width:768px){.cropper-point.point-se{height:15px;width:15px}}@media(min-width:992px){.cropper-point.point-se{height:10px;width:10px}}@media(min-width:1200px){.cropper-point.point-se{height:5px;opacity:.75;width:5px}}.cropper-point.point-se:before{background-color:#39f;bottom:-50%;content:' ';display:block;height:200%;opacity:0;position:absolute;right:-50%;width:200%}.cropper-invisible{opacity:0}.cropper-bg{background-image:url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAAA3NCSVQICAjb4U/gAAAABlBMVEUAAAD///+l2Z/dAAAAMUlEQVQI12P4//8/Aw3zf7CoWcPAf+BABsz3zw0M/B8YmB8+MDD/f2B4P2FQ/GBQAAAkNxI0kX/LBgAAAABJRU5ErkJggg==')}.cropper-hide{display:block;height:0;position:absolute;width:0}.cropper-hidden{display:none!important}.cropper-move{cursor:move}.cropper-crop{cursor:crosshair}.cropper-disabled .cropper-drag-box,.cropper-disabled .cropper-face,.cropper-disabled .cropper-line,.cropper-disabled .cropper-point{cursor:not-allowed}
            body { background: transparent !important; }
            #app { background: transparent !important; }
            #luogu-bg-layer { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -10; pointer-events: none; overflow: hidden; }
            #luogu-bg-layer .bg-inner { position: absolute; top: -30px; left: -30px; width: calc(100% + 60px); height: calc(100% + 60px); background-size: cover; background-position: center; background-repeat: no-repeat; transition: filter 0.4s ease; }
            :root { --lgb-nav-opacity: 0.82; --lgb-main-opacity: 0.80; --lgb-card-opacity: 0.88; --lgb-header-opacity: 0.75; --lgb-footer-opacity: 0.70; }
            .top-bar { background-color: rgba(255,255,255, var(--lgb-nav-opacity)) !important; backdrop-filter: blur(calc((1 - var(--lgb-nav-opacity)) * 8px)); -webkit-backdrop-filter: blur(calc((1 - var(--lgb-nav-opacity)) * 8px)); }
            .sidebar.lside, .rside { background-color: rgba(255,255,255, var(--lgb-nav-opacity)) !important; backdrop-filter: blur(calc((1 - var(--lgb-nav-opacity)) * 8px)); -webkit-backdrop-filter: blur(calc((1 - var(--lgb-nav-opacity)) * 8px)); }
            .wrapper.header-layout .background { opacity: var(--lgb-header-opacity) !important; }
            footer { background-color: rgba(255,255,255, var(--lgb-footer-opacity)) !important; backdrop-filter: blur(calc((1 - var(--lgb-footer-opacity)) * 8px)); -webkit-backdrop-filter: blur(calc((1 - var(--lgb-footer-opacity)) * 8px)); }
            .wrapper.wrapped.lfe-body:not(.header-layout) .background { opacity: var(--lgb-footer-opacity) !important; }
            .theme-page { --theme-body-image: none !important; --theme-body-back: transparent !important; background: transparent !important; }
            main.lfe-body.mobile-body { background-color: rgba(239,239,239, var(--lgb-main-opacity)) !important; }
            main.lcolor-bg-background { background-color: rgba(239,239,239, var(--lgb-main-opacity)) !important; }
            .l-card, .lg-article, .am-panel, .lg-index-stat, .lg-index-contest, section.am-panel { background-color: rgba(255,255,255, var(--lgb-card-opacity)) !important; }
            .lg-index-contest .am-panel-bd { background-color: transparent !important; }
            .user-header-top { background-color: unset !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
            div[style*="background-color: rgb(255, 255, 255)"] { background-color: transparent !important; }
            .article-banner { background-color: transparent !important; }
            .top-progress { display: none !important; }
            .am-modal-dialog, .dropdown, .am-dropdown-content, .am-selected-content, [class*="dropdown"], .user-nav .dropdown { background-color: rgba(255,255,255,0.98) !important; backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
            .search-wrap input { background-color: rgba(255,255,255,0.95) !important; }
            #luogu-cropper-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000000; }
            #luogu-cropper-modal .crop-container { background: white; border-radius: 12px; padding: 20px; max-width: 95vw; max-height: 90vh; }
            #luogu-cropper-modal .crop-header { font-size: 16px; font-weight: 600; margin-bottom: 12px; text-align: center; }
            #luogu-cropper-modal .crop-body { max-width: 80vw; max-height: 60vh; overflow: hidden; }
            #luogu-cropper-modal .crop-body img { max-width: 100%; display: block; }
            #luogu-cropper-modal .crop-footer { margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px; }
            #luogu-cropper-modal button { padding: 8px 16px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
            #luogu-cropper-modal .btn-cancel { background: #f0f0f0; color: #333; }
            #luogu-cropper-modal .btn-confirm { background: #3498db; color: white; }
            .bg-upload-btn { display: inline-block; padding: 6px 12px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 12px; }
            .bg-upload-btn:hover { background: #e0e0e0; }
            .bg-image-list { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
            .bg-image-item { position: relative; width: 50px; height: 50px; border-radius: 6px; overflow: hidden; border: 1px solid #ddd; }
            .bg-image-item img { width: 100%; height: 100%; object-fit: cover; }
            .bg-image-item .delete-btn { position: absolute; top: 0; right: 0; background: rgba(231,76,60,0.8); color: white; border: none; width: 18px; height: 18px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 0 6px 0 6px; }
            #luogu-bg-panel { position: fixed; top: 50%; right: 24px; z-index: 99998; transform: translateY(-50%); width: 320px; max-width: calc(100vw - 48px); max-height: 80vh; overflow-y: auto; background: rgba(255,255,255,0.97); border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.2); padding: 20px 18px 16px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; font-size: 13px; color: #333; transition: all 0.35s cubic-bezier(0.4,0,0.2,1); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); scrollbar-width: thin; scrollbar-color: #ccc transparent; }
            #luogu-bg-panel.collapsed { opacity: 0; pointer-events: none; transform: translateY(-50%) translateX(120%); }
            #luogu-bg-panel h3 { margin: 0 0 14px; font-size: 16px; font-weight: 700; color: #2c3e50; text-align: center; }
            #luogu-bg-panel .section-title { font-size: 12px; font-weight: 600; color: #7f8c8d; margin: 14px 0 8px; padding-top: 10px; border-top: 1px solid #eee; }
            #luogu-bg-panel .section-title:first-of-type { border-top: none; margin-top: 4px; padding-top: 0; }
            #luogu-bg-panel input[type="url"], #luogu-bg-panel input[type="text"] { width: 100%; padding: 8px 12px; border: 1.5px solid #ddd; border-radius: 8px; font-size: 12px; background: #fdfdfd; }
            #luogu-bg-panel input:focus { outline: none; border-color: #3498db; }
            #luogu-bg-panel .slider-group { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
            #luogu-bg-panel .slider-group label { min-width: 60px; font-size: 12px; color: #555; text-align: right; }
            #luogu-bg-panel .slider-group input[type="range"] { flex: 1; -webkit-appearance: none; height: 6px; border-radius: 3px; background: #e0e0e0; }
            #luogu-bg-panel .slider-group input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #3498db; border: 2px solid #fff; }
            #luogu-bg-panel .slider-group .val-display { min-width: 40px; text-align: center; font-size: 11px; font-weight: 600; color: #2980b9; background: #eaf4fb; padding: 3px 6px; border-radius: 6px; }
            #luogu-bg-panel .btn-row { display: flex; gap: 8px; margin-top: 14px; }
            #luogu-bg-panel .btn-row button { flex: 1; padding: 9px 0; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; }
            #luogu-bg-panel .btn-reset { background: #f5f5f5; color: #666; border: 1px solid #ddd; }
            #luogu-bg-panel .btn-reset:hover { background: #e8e8e8; }
            #luogu-bg-panel .btn-close { width: 100%; margin-top: 4px; padding: 8px; background: #f5f5f5; color: #888; border: 1px solid #ddd; border-radius: 8px; cursor: pointer; }
            #luogu-bg-panel .btn-close:hover { background: #e0e0e0; }
        `);
    }
    // ==================== 背景板 ====================
    function createBgLayer(){
        let layer = document.getElementById('luogu-bg-layer');
        if(layer)
            layer.remove();
        layer = document.createElement('div');
        layer.id = 'luogu-bg-layer';
        layer.innerHTML = '<div class="bg-inner"></div>';
        document.body.insertBefore(layer, document.body.firstChild);
    }
    function updateBgLayer(s){
        const layer = document.getElementById('luogu-bg-layer');
        if (!layer) return;
        const inner = layer.querySelector('.bg-inner');
        if (!inner) return;
        if(!s.enableBgLayer) { layer.style.display = 'none'; return; }
        layer.style.display = '';
        const urls = s.bgUrls || [];
        let bg;
        if(urls.length === 0){
            bg = 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #0f3460 60%, #1a1a2e 100%)';
        }else{
            //权重 = max(1 , 当前时间 - 上次使用时间)
            //不对这个式子真的对吗 不管了就这样吧
            const now = Date.now();
            const last = s.bgLastUsed;
            while (last.length < urls.length) last.push(0);
            if(urls.length === 1){
                bg = urls[0];
                last[0] = now;
            }else{
                const weights = urls.map((_, i) => Math.max(1, now - (last[i] || 0)));
                const total = weights.reduce((a, b) => a + b, 0);
                let rand = Math.random() * total, idx = 0;
                for(let i = 0 ; i < weights.length ; i++){
                    rand -= weights[i];
                    if(rand <= 0){
                        idx = i;
                        break;
                    }
                }
                bg = urls[idx];
                last[idx] = now;
            }
            saveSettings(s); //保存更新
        }
        inner.style.backgroundImage = (bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) ? bg : `url(${bg})`;
        const filters = [];
        if(s.blur > 0)
            filters.push(`blur(${s.blur}px)`);
        if(s.bgBrightness !== 1.0)
            filters.push(`brightness(${s.bgBrightness})`);
        if(s.bgSaturation !== 1.0)
            filters.push(`saturate(${s.bgSaturation})`);
        inner.style.filter = filters.join(' ') || 'none';
    }
    function updateCssVariables(s){
        const r = document.documentElement.style;
        r.setProperty('--lgb-nav-opacity', s.navOpacity);
        r.setProperty('--lgb-main-opacity', s.mainOpacity);
        r.setProperty('--lgb-card-opacity', s.cardOpacity);
        r.setProperty('--lgb-header-opacity', s.headerOpacity);
        r.setProperty('--lgb-footer-opacity', s.footerOpacity);
    }
    function applySettings(s){
        updateBgLayer(s);
        updateCssVariables(s);
    }
    // ==================== 裁剪上传 ====================
    function startCropper(src) {
        const modal = document.createElement('div');
        modal.id = 'luogu-cropper-modal';
        modal.innerHTML = `
            <div class="crop-container">
                <div class="crop-header"> 裁剪背景图片</div>
                <div class="crop-body"><img id="luogu-crop-image"></div>
                <div class="crop-footer">
                    <button class="btn-cancel">取消</button>
                    <button class="btn-confirm">确认裁剪</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        const img = document.getElementById('luogu-crop-image');
        img.crossOrigin = 'anonymous';
        img.src = src;
        img.onload = () => {
            const aspect = window.innerWidth / window.innerHeight;
            const cropper = new Cropper(img, { aspectRatio: aspect, viewMode: 1, dragMode: 'move', autoCropArea: 0.8, cropBoxMovable: true, cropBoxResizable: true, background: false });
            const close = () => { cropper.destroy(); modal.remove(); };
            modal.querySelector('.btn-cancel').addEventListener('click', close);
            modal.addEventListener('click', ev => { if (ev.target === modal) close(); });
            modal.querySelector('.btn-confirm').addEventListener('click', () => {
                const maxW = Math.min(2560, window.innerWidth * 2);
                const maxH = Math.round(maxW / aspect);
                const canvas = cropper.getCroppedCanvas({ maxWidth: maxW, maxHeight: maxH, fillColor: '#fff', imageSmoothingQuality: 'high' });
                const addImage = (dataURL) => {
                    const s = loadSettings();
                    s.bgUrls.push(dataURL);
                    if (s.bgUrls.length > MAX_IMAGES) { s.bgUrls.shift(); s.bgLastUsed.shift(); }
                    s.bgLastUsed.push(0);
                    saveSettings(s);
                    applySettings(s);
                    refreshPanelImages();
                };
                if(canvas.toBlob){
                    canvas.toBlob(blob => {
                        const r = new FileReader();
                        r.onload = () => addImage(r.result);
                        r.readAsDataURL(blob);
                    }, 'image/webp', 0.9);
                }else{
                    addImage(canvas.toDataURL('image/jpeg', 0.9));
                }
                close();
            });
        };
        img.onerror = () => { alert('图片加载失败，请检查 URL 是否有效且允许跨域。'); modal.remove(); };
    }
    function openFileCropper(){
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.addEventListener('change', e => {
            const f = e.target.files[0];
            if(f){
                const reader = new FileReader();
                reader.onload = ev => startCropper(ev.target.result);
                reader.readAsDataURL(f);
            }
        });
        inp.click();
    }

    // ==================== 面板 HTML ====================
    function buildPanelHTML(s) {
        const pct = v => Math.round(v * 100);
        const count = (s.bgUrls || []).length;
        const listHTML = s.bgUrls.map((url, i) => `<div class="bg-image-item" data-index="${i}"><img src="${url}"><button class="delete-btn" data-delete="${i}">×</button></div>`).join('');
        return `
            <h3> 背景设置</h3>
            <div class="section-title"> 图片管理 (${count}/${MAX_IMAGES})</div>
            <div style="display:flex;gap:6px;margin-bottom:6px;">
                <input type="url" id="bg-url-input" placeholder="输入图片URL" style="flex:1;">
                <button class="bg-upload-btn" id="bg-add-url">+</button>
                <button class="bg-upload-btn" id="bg-upload-file">📁</button>
            </div>
            <div class="bg-image-list" id="bg-image-list">${listHTML || '<span style="font-size:12px;color:#999;">暂无图片，点击上传或输入URL添加</span>'}</div>
            <div class="section-title"> 背景模糊</div>
            <div class="slider-group"><label>模糊度</label><input type="range" id="blur-slider" min="0" max="40" value="${Math.round(s.blur)}" step="1"><span class="val-display" id="blur-val">${Math.round(s.blur)}px</span></div>
            <div class="section-title"> 背景滤镜</div>
            <div class="slider-group"><label>亮度</label><input type="range" id="brightness-slider" min="30" max="200" value="${pct(s.bgBrightness)}" step="5"><span class="val-display" id="brightness-val">${pct(s.bgBrightness)}%</span></div>
            <div class="slider-group"><label>饱和度</label><input type="range" id="saturation-slider" min="0" max="200" value="${pct(s.bgSaturation)}" step="5"><span class="val-display" id="saturation-val">${pct(s.bgSaturation)}%</span></div>
            <div class="section-title"> 区域透明度</div>
            <div class="slider-group"><label>导航栏</label><input type="range" id="nav-opacity-slider" min="15" max="100" value="${pct(s.navOpacity)}" step="1"><span class="val-display" id="nav-opacity-val">${pct(s.navOpacity)}%</span></div>
            <div class="slider-group"><label>主内容区</label><input type="range" id="main-opacity-slider" min="15" max="100" value="${pct(s.mainOpacity)}" step="1"><span class="val-display" id="main-opacity-val">${pct(s.mainOpacity)}%</span></div>
            <div class="slider-group"><label>卡片</label><input type="range" id="card-opacity-slider" min="15" max="100" value="${pct(s.cardOpacity)}" step="1"><span class="val-display" id="card-opacity-val">${pct(s.cardOpacity)}%</span></div>
            <div class="slider-group"><label>顶部区域</label><input type="range" id="header-opacity-slider" min="10" max="100" value="${pct(s.headerOpacity)}" step="1"><span class="val-display" id="header-opacity-val">${pct(s.headerOpacity)}%</span></div>
            <div class="slider-group"><label>底部区域</label><input type="range" id="footer-opacity-slider" min="10" max="100" value="${pct(s.footerOpacity)}" step="1"><span class="val-display" id="footer-opacity-val">${pct(s.footerOpacity)}%</span></div>
            <div class="btn-row"><button class="btn-reset" id="btn-reset"> 恢复默认</button></div>
            <button class="btn-close" id="btn-close-panel">✕ 关闭面板</button>`;
    }
    function refreshPanelImages(){
        const list = document.getElementById('bg-image-list');
        if(!list)
            return;
        const urls = loadSettings().bgUrls;
        if(urls.length === 0){
            list.innerHTML = '<span style="font-size:12px;color:#999;">暂无图片，点击上传或输入URL添加</span>';
            return;
        }
        list.innerHTML = urls.map((url, i) => `<div class="bg-image-item" data-index="${i}"><img src="${url}"><button class="delete-btn" data-delete="${i}">×</button></div>`).join('');
        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.delete);
                const s = loadSettings();
                s.bgUrls.splice(idx, 1);
                if (s.bgLastUsed.length > idx) s.bgLastUsed.splice(idx, 1);
                saveSettings(s);
                applySettings(s);
                refreshPanelImages();
            });
        });
    }
    function bindPanelEvents(panel, settings, onChange) {
        panel.querySelector('#bg-upload-file').addEventListener('click', openFileCropper);
        panel.querySelector('#bg-add-url').addEventListener('click', () => {
            const url = panel.querySelector('#bg-url-input').value.trim();
            if(url){
                startCropper(url);
                panel.querySelector('#bg-url-input').value = '';
            }
        });
        const bindSlider = (id, valId, get, set, fmt) => {
            const sl = panel.querySelector(id), disp = panel.querySelector(valId);
            if(!sl || !disp)
                return;
            sl.addEventListener('input', () => {
                const v = get(sl);
                set(settings, v);
                disp.textContent = fmt(v);
                onChange(settings);
            });
        };
        bindSlider('#blur-slider', '#blur-val', s => parseInt(s.value), (s,v) => s.blur = v, v => `${v}px`);
        bindSlider('#brightness-slider', '#brightness-val', s => parseInt(s.value)/100, (s,v) => s.bgBrightness = clamp(v,0.3,2.0), v => `${Math.round(v*100)}%`);
        bindSlider('#saturation-slider', '#saturation-val', s => parseInt(s.value)/100, (s,v) => s.bgSaturation = clamp(v,0,2.0), v => `${Math.round(v*100)}%`);
        bindSlider('#nav-opacity-slider', '#nav-opacity-val', s => parseInt(s.value)/100, (s,v) => s.navOpacity = clamp(v,0.15,1), v => `${Math.round(v*100)}%`);
        bindSlider('#main-opacity-slider', '#main-opacity-val', s => parseInt(s.value)/100, (s,v) => s.mainOpacity = clamp(v,0.15,1), v => `${Math.round(v*100)}%`);
        bindSlider('#card-opacity-slider', '#card-opacity-val', s => parseInt(s.value)/100, (s,v) => s.cardOpacity = clamp(v,0.15,1), v => `${Math.round(v*100)}%`);
        bindSlider('#header-opacity-slider', '#header-opacity-val', s => parseInt(s.value)/100, (s,v) => s.headerOpacity = clamp(v,0.1,1), v => `${Math.round(v*100)}%`);
        bindSlider('#footer-opacity-slider', '#footer-opacity-val', s => parseInt(s.value)/100, (s,v) => s.footerOpacity = clamp(v,0.1,1), v => `${Math.round(v*100)}%`);
        panel.querySelector('#btn-reset').addEventListener('click', () => {
            Object.assign(settings, DEFAULTS);
            settings.bgUrls = [];
            settings.bgLastUsed = [];
            onChange(settings);
            saveSettings(settings);
            refreshPanelImages();
            refreshPanelUI(panel, settings);
        });
        panel.querySelector('#btn-close-panel').addEventListener('click', () => {
            settings.panelCollapsed = true;
            panel.classList.add('collapsed');
            saveSettings(settings);
        });
    }
    function refreshPanelUI(panel , s){
        const setVal = (id, val) => { const el = panel.querySelector(id); if (el) el.value = Math.round(val); };
        setVal('#blur-slider', s.blur);
        setVal('#brightness-slider', s.bgBrightness * 100);
        setVal('#saturation-slider', s.bgSaturation * 100);
        setVal('#nav-opacity-slider', s.navOpacity * 100);
        setVal('#main-opacity-slider', s.mainOpacity * 100);
        setVal('#card-opacity-slider', s.cardOpacity * 100);
        setVal('#header-opacity-slider', s.headerOpacity * 100);
        setVal('#footer-opacity-slider', s.footerOpacity * 100);
        panel.querySelector('#blur-val').textContent = Math.round(s.blur) + 'px';
        panel.querySelector('#brightness-val').textContent = Math.round(s.bgBrightness * 100) + '%';
        panel.querySelector('#saturation-val').textContent = Math.round(s.bgSaturation * 100) + '%';
        panel.querySelector('#nav-opacity-val').textContent = Math.round(s.navOpacity * 100) + '%';
        panel.querySelector('#main-opacity-val').textContent = Math.round(s.mainOpacity * 100) + '%';
        panel.querySelector('#card-opacity-val').textContent = Math.round(s.cardOpacity * 100) + '%';
        panel.querySelector('#header-opacity-val').textContent = Math.round(s.headerOpacity * 100) + '%';
        panel.querySelector('#footer-opacity-val').textContent = Math.round(s.footerOpacity * 100) + '%';
    }
    // ==================== 菜单集成 ====================
    function insertMenuItems(){
        const side = document.querySelector('nav.sidebar.lside');
        if(side){
            const group = [...side.querySelectorAll('.nav-group')].find(g => g.querySelector('.group-title .title')?.textContent.includes('更多功能'));
            if(group){
                const ul = group.querySelector('ul');
                const ref = [...ul.children].find(li => li.textContent.includes('图片上传'));
                if (ref && !ul.querySelector('[data-bg-custom-menu]')) {
                    const li = ref.cloneNode(true);
                    li.setAttribute('data-bg-custom-menu', 'true');
                    li.querySelector('.title.minor').textContent = '背景设置';
                    const a = li.querySelector('a');
                    a.removeAttribute('href');
                    a.addEventListener('click', e => { e.preventDefault(); showPanel(); });
                    ul.insertBefore(li, ref);
                }
            }
        }else{
            const oldNav = document.querySelector('nav.lfe-body');
            if (oldNav) {
                const apps = oldNav.querySelector('.popup-wrap .popup .apps');
                const ref = apps?.querySelector('a[href="/ticket"]');
                if (ref && !apps.querySelector('[data-bg-custom-menu-old]')) {
                    const a = ref.cloneNode(true);
                    a.setAttribute('data-bg-custom-menu-old', 'true');
                    a.removeAttribute('href');
                    a.textContent = '背景设置';
                    a.addEventListener('click', e => { e.preventDefault(); showPanel(); });
                    ref.insertAdjacentElement('afterend', a);
                }
            }
        }
    }
    function showPanel(){
        const panel = document.getElementById('luogu-bg-panel');
        if(panel){
            panel.classList.remove('collapsed');
            const s = loadSettings();
            s.panelCollapsed = false;
            saveSettings(s);
        }
    }
    // ==================== 初始化 ====================
    function init(){
        injectAllStyles();
        const s = loadSettings();
        createBgLayer();
        applySettings(s);
        const panel = createPanel(s, updated => { applySettings(updated); saveSettings(updated); });
        insertMenuItems();
        new MutationObserver(() => insertMenuItems()).observe(document.body, { childList: true, subtree: true });
        new MutationObserver(() => {
            if (!document.getElementById('luogu-bg-layer')) { createBgLayer(); applySettings(s); }
            updateCssVariables(s);
        }).observe(document.body, { childList: true, subtree: true });
    }
    function createPanel(settings, onChange) {
        const old = document.getElementById('luogu-bg-panel');
        if (old) old.remove();
        const panel = document.createElement('div');
        panel.id = 'luogu-bg-panel';
        if (settings.panelCollapsed) panel.classList.add('collapsed');
        panel.innerHTML = buildPanelHTML(settings);
        document.body.appendChild(panel);
        bindPanelEvents(panel, settings, onChange);
        refreshPanelImages();
        return panel;
    }
    if(document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', init);
    else init();
})();