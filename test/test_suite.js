
const { InspectorCore } = require('../app.js');

// --- Test Functions ---

function assert(condition, message) {
    if (!condition) {
        console.error(`FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`PASS: ${message}`);
    }
}

function testParser() {
    console.log("\n--- Testing Parser ---");
    const cases = [
        { in: "102030", expect0: 0x10, type: "Hex (Continuous)" },
        { in: "0x10 0x20", expect0: 0x10, type: "Array (Hex)" },
        { in: "[16, 32]", expect0: 0x10, type: "Array (Integer)" }, // decimal 16 = 0x10
        { in: "ECAw", expect0: 0x10, type: "Base64" },
        { in: "0xZZ", isError: true }, // Invalid Hex
        { in: "!!!!", isError: true } // Invalid Base64/Hex
    ];

    cases.forEach(c => {
        const { bytes, type, error } = InspectorCore.parseInput(c.in);
        if (c.isError) {
            assert(error !== null, `Input "${c.in}" correctly reported error: ${error}`);
        } else {
            assert(bytes && bytes.length > 0 && bytes[0] === c.expect0, `Input "${c.in}" parsed correctly`);
            if (c.type) assert(type === c.type, `Input "${c.in}" type detected: ${type}`);
        }
    });
}

function testFloat64() {
    console.log("\n--- Testing Float64 ---");
    // 0x3FF0000000000000 = 1.0
    const bytes = new Uint8Array([0x3F, 0xF0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const decoded = InspectorCore.generateAllLists(bytes);

    const be = decoded.float64.be[0].val;
    assert(be === 1.0, `Float64 BE 1.0`);
}

function testInt64() {
    console.log("\n--- Testing Int64 ---");
    // 1 -> 0x00...01
    const bytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]);
    const decoded = InspectorCore.generateAllLists(bytes);

    const be = decoded.int64.be[0].val;
    assert(be === 1n, `Int64 BE 1n`);

    // Negative -1 -> 0xFF...FF
    const bytesNeg = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]);
    const decodedNeg = InspectorCore.generateAllLists(bytesNeg);
    const beNeg = decodedNeg.int64.be[0].val;
    assert(beNeg === -1n, `Int64 BE -1n`);
}

function testFloat32() {
    console.log("\n--- Testing Float32 ---");
    // 0x3F800000 = 1.0
    const bytes = new Uint8Array([0x3F, 0x80, 0x00, 0x00]);
    const decoded = InspectorCore.generateAllLists(bytes);

    const be = decoded.float32.be[0].val;
    assert(Math.abs(be - 1.0) < 0.00001, `Float32 BE 1.0`);
}

function testInt32() {
    console.log("\n--- Testing Int32 ---");
    // 0xFFFFFFFF = -1
    const bytes = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]);
    const decoded = InspectorCore.generateAllLists(bytes);

    const be = decoded.int32.be[0].val;
    assert(be === -1, `Int32 BE -1`);
}

function test16Bit() {
    console.log("\n--- Testing 16-bit ---");
    // 0x0001 = 1
    const bytes = new Uint8Array([0x00, 0x01]);
    const decoded = InspectorCore.generateAllLists(bytes);

    const be = decoded.int16.be[0].val;
    assert(be === 1, `Int16 BE 1`);
}

function test8Bit() {
    console.log("\n--- Testing 8-bit ---");
    const bytes = new Uint8Array([0xFF]); // -1 signed, 255 unsigned
    const decoded = InspectorCore.generateAllLists(bytes);

    const i8 = decoded.int8[0].val;
    const u8 = decoded.uint8[0].val;

    assert(i8 === -1, `Int8 -1`);
    assert(u8 === 255, `Uint8 255`);
}

// Run All
try {
    testParser();
    testFloat64();
    testInt64();
    testFloat32();
    testInt32();
    test16Bit();
    test8Bit();
    console.log("\nALL TESTS SUITE PASSED (Using Core Logic)");
} catch (e) {
    console.error(e);
}
