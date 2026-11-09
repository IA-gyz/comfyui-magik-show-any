import { app } from "../../../scripts/app.js";

const fonts = ["monospace", "sans-serif", "serif", "Arial", "Verdana", "Georgia", "Courier New"];
app.registerExtension({
    name: "Magik.ShowAny",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MagikShowAny") return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function (...args) {
            const result = created?.apply(this, args);
            const node = this;
            node.properties ??= {};
            const area = document.createElement("textarea");
            area.readOnly = true;
            area.placeholder = "Run the workflow to inspect a value";
            Object.assign(area.style, {width:"100%", height:"100%", resize:"none", boxSizing:"border-box", background:"#151820", color:"#eee", border:"1px solid #424858", padding:"10px"});
            const apply = () => {
                area.style.fontFamily = node.properties.magikFont || "monospace";
                area.style.fontSize = `${Math.max(1, Math.min(128, Number(node.properties.magikSize) || 16))}px`;
                node.setDirtyCanvas?.(true, true);
            };
            const font = node.addWidget("combo", "Font", node.properties.magikFont || "monospace", value => {node.properties.magikFont = value; apply();}, {values:fonts});
            const size = node.addWidget("number", "Font size", node.properties.magikSize || 16, value => {node.properties.magikSize = Math.max(1, Math.min(128, Math.round(value))); apply();}, {min:1,max:128,step:1,precision:0});
            // These are frontend-only controls, never backend inputs.
            font.options.serialize = false;
            size.options.serialize = false;
            const display = node.addDOMWidget("display", "customtext", area, {serialize:false, hideOnZoom:false});
            display.computeSize = width => [width, 220];
            node.magikShowText = text => {area.value = text; apply();};
            const configured = node.onConfigure;
            node.onConfigure = function (...args) {
                const result = configured?.apply(this, args);
                font.value = node.properties.magikFont || "monospace";
                size.value = node.properties.magikSize || 16;
                apply();
                return result;
            };
            area.addEventListener("dblclick", () => {
                const dialog = document.createElement("dialog");
                Object.assign(dialog.style, {width:"92vw",height:"90vh",maxWidth:"none",background:"#151820",color:"#eee",border:"1px solid #687087",padding:"16px"});
                const bar = document.createElement("div");
                const copy = document.createElement("button"); copy.textContent = "Copy";
                const close = document.createElement("button"); close.textContent = "Close";
                bar.append(copy, close);
                const text = document.createElement("textarea"); text.readOnly = true; text.value = area.value;
                Object.assign(text.style, {width:"100%",height:"calc(100% - 42px)",boxSizing:"border-box",marginTop:"10px",resize:"none",background:"#151820",color:"#eee",fontFamily:area.style.fontFamily,whiteSpace:"pre"});
                dialog.append(bar, text); document.body.append(dialog); dialog.showModal();
                // Fit the complete text when possible, within the 8–128 px range.
                let lo=8, hi=128, best=8;
                while(lo<=hi) {const mid=(lo+hi)>>1; text.style.fontSize=`${mid}px`; if(text.scrollHeight<=text.clientHeight && text.scrollWidth<=text.clientWidth){best=mid;lo=mid+1;}else hi=mid-1;}
                text.style.fontSize=`${best}px`;
                copy.onclick = async () => {try {await navigator.clipboard.writeText(text.value);copy.textContent="Copied";} catch {text.focus();text.select();copy.textContent="Press Ctrl+C";}};
                close.onclick = () => dialog.close();
                dialog.addEventListener("close", () => dialog.remove(), {once:true});
            });
            node.setSize([420, 330]); apply();
            return result;
        };
        const executed = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            const result = executed?.apply(this, arguments);
            if (message?.text) this.magikShowText?.(Array.isArray(message.text) ? message.text.join("\n\n") : String(message.text));
            return result;
        };
    },
});
