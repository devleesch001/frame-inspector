// Core Logic (Testable)
const InspectorCore = {
    parseInput(input) {
        if (!input) return new Uint8Array([]);
        const trimmed = input.trim();
        if (!trimmed) return new Uint8Array([]);

        // 1. Detect Separators (Space, Comma, Brackets)
        const hasSeparators = /[\s,\[\]]/.test(trimmed);

        if (hasSeparators) {
            const cleaned = trimmed.replace(/[\[\]]/g, '');
            const items = cleaned.split(/[\s,]+/).filter(x => x);
            const bytes = [];
            for (const item of items) {
                if (item.toLowerCase().startsWith('0x')) {
                    bytes.push(parseInt(item, 16));
                } else {
                    bytes.push(parseInt(item, 10)); // Decimal
                }
            }
            return new Uint8Array(bytes);
        }

        // 2. Contiguous String
        // Explicit 0x
        if (trimmed.toLowerCase().startsWith('0x')) {
            const hex = trimmed.substring(2);
            const safeHex = hex.length % 2 !== 0 ? '0' + hex : hex;
            return new Uint8Array(safeHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        }

        // Ambiguous: Hex (no separators) vs Base64
        const isHex = /^[0-9A-Fa-f]+$/.test(trimmed);
        if (isHex) {
            const safeHex = trimmed.length % 2 !== 0 ? '0' + trimmed : trimmed;
            try {
                return new Uint8Array(safeHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            } catch (e) { return new Uint8Array([]); }
        }

        // Try Base64
        try {
            const binString = atob(trimmed);
            const bytes = new Uint8Array(binString.length);
            for (let i = 0; i < binString.length; i++) {
                bytes[i] = binString.charCodeAt(i);
            }
            return bytes;
        } catch (e) {
            return new Uint8Array([]);
        }
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
        byteLength: 0,
        offset: 0,

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
        },

        get maxOffset() {
            return this.byteLength || 0;
        },

        parse() {
            const bytes = InspectorCore.parseInput(this.rawInput);
            if (!bytes || bytes.length === 0) return;
            this.byteLength = bytes.length;
            this.decodedStreams = InspectorCore.generateAllLists(bytes);
        },

        scan() {
            const bytes = InspectorCore.parseInput(this.rawInput);
            if (!bytes || bytes.length < 4) return;

            let bestOffset = -1;
            for (let i = 0; i < bytes.length - 4; i++) {
                let isString = true;
                for (let j = 0; j < 4; j++) {
                    const c = bytes[i + j];
                    if (c < 32 || c > 126) { isString = false; break; }
                }
                if (isString) { bestOffset = i; break; }
            }
            if (bestOffset !== -1) {
                this.offset = bestOffset;
            } else {
                alert("No obvious patterns found.");
            }
        }
    }
}

if (typeof module !== 'undefined') {
    module.exports = { InspectorCore };
}
