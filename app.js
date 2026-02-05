// Core Logic (Testable)
const InspectorCore = {
    parseInput(input, mode = 'Auto') {
        const result = { bytes: new Uint8Array([]), type: null, error: null, detectedModes: [] };
        if (!input) return result;
        const trimmed = input.trim();
        if (!trimmed) return result;

        // --- Parsers ---

        const parseArray = (str) => {
            const hasSeparators = /[\s,\[\]]/.test(str);
            if (!hasSeparators) return null;
            const cleaned = str.replace(/[\[\]]/g, '');
            const items = cleaned.split(/[\s,]+/).filter(x => x);
            if (items.length === 0) return null;

            const bytes = [];
            let isHex = false;
            let isDecimal = false;

            for (const item of items) {
                if (item.toLowerCase().startsWith('0x')) {
                    const val = parseInt(item, 16);
                    if (isNaN(val)) return null;
                    bytes.push(val);
                    isHex = true;
                } else {
                    const val = parseInt(item, 10);
                    if (isNaN(val)) return null;
                    if (val > 255 || val < 0) return null; // Strict array check for now
                    bytes.push(val);
                    isDecimal = true;
                }
            }
            const type = isHex && isDecimal ? "Array (Mixed)" : (isHex ? "Array (Hex)" : "Array (Integer)");
            return { bytes: new Uint8Array(bytes), type };
        };

        const parseHex = (str) => {
            // Handle 0x prefix
            let hex = str;
            let explicit = false;
            if (str.toLowerCase().startsWith('0x')) {
                hex = str.substring(2);
                explicit = true;
            }
            if (!/^[0-9A-Fa-f]+$/.test(hex)) return null;
            // Hex must be valid chars

            const safeHex = hex.length % 2 !== 0 ? '0' + hex : hex;
            const bytes = new Uint8Array(safeHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            return { bytes, type: explicit ? "Hex (Explicit)" : "Hex (Continuous)" };
        };

        const parseBase64 = (str) => {
            try {
                // Remove whitespaces? base64 shouldn't have them usually but `atob` might fail or ignore.
                // Strict check: Base64 chars only? 
                // atob ignores non-base64 chars in some environments or throws.
                // Let's rely on atob success.
                // Optimization: If it contains '0x', atob might decode it.
                // 0xAA -> Valid base64.
                const binString = atob(str);
                const bytes = new Uint8Array(binString.length);
                for (let i = 0; i < binString.length; i++) {
                    bytes[i] = binString.charCodeAt(i);
                }
                return { bytes, type: "Base64" };
            } catch (e) {
                return null;
            }
        };

        // --- Execution ---

        // 1. Forced Mode
        if (mode === 'Hex') {
            const res = parseHex(trimmed);
            if (res) return { ...result, ...res };
            return { ...result, error: "Invalid Hex String" };
        }
        if (mode === 'Base64') {
            const res = parseBase64(trimmed);
            if (res) return { ...result, ...res };
            return { ...result, error: "Invalid Base64 String" };
        }
        if (mode === 'Array') {
            const res = parseArray(trimmed);
            if (res) return { ...result, ...res };
            return { ...result, error: "Invalid Array Format" };
        }

        // 2. Auto Mode
        const arrayRes = parseArray(trimmed);
        const hexRes = parseHex(trimmed);
        const b64Res = parseBase64(trimmed);

        const candidates = [];
        if (arrayRes) candidates.push(arrayRes);
        if (hexRes) candidates.push(hexRes);
        if (b64Res) candidates.push(b64Res);

        if (candidates.length === 0) {
            result.error = "Unknown Format";
            return result;
        }

        // Detect Ambiguity
        // Array usually distinct because of separators.
        // Hex vs Base64 is the main ambiguity.

        result.detectedModes = [];
        if (arrayRes) result.detectedModes.push('Array');
        if (hexRes) result.detectedModes.push('Hex');
        if (b64Res) result.detectedModes.push('Base64');

        // Selection Logic
        // Priority: Array > Hex > Base64 (Default)

        let best = null;
        if (arrayRes) {
            best = arrayRes;
        } else if (hexRes) {
            best = hexRes;
            // If we have Hex, it wins over Base64 by default, BUT `detectedModes` will hint UI.
        } else if (b64Res) {
            best = b64Res;
        }

        return { ...result, ...best };
    },

    generateAllLists(bytes) {
        // Output structure
        const decoded = {};

        // Helper to process chunks
        const process = (chunkSize, callback) => {
            const variants = {};

            for (let i = 0; i < bytes.length; i += chunkSize) {
                let slice = Array.from(bytes.slice(i, i + chunkSize));
                // Pad (Big Endian logic = Prepend zeros)
                while (slice.length < chunkSize) slice.unshift(0);

                const hexStr = slice.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
                const values = callback(slice); // Returns { be: val, le: val ... }

                // Initialize keys on first run
                if (i === 0) {
                    Object.keys(values).forEach(k => variants[k] = []);
                }

                Object.entries(values).forEach(([k, v]) => {
                    variants[k].push({ hex: hexStr, val: v });
                });
            }
            return variants;
        };

        const getView = (b) => new DataView(new Uint8Array(b).buffer);

        // 1. 32-bit Types (Float32, Uint32, Int32)
        const chunk32 = process(4, (b) => {
            const be = b;
            const le = [b[3], b[2], b[1], b[0]];
            const mb = [b[1], b[0], b[3], b[2]]; // BADC
            const ml = [b[2], b[3], b[0], b[1]]; // CDAB

            const read = (arr) => {
                const view = getView(arr);
                return {
                    u: view.getUint32(0),
                    i: view.getInt32(0),
                    f: view.getFloat32(0)
                };
            };
            const rBE = read(be);
            const rLE = read(le);
            const rMB = read(mb);
            const rML = read(ml);

            return {
                u_be: rBE.u, u_le: rLE.u, u_mb: rMB.u, u_ml: rML.u,
                i_be: rBE.i, i_le: rLE.i, i_mb: rMB.i, i_ml: rML.i,
                f_be: rBE.f, f_le: rLE.f, f_mb: rMB.f, f_ml: rML.f
            };
        });
        decoded.uint32 = { be: chunk32.u_be, le: chunk32.u_le, mb: chunk32.u_mb, ml: chunk32.u_ml };
        decoded.int32 = { be: chunk32.i_be, le: chunk32.i_le, mb: chunk32.i_mb, ml: chunk32.i_ml };
        decoded.float32 = { be: chunk32.f_be, le: chunk32.f_le, mb: chunk32.f_mb, ml: chunk32.f_ml };

        // 2. 64-bit Types (Float64, Uint64, Int64)
        const chunk64 = process(8, (b) => {
            const be = b;
            const le = [...b].reverse();
            const mb = [b[1], b[0], b[3], b[2], b[5], b[4], b[7], b[6]]; // BADC...
            const ml = [b[2], b[3], b[0], b[1], b[6], b[7], b[4], b[5]]; // CDAB...

            const read = (arr) => {
                const view = getView(arr);
                return {
                    f: view.getFloat64(0),
                    u: view.getBigUint64(0),
                    i: view.getBigInt64(0)
                };
            };
            const rBE = read(be);
            const rLE = read(le);
            const rMB = read(mb);
            const rML = read(ml);

            return {
                f_be: rBE.f, f_le: rLE.f, f_mb: rMB.f, f_ml: rML.f,
                u_be: rBE.u, u_le: rLE.u, u_mb: rMB.u, u_ml: rML.u,
                i_be: rBE.i, i_le: rLE.i, i_mb: rMB.i, i_ml: rML.i
            };
        });
        decoded.float64 = { be: chunk64.f_be, le: chunk64.f_le, mb: chunk64.f_mb, ml: chunk64.f_ml };
        decoded.uint64 = { be: chunk64.u_be, le: chunk64.u_le, mb: chunk64.u_mb, ml: chunk64.u_ml };
        decoded.int64 = { be: chunk64.i_be, le: chunk64.i_le, mb: chunk64.i_mb, ml: chunk64.i_ml };

        // 3. 16-bit Types
        const chunk16 = process(2, (b) => {
            const be = b;
            const le = [b[1], b[0]];
            const read = (arr) => {
                const v = getView(arr);
                return { u: v.getUint16(0), i: v.getInt16(0) };
            };
            const rBE = read(be);
            const rLE = read(le);
            return {
                u_be: rBE.u, u_le: rLE.u,
                i_be: rBE.i, i_le: rLE.i
            };
        });
        decoded.uint16 = { be: chunk16.u_be, le: chunk16.u_le };
        decoded.int16 = { be: chunk16.i_be, le: chunk16.i_le };

        // 4. 8-bit Types
        const chunk8 = process(1, (b) => {
            const u = b[0];
            const i = (u << 24) >> 24;
            return { u, i };
        });
        decoded.uint8 = chunk8.u;
        decoded.int8 = chunk8.i;

        return decoded;
    }
};

function frameInspector() {
    return {
        rawInput: '48656c6c6f00000040490fdb',
        inputMode: 'Auto',
        inputType: null,
        inputError: null,
        detectedModes: [],
        hexPreview: '',

        decodedStreams: {
            float32: { be: [], le: [], mb: [], ml: [] },
            float64: { be: [], le: [], mb: [], ml: [] },
            uint64: { be: [], le: [], mb: [], ml: [] },
            int64: { be: [], le: [], mb: [], ml: [] },
            uint32: { be: [], le: [], mb: [], ml: [] },
            int32: { be: [], le: [], mb: [], ml: [] },
            uint16: { be: [], le: [] },
            int16: { be: [], le: [] },
            uint8: [],
            int8: []
        },

        init() {
            this.parse();
            this.$watch('rawInput', () => this.parse());
            this.$watch('inputMode', () => this.parse());
        },

        parse() {
            const { bytes, type, error, detectedModes } = InspectorCore.parseInput(this.rawInput, this.inputMode);
            this.inputType = type;
            this.inputError = error;
            this.detectedModes = detectedModes || [];

            if (error || !bytes || bytes.length === 0) {
                this.hexPreview = '';
                return;
            }
            // Generate Hex Preview (0xAA 0xBB format)
            this.hexPreview = Array.from(bytes)
                .map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase())
                .join(' ');

            this.decodedStreams = InspectorCore.generateAllLists(bytes);
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = { InspectorCore };
}
