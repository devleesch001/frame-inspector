function frameInspector() {
    return {
        rawInput: '48656c6c6f00000040490fdb',
        offset: 0,

        // Multi-Endian Table Results
        inspector: {
            float32: { be: 'N/A', le: 'N/A', mb: 'N/A', ml: 'N/A' },
            float64: { be: 'N/A', le: 'N/A', mb: 'N/A', ml: 'N/A' },
            uint32: { be: 0, le: 0, mb: 0, ml: 0 },
            int32: { be: 0, le: 0, mb: 0, ml: 0 },
            uint16: { be: 0, le: 0 },
            int16: { be: 0, le: 0 },
            uint8: 0,
            int8: 0,
            text: ''
        },

        // Stream Lists
        streamLists: {
            int8: [],
            int16: [],
            int32: [],
            int64: []
        },

        init() {
            this.parse();
            this.$watch('rawInput', () => this.parse());
            this.$watch('offset', () => this.updateInspector());
        },

        get cleanHex() {
            return this.rawInput.replace(/\s+|0x/g, '').toLowerCase();
        },

        get maxOffset() {
            return Math.floor(this.cleanHex.length / 2);
        },

        parse() {
            const hex = this.cleanHex;
            if (!hex || hex.length % 2 !== 0) return;

            const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

            this.generateLists(bytes);
            this.updateInspector(bytes);
        },

        updateInspector(bytesInput) {
            const hex = this.cleanHex;
            // Re-parse bytes if not provided (called from offset watcher)
            const bytes = bytesInput || (hex ? new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))) : new Uint8Array(0));

            // Validate offset
            if (this.offset < 0) this.offset = 0;
            if (this.offset >= bytes.length) this.offset = bytes.length > 0 ? bytes.length - 1 : 0;

            const off = this.offset;

            // Helpers
            const getBytes = (n) => {
                if (off + n > bytes.length) return null;
                return Array.from(bytes.slice(off, off + n)); // Slice works on TypedArray
            };

            const reverse = (arr) => [...arr].reverse();

            // 4-byte types
            const b4 = getBytes(4);
            if (b4) {
                const be = b4;
                const le = reverse(b4);
                const mb = [b4[1], b4[0], b4[3], b4[2]]; // BADC
                const ml = [b4[2], b4[3], b4[0], b4[1]]; // CDAB

                const makeRes = (arr) => {
                    const u32 = new DataView(new Uint8Array(arr).buffer).getUint32(0, false);
                    const i32 = new DataView(new Uint8Array(arr).buffer).getInt32(0, false);
                    const f32 = new DataView(new Uint8Array(arr).buffer).getFloat32(0, false);
                    return { u: u32, i: i32, f: f32 };
                };

                const rBE = makeRes(be);
                const rLE = makeRes(le);
                const rMB = makeRes(mb);
                const rML = makeRes(ml);

                this.inspector.uint32 = { be: rBE.u, le: rLE.u, mb: rMB.u, ml: rML.u };
                this.inspector.int32 = { be: rBE.i, le: rLE.i, mb: rMB.i, ml: rML.i };
                this.inspector.float32 = { be: rBE.f, le: rLE.f, mb: rMB.f, ml: rML.f };
            } else {
                this.inspector.uint32 = this.inspector.int32 = this.inspector.float32 = { be: '-', le: '-', mb: '-', ml: '-' };
            }

            // 8-byte types (Float64)
            const b8 = getBytes(8);
            if (b8) {
                // BE
                const be = b8;
                // LE
                const le = reverse(b8);
                // Mid-Big (BADC...)
                const mb = [b8[1], b8[0], b8[3], b8[2], b8[5], b8[4], b8[7], b8[6]];
                // Mid-Little (CDAB...) - Following user pattern for 32-bit (Swap 16-bit words)
                const ml = [b8[2], b8[3], b8[0], b8[1], b8[6], b8[7], b8[4], b8[5]];

                const makeF64 = (arr) => new DataView(new Uint8Array(arr).buffer).getFloat64(0, false);

                this.inspector.float64 = {
                    be: makeF64(be),
                    le: makeF64(le),
                    mb: makeF64(mb),
                    ml: makeF64(ml)
                };
            } else {
                this.inspector.float64 = { be: '-', le: '-', mb: '-', ml: '-' };
            }

            // 2-byte types
            const b2 = getBytes(2);
            if (b2) {
                const u16be = (b2[0] << 8) | b2[1];
                const u16le = (b2[1] << 8) | b2[0];
                const toI16 = (u) => (u << 16) >> 16;

                this.inspector.uint16 = { be: u16be, le: u16le };
                this.inspector.int16 = { be: toI16(u16be), le: toI16(u16le) };
            } else {
                this.inspector.uint16 = this.inspector.int16 = { be: '-', le: '-' };
            }

            // 1-byte
            const b1 = getBytes(1);
            if (b1) {
                this.inspector.uint8 = b1[0];
                this.inspector.int8 = (b1[0] << 24) >> 24;
            } else {
                this.inspector.uint8 = this.inspector.int8 = '-';
            }

            // Text
            if (bytes.length > off) {
                const slice = bytes.slice(off, off + 16);
                const decoder = new TextDecoder('utf-8', { fatal: false });
                this.inspector.text = decoder.decode(slice).replace(/[\u0000-\u001F\u007F-\u009F]/g, '.');
            } else {
                this.inspector.text = '';
            }
        },

        generateLists(bytes) {
            // Helper to chunk and pad
            const chunkAndPad = (chunkSize) => {
                const chunks = [];
                for (let i = 0; i < bytes.length; i += chunkSize) {
                    let slice = Array.from(bytes.slice(i, i + chunkSize));

                    // Pad logic: Prepend zeros if partial
                    while (slice.length < chunkSize) {
                        slice.unshift(0);
                    }

                    // Convert to Value (Big Endian)
                    const hex = slice.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

                    let val = '-';
                    if (chunkSize === 1) {
                        const u = slice[0];
                        const i8 = (u << 24) >> 24;
                        val = `${i8}`;
                    } else if (chunkSize === 2) {
                        const u = (slice[0] << 8) | slice[1];
                        const i16 = (u << 16) >> 16;
                        val = `${i16}`;
                    } else if (chunkSize === 4) {
                        const i32 = (slice[0] << 24) | (slice[1] << 16) | (slice[2] << 8) | slice[3];
                        val = `${i32}`;
                    } else if (chunkSize === 8) {
                        // BigInt
                        let h = slice.map(b => b.toString(16).padStart(2, '0')).join('');
                        let u = BigInt('0x' + h);
                        let i64 = BigInt.asIntN(64, u);
                        val = `${i64}`;
                    }

                    chunks.push({ hex, val });
                }
                return chunks;
            };

            this.streamLists.int8 = chunkAndPad(1);
            this.streamLists.int16 = chunkAndPad(2);
            this.streamLists.int32 = chunkAndPad(4);
            this.streamLists.int64 = chunkAndPad(8);
        },

        scan() {
            const hex = this.cleanHex;
            if (!hex || hex.length < 4) return;
            const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

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
